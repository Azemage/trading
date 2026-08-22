import { Decimal } from "@prisma/client/runtime/library";
import { MovementStatus, MovementType, Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { computeNav, d } from "./nav";
import { computeGateRemaining, splitWithdrawal } from "./gate";
import { PENDING_MOVEMENT_DELAY_HOURS } from "./constants";
import { logAudit } from "./audit";

class MovementError extends Error {}

function eligibleAtFromNow() {
  return new Date(Date.now() + PENDING_MOVEMENT_DELAY_HOURS * 60 * 60 * 1000);
}

/** Verrouille la ligne pool_state pour la durée de la transaction (évite les
 * courses entre dépôts/retraits/trades concurrents sur le même pool). */
async function lockPoolState(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<
    { id: number; totalAssets: Decimal; totalParts: Decimal; gateUsedThisPeriod: Decimal; highWaterMark: Decimal }[]
  >`SELECT * FROM pool_state WHERE id = 1 FOR UPDATE`;
  if (!rows[0]) throw new MovementError("pool_state introuvable");
  return rows[0];
}

async function lockClientHolding(tx: Prisma.TransactionClient, clientId: string) {
  const rows = await tx.$queryRaw<
    { id: string; clientId: string; parts: Decimal }[]
  >`SELECT * FROM client_holdings WHERE "clientId" = ${clientId} FOR UPDATE`;
  return rows[0] ?? null;
}

export async function requestDeposit(clientId: string, amount: Decimal) {
  if (amount.lessThanOrEqualTo(0)) throw new MovementError("Montant invalide");

  return prisma.$transaction(async (tx) => {
    const pool = await lockPoolState(tx);
    const nav = computeNav(pool.totalAssets, pool.totalParts);

    const movement = await tx.pendingMovement.create({
      data: {
        clientId,
        type: MovementType.DEPOSIT,
        amount,
        navAtRequest: nav,
        status: MovementStatus.PENDING_CONFIRMATION,
        eligibleAt: eligibleAtFromNow(),
      },
    });

    await logAudit(tx, {
      actorId: clientId,
      actorRole: Role.CLIENT,
      action: "deposit.requested",
      entityType: "PendingMovement",
      entityId: movement.id,
      details: { amount: amount.toString(), navAtRequest: nav.toString() },
    });

    return movement;
  });
}

export async function approveDeposit(movementId: string, managerId: string) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.pendingMovement.findUnique({ where: { id: movementId } });
    if (!movement || movement.type !== MovementType.DEPOSIT) {
      throw new MovementError("Dépôt introuvable");
    }
    if (movement.status !== MovementStatus.PENDING_CONFIRMATION) {
      throw new MovementError("Ce dépôt n'est plus en attente de confirmation");
    }
    if (new Date() < movement.eligibleAt) {
      throw new MovementError("Délai de traitement (anti-arbitrage) non écoulé");
    }

    const pool = await lockPoolState(tx);
    // NAV figé à la demande — jamais recalculé à l'approbation (cf. brief §2).
    const navAtRequest = d(movement.navAtRequest);
    const parts = d(movement.amount).dividedBy(navAtRequest);

    await tx.clientHolding.upsert({
      where: { clientId: movement.clientId },
      create: { clientId: movement.clientId, parts },
      update: { parts: { increment: parts } },
    });

    const newTotalAssets = d(pool.totalAssets).plus(movement.amount);
    const newTotalParts = d(pool.totalParts).plus(parts);
    await tx.poolState.update({
      where: { id: 1 },
      data: { totalAssets: newTotalAssets, totalParts: newTotalParts },
    });

    await tx.navSnapshot.create({
      data: {
        nav: computeNav(newTotalAssets, newTotalParts),
        totalAssets: newTotalAssets,
        totalParts: newTotalParts,
        reason: "DEPOSIT",
      },
    });

    const updated = await tx.pendingMovement.update({
      where: { id: movementId },
      data: {
        status: MovementStatus.COMPLETED,
        processedAt: new Date(),
        processedById: managerId,
      },
    });

    await logAudit(tx, {
      actorId: managerId,
      actorRole: Role.MANAGER,
      action: "deposit.approved",
      entityType: "PendingMovement",
      entityId: movementId,
      details: { amount: movement.amount.toString(), partsIssued: parts.toString() },
    });

    return updated;
  });
}

export async function rejectDeposit(movementId: string, managerId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.pendingMovement.findUnique({ where: { id: movementId } });
    if (!movement || movement.type !== MovementType.DEPOSIT) {
      throw new MovementError("Dépôt introuvable");
    }
    if (movement.status !== MovementStatus.PENDING_CONFIRMATION) {
      throw new MovementError("Ce dépôt n'est plus en attente de confirmation");
    }

    const updated = await tx.pendingMovement.update({
      where: { id: movementId },
      data: {
        status: MovementStatus.REJECTED,
        processedAt: new Date(),
        processedById: managerId,
        rejectionReason: reason,
      },
    });

    await logAudit(tx, {
      actorId: managerId,
      actorRole: Role.MANAGER,
      action: "deposit.rejected",
      entityType: "PendingMovement",
      entityId: movementId,
      details: { reason },
    });

    return updated;
  });
}

