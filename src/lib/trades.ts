import { Decimal } from "@prisma/client/runtime/library";
import { FeeType, Prisma, Role, TradeSource } from "@prisma/client";
import { prisma } from "./prisma";
import { applyTradeResult } from "./fees";
import { d } from "./nav";

class TradeError extends Error {}

async function lockPoolState(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<
    { id: number; totalAssets: Decimal; totalParts: Decimal; highWaterMark: Decimal }[]
  >`SELECT * FROM pool_state WHERE id = 1 FOR UPDATE`;
  if (!rows[0]) throw new TradeError("pool_state introuvable");
  return rows[0];
}

/** Saisie manuelle par le gestionnaire d'un résultat de trading (% de l'AUM). */
export async function logManualTrade(params: {
  pnlPct: Decimal;
  note?: string;
  loggedById: string;
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
