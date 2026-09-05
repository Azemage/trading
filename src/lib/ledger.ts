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
      tradingFeeUsd: number;
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
      const fee = t.feeLedgerEntries
        .filter((f) => f.type === "PERFORMANCE")
        .reduce((s, f) => s + f.amount.toNumber(), 0);
      return {
        kind: "TRADE" as const,
        date: t.timestamp,
        pnlPct: t.pnlPct.toNumber(),
        gainUsd,
        fee,
        tradingFeeUsd: t.tradingFeeUsd?.toNumber() ?? 0,
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
      tradingFeeUsd: number;
      perfFeeUsd: number;
      feeUsd: number;
      gainUsd: number;
      balanceBefore: number;
      balanceAfter: number;
    };

type TimelineEvent =
  | { kind: "DEPOSIT"; date: Date; amount: number; balanceBefore: number; balanceAfter: number }
  | { kind: "WITHDRAWAL"; date: Date; amount: number; balanceBefore: number; balanceAfter: number }
  | {
      kind: "TRADE";
      date: Date;
      tradeId: string;
      pnlPct: number;
      pair: string | null;
      balanceBefore: number;
      grossBalanceAfter: number; // avant performance fee
      balanceAfter: number; // net, après performance fee
    };

interface ClientTimeline {
  joinDate: Date | null;
  totalDeposited: number;
  events: TimelineEvent[];
}

/**
 * Reconstitue, pour TOUS les clients ayant déjà déposé, leur solde exact
 * dépôt par dépôt / trade par trade (mêmes principes que buildClientLedger :
 * ratio NAV appliqué uniformément, performance fee jamais déduite deux
 * fois). Nécessaire pour la répartition des frais au centime près
 * ci-dessous, qui doit connaître le poids de CHAQUE client dans le pool à
 * chaque trade, pas seulement celui du client affiché.
 */
async function buildClientTimelines(): Promise<Map<string, ClientTimeline>> {
  const [deposits, withdrawals, trades] = await Promise.all([
    prisma.pendingMovement.findMany({
      where: { type: "DEPOSIT", status: "COMPLETED" },
      orderBy: { processedAt: "asc" },
    }),
    prisma.pendingMovement.findMany({
      where: { type: "WITHDRAWAL", status: "COMPLETED" },
      orderBy: { processedAt: "asc" },
    }),
    prisma.trade.findMany({ orderBy: { timestamp: "asc" } }),
  ]);

  const depositsByClient = new Map<string, typeof deposits>();
  for (const d of deposits) {
    if (!d.processedAt) continue;
    const list = depositsByClient.get(d.clientId) ?? [];
    list.push(d);
    depositsByClient.set(d.clientId, list);
  }
  const withdrawalsByClient = new Map<string, typeof withdrawals>();
  for (const w of withdrawals) {
    if (!w.processedAt) continue;
    const list = withdrawalsByClient.get(w.clientId) ?? [];
    list.push(w);
    withdrawalsByClient.set(w.clientId, list);
  }

  const timelines = new Map<string, ClientTimeline>();

  for (const [clientId, clientDeposits] of depositsByClient) {
    const joinDate = clientDeposits[0].processedAt!;
    const totalDeposited = clientDeposits.reduce((s, d) => s + d.amount.toNumber(), 0);
    const clientWithdrawals = withdrawalsByClient.get(clientId) ?? [];
    const clientTrades = trades.filter((t) => t.timestamp.getTime() >= joinDate.getTime());

    type Raw =
      | { date: Date; kind: "DEPOSIT"; amount: number }
      | { date: Date; kind: "WITHDRAWAL"; amount: number }
      | {
          date: Date;
          kind: "TRADE";
          tradeId: string;
          navBefore: number;
          navAfter: number;
          pnlPct: number;
          pair: string | null;
        };

    const raw: Raw[] = [
      ...clientDeposits.map((d) => ({ date: d.processedAt!, kind: "DEPOSIT" as const, amount: d.amount.toNumber() })),
      ...clientWithdrawals.map((w) => ({
        date: w.processedAt!,
        kind: "WITHDRAWAL" as const,
        amount: w.grantedAmount?.toNumber() ?? 0,
      })),
      ...clientTrades.map((t) => ({
        date: t.timestamp,
        kind: "TRADE" as const,
        tradeId: t.id,
        navBefore: t.navBefore.toNumber(),
        navAfter: t.navAfter.toNumber(),
        pnlPct: t.pnlPct.toNumber(),
        pair: t.pair,
      })),
    ];
    raw.sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    const events: TimelineEvent[] = raw.map((r) => {
      const balanceBefore = balance;
      if (r.kind === "DEPOSIT") {
        balance = balanceBefore + r.amount;
        return { kind: "DEPOSIT", date: r.date, amount: r.amount, balanceBefore, balanceAfter: balance };
      }
      if (r.kind === "WITHDRAWAL") {
        balance = balanceBefore - r.amount;
        return { kind: "WITHDRAWAL", date: r.date, amount: r.amount, balanceBefore, balanceAfter: balance };
      }
      const grossBalanceAfter = balanceBefore * (1 + r.pnlPct / 100);
      balance = r.navBefore > 0 ? balanceBefore * (r.navAfter / r.navBefore) : balanceBefore;
      return {
        kind: "TRADE",
        date: r.date,
        tradeId: r.tradeId,
        pnlPct: r.pnlPct,
        pair: r.pair,
        balanceBefore,
        grossBalanceAfter,
        balanceAfter: balance,
      };
    });

    timelines.set(clientId, { joinDate, totalDeposited, events });
  }

  return timelines;
}

