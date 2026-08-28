"use server";

import { getTranslations } from "next-intl/server";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmail, emailTemplates, getEmailT } from "@/lib/email";
import { getBaseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/prisma";

export async function requestPasswordResetAction(
  _prevState: { message: string | null },
  formData: FormData
): Promise<{ message: string | null }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const t = await getTranslations("forgotPassword");
  if (!email) return { message: null };

  const token = await createPasswordResetToken(email);
  if (token) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;
    const emailT = await getEmailT(user.preferredLocale);
    const { subject, html } = emailTemplates.passwordReset(emailT, resetUrl);
    await sendEmail({ to: user.email, subject, html });
  }

  return { message: t("genericSuccess") };
}
