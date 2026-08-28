"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requestDeposit, requestWithdrawal } from "@/lib/movements";
import { submitKyc } from "@/lib/kyc";
import { updateUsdcAddress } from "@/lib/account";
import { sendEmail, notifyManagers, emailTemplates, getEmailT, getUserPreferredLocale, type EmailAttachment } from "@/lib/email";
import { translateActionError } from "@/lib/error-i18n";
import { AppError } from "@/lib/app-error";
import type { UsdcNetworkValue } from "@/lib/usdc";

async function requireClient() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    throw new AppError("UNAUTHENTICATED");
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
    if (!amount || amount <= 0) return { error: await translateActionError(new AppError("MOVEMENT_INVALID_AMOUNT")) };

    await requestDeposit(user.id, new Decimal(amount));

    await notifyManagers((mt, mLocale) => emailTemplates.managerNewDeposit(mt, mLocale, user.name ?? "", amount));

    const locale = await getUserPreferredLocale(user.id);
    const t = await getEmailT(locale);
    const { subject, html } = emailTemplates.depositSubmittedConfirmation(t, locale, user.name ?? "", amount);
    await sendEmail({ to: user.email ?? "", subject, html });

    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
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
    if (amount !== "all" && (!amount || amount <= 0)) {
      return { error: await translateActionError(new AppError("MOVEMENT_INVALID_AMOUNT")) };
    }

    const movement = await requestWithdrawal(user.id, amount === "all" ? "all" : new Decimal(amount));

    const locale = await getUserPreferredLocale(user.id);
    const t = await getEmailT(locale);
    await notifyManagers((mt, mLocale) =>
      emailTemplates.managerNewWithdrawal(mt, mLocale, user.name ?? "", movement.amount.toNumber())
    );
    const { subject, html } = emailTemplates.withdrawalSubmittedConfirmation(
      t,
      locale,
      user.name ?? "",
      movement.amount.toNumber()
    );
    await sendEmail({ to: user.email ?? "", subject, html });

    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
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
      (mt) => emailTemplates.managerNewKyc(mt, user.name ?? "", attachments.length > 0),
      attachments.length > 0 ? attachments : undefined
    );

    const locale = await getUserPreferredLocale(user.id);
    const t = await getEmailT(locale);
    const { subject, html } = emailTemplates.kycSubmittedConfirmation(t, user.name ?? "");
    await sendEmail({ to: user.email ?? "", subject, html });

    revalidatePath("/client");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
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
    return { error: await translateActionError(e) };
  }
}
