import { Decimal } from "@prisma/client/runtime/library";
import { FeeType, Prisma, Role, TradeDirection, TradeSource } from "@prisma/client";
import { prisma } from "./prisma";
import { applyTradeResult } from "./fees";
import { computeNav, d } from "./nav";

class TradeError extends Error {}

async function lockPoolState(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<
    { id: number; totalAssets: Decimal; totalParts: Decimal; highWaterMark: Decimal }[]
  >`SELECT * FROM pool_state WHERE id = 1 FOR UPDATE`;
  if (!rows[0]) throw new TradeError("pool_state introuvable");
  return rows[0];
}

/** Saisie manuelle par le gestionnaire d'un résultat de trading (% de l'AUM).
 * `position` est optionnel : renseigné uniquement quand le trade est saisi par
 * paire (prix d'entrée/sortie) plutôt qu'en % direct — conservé pour la
 * traçabilité du registre, n'affecte pas le calcul (déjà fait dans pnlPct). */
export async function logManualTrade(params: {
  pnlPct: Decimal;
  note?: string;
  loggedById: string;
  position?: {
    pair: string;
    direction: TradeDirection;
    entryPrice: Decimal;
    exitPrice: Decimal;
    positionSizePct: Decimal;
  };
}) {
  return prisma.$transaction(async (tx) => {
    const pool = await lockPoolState(tx);
    if (d(pool.totalAssets).lessThanOrEqualTo(0)) {
      throw new TradeError("Le pool est vide, aucun trade ne peut être enregistré");
    }

    const result = applyTradeResult({
      totalAssetsBefore: pool.totalAssets,
      totalParts: pool.totalParts,
      pnlPct: params.pnlPct,
      highWaterMark: pool.highWaterMark,
    });

    await tx.poolState.update({
      where: { id: 1 },
      data: {
        totalAssets: result.totalAssetsAfterNet,
        highWaterMark: result.newHighWaterMark,
      },
    });

    const trade = await tx.trade.create({
      data: {
        source: TradeSource.MANUAL,
        pnlPct: params.pnlPct,
        navBefore: result.navBefore,
        navAfter: result.navAfterNet,
        note: params.note,
        loggedById: params.loggedById,
        pair: params.position?.pair,
        direction: params.position?.direction,
        entryPrice: params.position?.entryPrice,
        exitPrice: params.position?.exitPrice,
        positionSizePct: params.position?.positionSizePct,
      },
    });

    if (result.fee.greaterThan(0)) {
      await tx.feeLedger.create({
        data: { type: FeeType.PERFORMANCE, amount: result.fee, tradeId: trade.id },
      });
    }

    await tx.navSnapshot.create({
      data: {
        nav: result.navAfterNet,
        totalAssets: result.totalAssetsAfterNet,
        totalParts: pool.totalParts,
        reason: "TRADE",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.loggedById,
        actorRole: Role.MANAGER,
        action: "trade.logged",
        entityType: "Trade",
        entityId: trade.id,
        details: {
          pnlPct: params.pnlPct.toString(),
          fee: result.fee.toString(),
          navAfter: result.navAfterNet.toString(),
        },
      },
    });

    return trade;
  });
}

/**
 * Outil de test/correction : impose directement une nouvelle valeur d'AUM
 * total (donc un nouveau NAV, à parts constantes), sans passer par un trade.
 * Ne prélève AUCUN frais et ne touche PAS le high-water mark — ce n'est pas
 * un gain de trading réel, juste un ajustement (ex: correction comptable,
 * mise en place d'un scénario de test). Motif obligatoire, tracé en audit.
 */
export async function adjustPoolAssets(params: {
  newTotalAssets: Decimal;
  reason: string;
  managerId: string;
}) {
  if (params.newTotalAssets.lessThan(0)) {
    throw new TradeError("L'AUM ne peut pas être négatif");
  }
  if (!params.reason.trim()) {
    throw new TradeError("Un motif est requis pour ajuster le pool manuellement");
  }

  return prisma.$transaction(async (tx) => {
    const pool = await lockPoolState(tx);
    const navBefore = computeNav(pool.totalAssets, pool.totalParts);

    await tx.poolState.update({
      where: { id: 1 },
      data: { totalAssets: params.newTotalAssets },
    });

    const navAfter = computeNav(params.newTotalAssets, pool.totalParts);

    await tx.navSnapshot.create({
      data: {
        nav: navAfter,
        totalAssets: params.newTotalAssets,
        totalParts: pool.totalParts,
        reason: "MANUAL_ADJUSTMENT",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: params.managerId,
        actorRole: Role.MANAGER,
        action: "pool.manual_adjustment",
        entityType: "PoolState",
        entityId: "1",
        details: {
          reason: params.reason,
          totalAssetsBefore: pool.totalAssets.toString(),
          totalAssetsAfter: params.newTotalAssets.toString(),
          navBefore: navBefore.toString(),
          navAfter: navAfter.toString(),
        },
      },
    });

    return { navBefore, navAfter };
  });
}

/** Ouvre une nouvelle période de gate (remise à zéro du compteur mensuel). */
export async function resetGatePeriod(managerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.poolState.update({
      where: { id: 1 },
      data: { gateUsedThisPeriod: 0, gatePeriodStart: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: managerId,
        actorRole: Role.MANAGER,
        action: "gate.period_reset",
        entityType: "PoolState",
        entityId: "1",
      },
    });
  });
}
