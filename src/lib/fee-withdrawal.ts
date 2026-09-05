import { Decimal } from "@prisma/client/runtime/library";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError } from "./app-error";

export class FeeWithdrawalError extends AppError {}

/**
 * Les performance fees prélevées à chaque trade ne quittent jamais
 * physiquement la plateforme de trading : elles sont seulement retranchées
 * de l'AUM (argent des clients) dans le calcul interne. Le montant réel
 * "disponible" pour le gestionnaire est donc tout ce qui a été prélevé
 * (FeeLedger PERFORMANCE) moins ce qui a déjà été retiré (FeeWithdrawal).
 */
export async function getPerformanceFeeSummary() {
  const [earnedAgg, withdrawnAgg] = await Promise.all([
    prisma.feeLedger.aggregate({ where: { type: "PERFORMANCE" }, _sum: { amount: true } }),
    prisma.feeWithdrawal.aggregate({ _sum: { amount: true } }),
  ]);
  const earned = earnedAgg._sum.amount ?? new Decimal(0);
  const withdrawn = withdrawnAgg._sum.amount ?? new Decimal(0);
  const available = Decimal.max(earned.minus(withdrawn), 0);
  return { earned, withdrawn, available };
}

/**
 * Enregistre un retrait de performance fee par le gestionnaire. N'affecte
 * jamais le pool commun (pool_state) ni les parts clients — c'est de
 * l'argent déjà comptablement sorti de l'AUM, cette écriture ne fait que
 * tracer sa sortie physique de la plateforme de trading.
 *
 * Pas de verrou de ligne ici (contrairement aux mouvements clients) : seul
 * un gestionnaire authentifié peut appeler cette fonction, et le risque de
 * concurrence entre deux retraits simultanés du même gestionnaire est
 * négligeable en pratique.
 */
export async function withdrawPerformanceFees(params: { amount: Decimal; managerId: string; note?: string }) {
  if (params.amount.lessThanOrEqualTo(0)) {
    throw new FeeWithdrawalError("FEE_WITHDRAWAL_INVALID_AMOUNT");
  }

  const { available } = await getPerformanceFeeSummary();
  if (params.amount.greaterThan(available)) {
    throw new FeeWithdrawalError("FEE_WITHDRAWAL_EXCEEDS_AVAILABLE");
  }

  const withdrawal = await prisma.feeWithdrawal.create({
    data: { amount: params.amount, note: params.note, managerId: params.managerId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: params.managerId,
      actorRole: Role.MANAGER,
      action: "fee.performance_withdrawn",
      entityType: "FeeWithdrawal",
      entityId: withdrawal.id,
      details: { amount: params.amount.toString(), note: params.note ?? null },
    },
  });

  return withdrawal;
}
