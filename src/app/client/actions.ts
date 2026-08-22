"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requestDeposit, requestWithdrawal } from "@/lib/movements";

async function requireClient() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    throw new Error("Non authentifié");
  }
  return session.user;
}

export async function depositAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const user = await requireClient();
    const amount = Number(formData.get("amount"));
    if (!amount || amount <= 0) return { error: "Montant invalide" };

    await requestDeposit(user.id, new Decimal(amount));
    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function withdrawAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const user = await requireClient();
    const raw = String(formData.get("amount") ?? "");
    const amount = raw.trim().toLowerCase() === "all" ? "all" : Number(raw);
    if (amount !== "all" && (!amount || amount <= 0)) return { error: "Montant invalide" };

    await requestWithdrawal(user.id, amount === "all" ? "all" : new Decimal(amount));
    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
