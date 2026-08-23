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

export type ClientLedgerEntry =
  | { kind: "DEPOSIT"; date: Date; amount: number; balanceBefore: number; balanceAfter: number }
  | { kind: "WITHDRAWAL"; date: Date; amount: number; balanceBefore: number; balanceAfter: number }
  | {
      kind: "TRADE";
      date: Date;
      pnlPct: number;
      pair: string | null;
      grossGainUsd: number;
      feeUsd: number;
      gainUsd: number;
      balanceBefore: number;
      balanceAfter: number;
    };

/**
 * Historique complet et chronologique d'un client : ses dépôts/retraits
 * réalisés, entrelacés avec tous les trades du pool depuis son entrée,
 * chacun avec l'impact exact sur SON solde.
 *
 * Le calcul est exact (pas une approximation) : chaque trade fait évoluer
 * le solde du client par le même ratio NAV_après/NAV_avant que pour le
 * pool entier (ses parts ne changent pas pendant un trade), et chaque
 * dépôt/retrait ajoute/retranche exactement le montant réel — donc même
 * un retrait partiel entre deux trades reste correctement reflété.
 */
export async function buildClientLedger(clientId: string) {
  const [deposits, withdrawals] = await Promise.all([
    prisma.pendingMovement.findMany({
      where: { clientId, type: "DEPOSIT", status: "COMPLETED" },
      orderBy: { processedAt: "asc" },
    }),
    prisma.pendingMovement.findMany({
      where: { clientId, type: "WITHDRAWAL", status: "COMPLETED" },
      orderBy: { processedAt: "asc" },
    }),
  ]);

  const firstDeposit = deposits[0];
  if (!firstDeposit?.processedAt) {
    return { joinDate: null as Date | null, totalDeposited: 0, entries: [] as ClientLedgerEntry[] };
  }
  const joinDate = firstDeposit.processedAt;
  const totalDeposited = deposits.reduce((s, d) => s + d.amount.toNumber(), 0);

  const trades = await prisma.trade.findMany({
    where: { timestamp: { gte: joinDate } },
    orderBy: { timestamp: "asc" },
  });

  type RawEvent =
    | { date: Date; kind: "DEPOSIT"; amount: number }
    | { date: Date; kind: "WITHDRAWAL"; amount: number }
    | { date: Date; kind: "TRADE"; navBefore: number; navAfter: number; pnlPct: number; pair: string | null };

  const raw: RawEvent[] = [
    ...deposits.map((d) => ({ date: d.processedAt!, kind: "DEPOSIT" as const, amount: d.amount.toNumber() })),
    ...withdrawals
      .filter((w) => w.processedAt)
      .map((w) => ({
        date: w.processedAt!,
        kind: "WITHDRAWAL" as const,
        amount: w.grantedAmount?.toNumber() ?? 0,
      })),
    ...trades.map((t) => ({
      date: t.timestamp,
      kind: "TRADE" as const,
      navBefore: t.navBefore.toNumber(),
      navAfter: t.navAfter.toNumber(),
      pnlPct: t.pnlPct.toNumber(),
      pair: t.pair,
    })),
  ];
  raw.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const entries: ClientLedgerEntry[] = raw.map((r) => {
    const balanceBefore = balance;
    if (r.kind === "DEPOSIT") {
      balance = balanceBefore + r.amount;
      return { kind: "DEPOSIT", date: r.date, amount: r.amount, balanceBefore, balanceAfter: balance };
    }
    if (r.kind === "WITHDRAWAL") {
      balance = balanceBefore - r.amount;
      return { kind: "WITHDRAWAL", date: r.date, amount: r.amount, balanceBefore, balanceAfter: balance };
    }
    // Solde brut (avant frais) : le % de résultat appliqué directement au solde.
    const grossBalanceAfter = balanceBefore * (1 + r.pnlPct / 100);
    // Solde net (après frais) : même ratio NAV net que celui réellement appliqué au pool.
    balance = r.navBefore > 0 ? balanceBefore * (r.navAfter / r.navBefore) : balanceBefore;
    const feeUsd = Math.max(grossBalanceAfter - balance, 0);
    return {
      kind: "TRADE",
      date: r.date,
      pnlPct: r.pnlPct,
      pair: r.pair,
      grossGainUsd: grossBalanceAfter - balanceBefore,
      feeUsd,
      gainUsd: balance - balanceBefore,
      balanceBefore,
      balanceAfter: balance,
    };
  });

  return { joinDate, totalDeposited, entries };
}
