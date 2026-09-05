import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export class AdminResetError extends Error {}

/**
 * Outil de test UNIQUEMENT : efface toutes les données financières (clients,
 * parts, trades, frais, mouvements, snapshots NAV, journal d'audit) et
 * remet le pool à zéro, pour repartir d'une base propre en développement.
 * Conserve les comptes gestionnaire (dont celui qui déclenche le reset) —
 * on ne se déconnecte pas soi-même. Ne doit jamais exister sur un
 * environnement de production réel avec de vrais fonds clients.
 */
export async function resetAllTestData(managerId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.feeWithdrawal.deleteMany();
    await tx.feeLedger.deleteMany();
    await tx.trade.deleteMany();
    await tx.navSnapshot.deleteMany();
    await tx.pendingMovement.deleteMany();
    await tx.clientHolding.deleteMany();
    await tx.user.deleteMany({ where: { role: "CLIENT" } });

    await tx.poolState.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {
        totalAssets: 0,
        totalParts: 0,
        cashBuffer: 0,
        highWaterMark: 1,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: managerId,
        actorRole: Role.MANAGER,
        action: "admin.full_test_reset",
        entityType: "PoolState",
        entityId: "1",
      },
    });
  });
}
