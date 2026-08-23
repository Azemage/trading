import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

export class KycError extends Error {}

/**
 * Soumission KYC par le client. Autorisée si aucune soumission n'existe
 * encore, ou si la dernière a été rejetée (permet de resoumettre après
 * correction). Une soumission approuvée ou en attente bloque une nouvelle
 * soumission tant qu'elle n'a pas été traitée ou rejetée.
 */
export async function submitKyc(params: {
  clientId: string;
  legalName: string;
  documentType: string;
  documentNumber: string;
  note?: string;
}) {
  if (!params.legalName.trim() || !params.documentType.trim() || !params.documentNumber.trim()) {
    throw new KycError("Nom légal, type et numéro de document sont requis");
  }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.kycSubmission.findFirst({
      where: { clientId: params.clientId },
      orderBy: { submittedAt: "desc" },
    });
    if (latest && latest.status !== "REJECTED") {
      throw new KycError(
        latest.status === "APPROVED"
          ? "Ta vérification KYC est déjà approuvée"
          : "Une soumission est déjà en attente de revue"
      );
    }

    const submission = await tx.kycSubmission.create({
      data: {
        clientId: params.clientId,
        legalName: params.legalName.trim(),
        documentType: params.documentType.trim(),
        documentNumber: params.documentNumber.trim(),
        note: params.note?.trim() || undefined,
      },
    });

    await tx.user.update({ where: { id: params.clientId }, data: { kycStatus: "PENDING" } });

    await logAudit(tx, {
      actorId: params.clientId,
      actorRole: Role.CLIENT,
      action: "kyc.submitted",
      entityType: "KycSubmission",
      entityId: submission.id,
    });

    return submission;
  });
}

export async function reviewKyc(params: {
  submissionId: string;
  approve: boolean;
  reason?: string;
  managerId: string;
}) {
  if (!params.approve && !params.reason?.trim()) {
    throw new KycError("Un motif est requis pour rejeter une soumission KYC");
  }

  return prisma.$transaction(async (tx) => {
    const submission = await tx.kycSubmission.findUnique({ where: { id: params.submissionId } });
    if (!submission) throw new KycError("Soumission introuvable");
    if (submission.status !== "PENDING") {
      throw new KycError("Cette soumission n'est plus en attente de revue");
    }

    const updated = await tx.kycSubmission.update({
      where: { id: params.submissionId },
      data: {
        status: params.approve ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewedById: params.managerId,
        rejectionReason: params.approve ? undefined : params.reason,
      },
    });

    await tx.user.update({
      where: { id: submission.clientId },
      data: { kycStatus: params.approve ? "VERIFIED" : "REJECTED" },
    });

    await logAudit(tx, {
      actorId: params.managerId,
      actorRole: Role.MANAGER,
      action: params.approve ? "kyc.approved" : "kyc.rejected",
      entityType: "KycSubmission",
      entityId: submission.id,
      details: params.approve ? undefined : { reason: params.reason },
    });

    return updated;
  });
}
