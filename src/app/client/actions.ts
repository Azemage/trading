"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requestDeposit, requestWithdrawal } from "@/lib/movements";
import { submitKyc, KycError } from "@/lib/kyc";
import { updateUsdcAddress, AccountError } from "@/lib/account";
import { sendEmail, notifyManagers, emailTemplates, type EmailAttachment } from "@/lib/email";
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
    await sendEmail({
      to: user.email ?? "",
      subject: "Demande de dépôt reçue",
      html: emailTemplates.depositSubmittedConfirmation(user.name ?? "", amount),
    });
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
    await sendEmail({
      to: user.email ?? "",
      subject: "Demande de retrait reçue",
      html: emailTemplates.withdrawalSubmittedConfirmation(user.name ?? "", movement.amount.toNumber()),
    });
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

    const idFrontFile = formData.get("idFront");
    const idBackFile = formData.get("idBack");
    const idFront =
      idFrontFile instanceof File && idFrontFile.size > 0
        ? { data: Buffer.from(await idFrontFile.arrayBuffer()), mimeType: idFrontFile.type }
        : undefined;
    const idBack =
      idBackFile instanceof File && idBackFile.size > 0
        ? { data: Buffer.from(await idBackFile.arrayBuffer()), mimeType: idBackFile.type }
        : undefined;

    await submitKyc({
      clientId: user.id,
      legalName: String(formData.get("legalName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      note: String(formData.get("note") ?? ""),
      idFront,
      idBack,
    });

    const extFromMime = (mime: string) => (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg");
    const attachments: EmailAttachment[] = [];
    if (idFront) attachments.push({ filename: `recto.${extFromMime(idFront.mimeType)}`, content: idFront.data });
    if (idBack) attachments.push({ filename: `verso.${extFromMime(idBack.mimeType)}`, content: idBack.data });

    await notifyManagers(
      "Nouvelle soumission KYC",
      emailTemplates.managerNewKyc(user.name ?? "", attachments.length > 0),
      attachments.length > 0 ? attachments : undefined
    );
    await sendEmail({
      to: user.email ?? "",
      subject: "KYC reçu",
      html: emailTemplates.kycSubmittedConfirmation(user.name ?? ""),
    });
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