/**
 * Répartit un montant exact (`targetTotal`, en dollars) en centimes entiers
 * entre plusieurs parts, en garantissant que la somme des parts arrondies
 * reconstitue EXACTEMENT `targetTotal` au centime — jamais un écart comme
 * 7,44$ réel affiché en 7,47$ une fois les parts client additionnées.
 *
 * Méthode du plus grand reste : chaque part est d'abord arrondie au
 * centime inférieur, puis les centimes manquants sont distribués un par un
 * aux parts dont la portion décimale tronquée était la plus grande — donc
 * si un centime doit être arrondi "vers le haut" quelque part, il est
 * automatiquement compensé par un arrondi "vers le bas" ailleurs.
 *
 * Filet de sécurité symétrique : si la somme des montants exacts fournis
 * s'écarte légèrement de `targetTotal` (dérive résiduelle de calcul) au
 * point que même l'arrondi au centime inférieur dépasse la cible, les
 * centimes en trop sont retirés aux parts dont le reste tronqué était le
 * plus PETIT — la somme finale reconstitue toujours exactement la cible,
 * jamais un dépassement ni un manque.
 */
function allocateCentsByLargestRemainder(shares: { key: string; amount: number }[], targetTotal: number): Map<string, number> {
  const targetCents = Math.round(targetTotal * 100);
  const result = new Map<string, number>();
  if (shares.length === 0) return result;
  if (targetCents <= 0) {
    for (const s of shares) result.set(s.key, 0);
    return result;
  }

  const withRemainders = shares.map((s) => {
    const exactCents = Math.max(s.amount, 0) * 100;
    const floorCents = Math.floor(exactCents);
    return { key: s.key, floorCents, remainder: exactCents - floorCents };
  });

  const baseSum = withRemainders.reduce((sum, s) => sum + s.floorCents, 0);
  for (const s of withRemainders) result.set(s.key, s.floorCents);

  const diff = targetCents - baseSum;
  if (diff > 0) {
    const byLargestRemainder = [...withRemainders].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < Math.min(diff, byLargestRemainder.length); i++) {
      const key = byLargestRemainder[i].key;
      result.set(key, (result.get(key) ?? 0) + 1);
    }
  } else if (diff < 0) {
    const bySmallestRemainder = [...withRemainders].sort((a, b) => a.remainder - b.remainder);
    let toRemove = -diff;
    for (const s of bySmallestRemainder) {
      if (toRemove <= 0) break;
      const current = result.get(s.key) ?? 0;
      if (current > 0) {
        result.set(s.key, current - 1);
        toRemove -= 1;
      }
    }
  }

  return result;
}

/**
 * Pour chaque trade, répartit le frais de trading (indicatif) et la
 * performance fee réellement prélevée (source de vérité : FeeLedger) entre
 * tous les clients qui détenaient une part du pool à ce moment-là, au
 * centime près et sans écart d'arrondi cumulé — voir
 * allocateCentsByLargestRemainder ci-dessus.
 */
