import type { Prisma, Role } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Écriture seule — aucune fonction update/delete sur audit_log n'existe dans
 * le code applicatif. Voir README pour la garantie de traçabilité attendue.
 */
export async function logAudit(
  tx: Tx,
  entry: {
    actorId: string | null;
    actorRole: Role | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  }
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details as Prisma.InputJsonValue | undefined,
    },
  });
}
