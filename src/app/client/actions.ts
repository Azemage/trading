"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requestDeposit, requestWithdrawal } from "@/lib/movements";
import { submitKyc, KycError } from "@/lib/kyc";
import { updateUsdcAddress, AccountError } from "@/lib/account";
import { notifyManagers, emailTemplates } from "@/lib/email";
import type { UsdcNetworkValue } from "@/lib/usdc";

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
    await notifyManagers("Nouvelle demande de dépôt", emailTemplates.managerNewDeposit(user.name ?? "", amount));
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

    const movement = await requestWithdrawal(user.id, amount === "all" ? "all" : new Decimal(amount));
    await notifyManagers(
      "Nouvelle demande de retrait",
      emailTemplates.managerNewWithdrawal(user.name ?? "", movement.amount.toNumber())
    );
    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function submitKycAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const user = await requireClient();
    await submitKyc({
      clientId: user.id,
      legalName: String(formData.get("legalName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    await notifyManagers("Nouvelle soumission KYC", emailTemplates.managerNewKyc(user.name ?? ""));
    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    if (e instanceof KycError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

export async function updateUsdcAddressAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const user = await requireClient();
    await updateUsdcAddress({
      clientId: user.id,
      network: String(formData.get("network") ?? "") as UsdcNetworkValue,
      address: String(formData.get("address") ?? ""),
    });
    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    if (e instanceof AccountError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
