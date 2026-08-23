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
import { adjustPoolAssets, logManualTrade } from "@/lib/trades";
import { ALLOWED_LEVERAGES, computePositionPnlPct } from "@/lib/position";
import { createTestClient } from "@/lib/test-clients";
import { resetAllTestData } from "@/lib/admin-reset";
import type { TradeDirection } from "@prisma/client";

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
    const note = String(formData.get("note") ?? "");
    const mode = String(formData.get("mode") ?? "simple");

    if (mode === "position") {
      const pair = String(formData.get("pair") ?? "").trim();
      const direction = String(formData.get("direction") ?? "LONG") as TradeDirection;
      const entryPrice = Number(formData.get("entryPrice"));
      const exitPrice = Number(formData.get("exitPrice"));
      const positionSizePct = Number(formData.get("positionSizePct"));

      if (!pair) return { error: "Paire requise" };
      if ([entryPrice, exitPrice, positionSizePct].some((n) => Number.isNaN(n))) {
        return { error: "Prix d'entrée, prix de sortie et taille de position doivent être numériques" };
      }
      if (positionSizePct <= 0 || positionSizePct > 100) {
        return { error: "La taille de position doit être comprise entre 0 et 100% de l'AUM" };
      }
      const leverage = Number(formData.get("leverage") ?? "1");
      if (!ALLOWED_LEVERAGES.includes(leverage as (typeof ALLOWED_LEVERAGES)[number])) {
        return { error: "Levier invalide" };
      }

      const entryPriceD = new Decimal(entryPrice);
      const exitPriceD = new Decimal(exitPrice);
      const leverageD = new Decimal(leverage);
      const { pnlPctOfAum } = computePositionPnlPct({
        entryPrice: entryPriceD,
        exitPrice: exitPriceD,
        positionSizePct: new Decimal(positionSizePct),
        direction,
        leverage: leverageD,
      });

      await logManualTrade({
        pnlPct: pnlPctOfAum,
        note: note || undefined,
        loggedById: manager.id,
        position: {
          pair,
          direction,
          entryPrice: entryPriceD,
          exitPrice: exitPriceD,
          positionSizePct: new Decimal(positionSizePct),
          leverage: leverageD,
        },
      });
    } else {
      const pnlPct = Number(formData.get("pnlPct"));
      if (Number.isNaN(pnlPct)) return { error: "Résultat invalide" };
      await logManualTrade({ pnlPct: new Decimal(pnlPct), note: note || undefined, loggedById: manager.id });
    }

    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function adjustPoolAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const manager = await requireManager();
    const newTotalAssets = Number(formData.get("newTotalAssets"));
    const reason = String(formData.get("reason") ?? "");
    if (Number.isNaN(newTotalAssets)) return { error: "Montant invalide" };

    await adjustPoolAssets({
      newTotalAssets: new Decimal(newTotalAssets),
      reason,
      managerId: manager.id,
    });
    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function createTestClientAction(
  _prevState: { error: string | null; created: { email: string; password: string } | null },
  formData: FormData
): Promise<{ error: string | null; created: { email: string; password: string } | null }> {
  try {
    const manager = await requireManager();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const initialDeposit = Number(formData.get("initialDeposit"));

    if (!name) return { error: "Nom requis", created: null };
    if (!email) return { error: "Email requis", created: null };
    if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum", created: null };
    if (Number.isNaN(initialDeposit) || initialDeposit < 0) {
      return { error: "Dépôt initial invalide", created: null };
    }

    await createTestClient({
      name,
      email,
      password,
      initialDeposit: new Decimal(initialDeposit),
      managerId: manager.id,
    });

    revalidatePath("/manager");
    revalidatePath("/");
    return { error: null, created: { email: email.toLowerCase(), password } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue", created: null };
  }
}

export async function resetAllTestDataAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const manager = await requireManager();
    const confirmation = String(formData.get("confirm") ?? "");
    if (confirmation !== "RESET") {
      return { error: 'Tape exactement "RESET" pour confirmer' };
    }

    await resetAllTestData(manager.id);
    revalidatePath("/manager");
    revalidatePath("/client");
    revalidatePath("/");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
