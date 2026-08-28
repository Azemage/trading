import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { computeNav, d } from "./nav";
import { AppError } from "./app-error";

export class TestClientError extends AppError {}

async function lockPoolState(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<
    { id: number; totalAssets: Decimal; totalParts: Decimal }[]
  >`SELECT * FROM pool_state WHERE id = 1 FOR UPDATE`;
  if (!rows[0]) throw new TestClientError("POOL_STATE_NOT_FOUND");
  return rows[0];
}

/**
 * Outil de test : crée un compte client et le crédite immédiatement d'un
 * dépôt (sans passer par le workflow d'attente/validation), pour observer
 * rapidement comment un solde/des parts réagissent selon différents montants.
 * Le NAV n'est pas affecté (actifs et parts ajoutés proportionnellement,
 * exactement comme un dépôt réel approuvé).
 */
export async function createTestClient(params: {
  name: string;
  email: string;
  password: string;
  initialDeposit: Decimal;
  managerId: string;
}) {
  if (params.initialDeposit.lessThan(0)) {
    throw new TestClientError("TEST_CLIENT_NEGATIVE_DEPOSIT");
  }

  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new TestClientError("REGISTER_EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(params.password, 12);

  return prisma.$transaction(async (tx) => {
    const pool = await lockPoolState(tx);
    const nav = computeNav(pool.totalAssets, pool.totalParts);
    const parts = params.initialDeposit.greaterThan(0)
      ? d(params.initialDeposit).dividedBy(nav)
      : new Decimal(0);

    const client = await tx.user.create({
      data: { email, name: params.name, passwordHash, role: "CLIENT" },
    });

    await tx.clientHolding.create({ data: { clientId: client.id, parts } });

    if (params.initialDeposit.greaterThan(0)) {
      const newTotalAssets = d(pool.totalAssets).plus(params.initialDeposit);
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
          reason: "TEST_CLIENT_SEED",
        },
      });

      // Enregistrement d'un mouvement "complété" pour que ce dépôt de test
      // apparaisse comme n'importe quel autre dans l'historique du client et
      // la fiche de calcul du gestionnaire (même s'il a été crédité
      // directement, sans passer par le workflow d'attente).
      const now = new Date();
      await tx.pendingMovement.create({
        data: {
          clientId: client.id,
          type: "DEPOSIT",
          amount: params.initialDeposit,
          navAtRequest: nav,
          status: "COMPLETED",
          requestedAt: now,
          eligibleAt: now,
          processedAt: now,
          processedById: params.managerId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: params.managerId,
        actorRole: Role.MANAGER,
        action: "test_client.created",
        entityType: "User",
        entityId: client.id,
        details: {
          email,
          initialDeposit: params.initialDeposit.toString(),
          partsIssued: parts.toString(),
        },
      },
    });

    return { client, parts };
  });
}