async function computeReconciledTradeFees(
  timelines: Map<string, ClientTimeline>
): Promise<Map<string, Map<string, { tradingFeeUsd: number; perfFeeUsd: number }>>> {
  const tradeIds = new Set<string>();
  for (const timeline of timelines.values()) {
    for (const event of timeline.events) {
      if (event.kind === "TRADE") tradeIds.add(event.tradeId);
    }
  }
  if (tradeIds.size === 0) return new Map();

  const [trades, feeEntries] = await Promise.all([
    prisma.trade.findMany({ where: { id: { in: [...tradeIds] } } }),
    prisma.feeLedger.findMany({ where: { tradeId: { in: [...tradeIds] } } }),
  ]);
  const tradeById = new Map(trades.map((t) => [t.id, t]));
  const feesByTrade = new Map<string, { trading: number; performance: number }>();
  for (const f of feeEntries) {
    if (!f.tradeId) continue;
    const entry = feesByTrade.get(f.tradeId) ?? { trading: 0, performance: 0 };
    if (f.type === "TRADING") entry.trading += f.amount.toNumber();
    if (f.type === "PERFORMANCE") entry.performance += f.amount.toNumber();
    feesByTrade.set(f.tradeId, entry);
  }

  const participantsByTrade = new Map<
    string,
    { clientId: string; balanceBefore: number; grossBalanceAfter: number; balanceAfter: number }[]
  >();
  for (const [clientId, timeline] of timelines) {
    for (const event of timeline.events) {
      if (event.kind !== "TRADE") continue;
      const list = participantsByTrade.get(event.tradeId) ?? [];
      list.push({
        clientId,
        balanceBefore: event.balanceBefore,
        grossBalanceAfter: event.grossBalanceAfter,
        balanceAfter: event.balanceAfter,
      });
      participantsByTrade.set(event.tradeId, list);
    }
  }

  const result = new Map<string, Map<string, { tradingFeeUsd: number; perfFeeUsd: number }>>();
  for (const [tradeId, participants] of participantsByTrade) {
    const trade = tradeById.get(tradeId);
    const fees = feesByTrade.get(tradeId) ?? { trading: 0, performance: 0 };
    const tradingFeeTotal = trade?.tradingFeeUsd?.toNumber() ?? 0;

    const totalBalanceBefore = participants.reduce((s, p) => s + p.balanceBefore, 0);
    const tradingCents = allocateCentsByLargestRemainder(
      participants.map((p) => ({
        key: p.clientId,
        amount: totalBalanceBefore > 0 ? (p.balanceBefore / totalBalanceBefore) * tradingFeeTotal : 0,
      })),
      tradingFeeTotal
    );
    // Comme pour le frais de trading : chaque part est normalisée par rapport
    // au poids du client dans le pool (balanceBefore / totalBalanceBefore),
    // PAS par son propre calcul brut/net indépendant. Ce dernier peut dériver
    // légèrement du vrai total (arrondis accumulés sur les trades précédents
    // dans la reconstitution du solde de chaque client) ; normaliser par
    // rapport au total réel garantit que la somme des parts vaut TOUJOURS
    // exactement fees.performance, sans possibilité de dépassement.
    const perfCents = allocateCentsByLargestRemainder(
      participants.map((p) => ({
        key: p.clientId,
        amount: totalBalanceBefore > 0 ? (p.balanceBefore / totalBalanceBefore) * fees.performance : 0,
      })),
      fees.performance
    );

    const perClient = new Map<string, { tradingFeeUsd: number; perfFeeUsd: number }>();
    for (const p of participants) {
      perClient.set(p.clientId, {
        tradingFeeUsd: (tradingCents.get(p.clientId) ?? 0) / 100,
        perfFeeUsd: (perfCents.get(p.clientId) ?? 0) / 100,
      });
    }
    result.set(tradeId, perClient);
  }

  return result;
}

/**
 * Historique complet et chronologique d'un client : ses dépôts/retraits
 * réalisés, entrelacés avec tous les trades du pool depuis son entrée,
 * chacun avec l'impact exact sur SON solde.
 *
 * Le calcul du solde est exact (pas une approximation) : chaque trade fait
 * évoluer le solde du client par le même ratio NAV_après/NAV_avant que
 * pour le pool entier (ses parts ne changent pas pendant un trade), et
 * chaque dépôt/retrait ajoute/retranche exactement le montant réel — donc
 * même un retrait partiel entre deux trades reste correctement reflété.
 *
 * Les colonnes "Frais trading" et "Frais perf." affichées, elles, sont
 * arrondies au centime avec réconciliation entre tous les clients (voir
 * computeReconciledTradeFees) : leur somme sur tous les clients reconstitue
 * toujours exactement le montant réel prélevé, jamais un écart de quelques
 * centimes dû à des arrondis indépendants ligne par ligne.
 */
export async function buildClientLedger(clientId: string) {
  const timelines = await buildClientTimelines();
  const timeline = timelines.get(clientId);
  if (!timeline?.joinDate) {
    return { joinDate: null as Date | null, totalDeposited: 0, entries: [] as ClientLedgerEntry[] };
  }

  const reconciledFees = await computeReconciledTradeFees(timelines);

  const entries: ClientLedgerEntry[] = timeline.events.map((event) => {
    if (event.kind !== "TRADE") return event;
    const reconciled = reconciledFees.get(event.tradeId)?.get(clientId) ?? { tradingFeeUsd: 0, perfFeeUsd: 0 };
    return {
      kind: "TRADE",
      date: event.date,
      pnlPct: event.pnlPct,
      pair: event.pair,
      grossGainUsd: event.grossBalanceAfter - event.balanceBefore,
      tradingFeeUsd: reconciled.tradingFeeUsd,
      perfFeeUsd: reconciled.perfFeeUsd,
      feeUsd: reconciled.perfFeeUsd,
      gainUsd: event.balanceAfter - event.balanceBefore,
      balanceBefore: event.balanceBefore,
      balanceAfter: event.balanceAfter,
    };
  });

  return { joinDate: timeline.joinDate, totalDeposited: timeline.totalDeposited, entries };
}