export async function requestWithdrawal(
  clientId: string,
  amountOrAll: Decimal | "all"
) {
  return prisma.$transaction(async (tx) => {
    const pool = await lockPoolState(tx);
    const holding = await lockClientHolding(tx, clientId);
    const clientParts = holding ? d(holding.parts) : new Decimal(0);
    if (clientParts.lessThanOrEqualTo(0)) {
      throw new MovementError("Aucune part détenue par ce client");
    }

    const navAtRequest = computeNav(pool.totalAssets, pool.totalParts);
    const requestedAmount =
      amountOrAll === "all" ? clientParts.times(navAtRequest) : amountOrAll;
    if (requestedAmount.lessThanOrEqualTo(0)) throw new MovementError("Montant invalide");

    const gateRemaining = computeGateRemaining(pool.totalAssets, pool.gateUsedThisPeriod);
    const split = splitWithdrawal({
      requestedAmount,
      clientParts,
      navAtRequest,
      gateRemaining,
    });

    const newClientParts = clientParts.minus(split.grantedParts);
    await tx.clientHolding.update({
      where: { clientId },
      data: { parts: newClientParts },
    });

    const newTotalAssets = d(pool.totalAssets).minus(split.grantedValue);
    const newTotalParts = d(pool.totalParts).minus(split.grantedParts);
    await tx.poolState.update({
      where: { id: 1 },
      data: {
        totalAssets: newTotalAssets,
        totalParts: newTotalParts,
        gateUsedThisPeriod: d(pool.gateUsedThisPeriod).plus(split.grantedValue),
      },
    });

    await tx.navSnapshot.create({
      data: {
        nav: computeNav(newTotalAssets, newTotalParts),
        totalAssets: newTotalAssets,
        totalParts: newTotalParts,
        reason: "WITHDRAWAL",
      },
    });

    const movement = await tx.pendingMovement.create({
      data: {
        clientId,
        type: MovementType.WITHDRAWAL,
        amount: split.valueRequested,
        grantedAmount: split.grantedValue,
        deferredAmount: split.deferredValue,
        navAtRequest,
        status: MovementStatus.PENDING_EXECUTION,
        eligibleAt: eligibleAtFromNow(),
      },
    });

    await logAudit(tx, {
      actorId: clientId,
      actorRole: Role.CLIENT,
      action: "withdrawal.requested",
      entityType: "PendingMovement",
      entityId: movement.id,
      details: {
        valueRequested: split.valueRequested.toString(),
        grantedValue: split.grantedValue.toString(),
        deferredValue: split.deferredValue.toString(),
        navAtRequest: navAtRequest.toString(),
      },
    });

    return movement;
  });
}

export async function markWithdrawalSent(
  movementId: string,
  managerId: string,
  txHash: string
) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.pendingMovement.findUnique({ where: { id: movementId } });
    if (!movement || movement.type !== MovementType.WITHDRAWAL) {
      throw new MovementError("Retrait introuvable");
    }
    if (movement.status !== MovementStatus.PENDING_EXECUTION) {
      throw new MovementError("Ce retrait n'est plus en attente d'exécution");
    }
    if (new Date() < movement.eligibleAt) {
      throw new MovementError("Délai de traitement (anti-arbitrage) non écoulé");
    }
    if (!txHash.trim()) throw new MovementError("tx_hash requis pour marquer un envoi");

    const updated = await tx.pendingMovement.update({
      where: { id: movementId },
      data: {
        status: MovementStatus.COMPLETED,
        processedAt: new Date(),
        processedById: managerId,
        txHash,
      },
    });

    await logAudit(tx, {
      actorId: managerId,
      actorRole: Role.MANAGER,
      action: "withdrawal.sent",
      entityType: "PendingMovement",
      entityId: movementId,
      details: { txHash, grantedAmount: movement.grantedAmount?.toString() },
    });

    return updated;
  });
}

/** Annule un retrait pas encore envoyé : restitue les parts et l'AUM accordés. */
export async function rejectWithdrawal(
  movementId: string,
  managerId: string,
  reason: string
) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.pendingMovement.findUnique({ where: { id: movementId } });
    if (!movement || movement.type !== MovementType.WITHDRAWAL) {
      throw new MovementError("Retrait introuvable");
    }
    if (movement.status !== MovementStatus.PENDING_EXECUTION) {
      throw new MovementError("Ce retrait n'est plus en attente d'exécution");
    }

    const pool = await lockPoolState(tx);
    const grantedValue = d(movement.grantedAmount ?? 0);
    const navAtRequest = d(movement.navAtRequest);
    const grantedParts = grantedValue.dividedBy(navAtRequest);

    if (grantedValue.greaterThan(0)) {
      await tx.clientHolding.update({
        where: { clientId: movement.clientId },
        data: { parts: { increment: grantedParts } },
      });
      await tx.poolState.update({
        where: { id: 1 },
        data: {
          totalAssets: { increment: grantedValue },
          totalParts: { increment: grantedParts },
          gateUsedThisPeriod: d(pool.gateUsedThisPeriod).minus(grantedValue),
        },
      });
    }

    const updated = await tx.pendingMovement.update({
      where: { id: movementId },
      data: {
        status: MovementStatus.REJECTED,
        processedAt: new Date(),
        processedById: managerId,
        rejectionReason: reason,
      },
    });

    await logAudit(tx, {
      actorId: managerId,
      actorRole: Role.MANAGER,
      action: "withdrawal.rejected",
      entityType: "PendingMovement",
      entityId: movementId,
      details: { reason, restoredValue: grantedValue.toString() },
    });

    return updated;
  });
}
