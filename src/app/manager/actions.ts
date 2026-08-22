"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  approveDeposit,
  markWithdrawalSent,
  rejectDeposit,
  rejectWithdrawal,
} from "@/lib/movements";
import { logManualTrade, resetGatePeriod } from "@/lib/trades";

async function requireManager() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MANAGER") {
    throw new Error("Non authentifié");
  }
  return session.user;
}

export async function approveDepositAction(movementId: string) {
  const manager = await requireManager();
  await approveDeposit(movementId, manager.id);
  revalidatePath("/manager");
}

export async function rejectDepositAction(movementId: string, formData: FormData) {
  const manager = await requireManager();
  const reason = String(formData.get("reason") ?? "Rejeté par le gestionnaire");
  await rejectDeposit(movementId, manager.id, reason);
  revalidatePath("/manager");
}

export async function sendWithdrawalAction(movementId: string, formData: FormData) {
  const manager = await requireManager();
  const txHash = String(formData.get("txHash") ?? "");
  await markWithdrawalSent(movementId, manager.id, txHash);
  revalidatePath("/manager");
}

export async function rejectWithdrawalAction(movementId: string, formData: FormData) {
  const manager = await requireManager();
  const reason = String(formData.get("reason") ?? "Rejeté par le gestionnaire");
  await rejectWithdrawal(movementId, manager.id, reason);
  revalidatePath("/manager");
}

export async function logTradeAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const manager = await requireManager();
    const pnlPct = Number(formData.get("pnlPct"));
    const note = String(formData.get("note") ?? "");
    if (Number.isNaN(pnlPct)) return { error: "Résultat invalide" };

    await logManualTrade({ pnlPct: new Decimal(pnlPct), note: note || undefined, loggedById: manager.id });
    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function resetGateAction() {
  const manager = await requireManager();
  await resetGatePeriod(manager.id);
  revalidatePath("/manager");
}
