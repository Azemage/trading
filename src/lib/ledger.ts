import { prisma } from "./prisma";

export type ManagerLedgerEntry =
  | { kind: "DEPOSIT"; date: Date; clientName: string; amount: number }
  | { kind: "WITHDRAWAL"; date: Date; clientName: string; amount: number }
  | {
      kind: "TRADE";
      date: Date;
      pnlPct: number;
      gainUsd: number;
      fee: number;
      pair: string | null;
      note: string | null;
    };

/** Fiche de calcul consolidée : entrées (dépôts), trades et frais de perf générés. */
export async function buildManagerLedger(limit = 100): Promise<ManagerLedgerEntry[]> {
  const [deposits, withdrawals, trades] = await Promise.all([
    prisma.pendingMovement.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED" },
      include: { client: { select: { name: true } } },
      orderBy: { processedAt: "desc" },
      take: limit,
    }),
    prisma.pendingMovement.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED" },
      include: { client: { select: { name: true } } },
      orderBy: { processedAt: "desc" },
      take: limit,
    }),
    prisma.trade.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      include: { feeLedgerEntries: true },
    }),
  ]);

  const entries: ManagerLedgerEntry[] = [
    ...deposits
      .filter((d) => d.processedAt)
      .map((d) => ({
        kind: "DEPOSIT" as const,
        date: d.processedAt!,
        clientName: d.client.name,
        amount: d.amount.toNumber(),
      })),
    ...withdrawals
      .filter((w) => w.processedAt)
      .map((w) => ({
        kind: "WITHDRAWAL" as const,
        date: w.processedAt!,
        clientName: w.client.name,
        amount: w.grantedAmount?.toNumber() ?? 0,
      })),
    ...trades.map((t) => {
      const totalParts = t.totalPartsAtTrade.toNumber();
      const gainUsd = (t.navAfter.toNumber() - t.navBefore.toNumber()) * totalParts;
      const fee = t.feeLedgerEntries.reduce((s, f) => s + f.amount.toNumber(), 0);
      return {
        kind: "TRADE" as const,
        date: t.timestamp,
        pnlPct: t.pnlPct.toNumber(),
        gainUsd,
        fee,
        pair: t.pair,
        note: t.note,
      };
    }),
  ];

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  return entries.slice(0, limit);
}

export interface ClientTradeRow {
  date: Date;
  pair: string | null;
  pnlPct: number;
  balanceBefore: number;
  balanceAfter: number;
  gainUsd: number;
  cumulativeGainUsd: number;
}

/**
 * Historique de trades vu depuis la perspective d'un client, à parts
 * constantes (ses parts actuelles appliquées rétroactivement depuis sa
 * date d'entrée). Simplification assumée : si le client a fait un retrait
 * partiel entre-temps, les montants avant cette date restent approximatifs.
 */
export async function buildClientTradeLedger(params: { clientId: string; currentParts: number }) {
  const firstDeposit = await prisma.pendingMovement.findFirst({
    where: { clientId: params.clientId, type: "DEPOSIT", status: "COMPLETED" },
    orderBy: { processedAt: "asc" },
  });
  const joinDate = firstDeposit?.processedAt ?? null;

  const totalDepositedAgg = await prisma.pendingMovement.aggregate({
    where: { clientId: params.clientId, type: "DEPOSIT", status: "COMPLETED" },
    _sum: { amount: true },
  });
  const totalDeposited = totalDepositedAgg._sum.amount?.toNumber() ?? 0;

  if (!joinDate) return { joinDate: null, totalDeposited, rows: [] as ClientTradeRow[] };

  const trades = await prisma.trade.findMany({
    where: { timestamp: { gte: joinDate } },
    orderBy: { timestamp: "asc" },
  });

  let cumulative = 0;
  const rows: ClientTradeRow[] = trades.map((t) => {
    const balanceBefore = params.currentParts * t.navBefore.toNumber();
    const balanceAfter = params.currentParts * t.navAfter.toNumber();
    const gainUsd = balanceAfter - balanceBefore;
    cumulative += gainUsd;
    return {
      date: t.timestamp,
      pair: t.pair,
      pnlPct: t.pnlPct.toNumber(),
      balanceBefore,
      balanceAfter,
      gainUsd,
      cumulativeGainUsd: cumulative,
    };
  });

  return { joinDate, totalDeposited, rows };
}
