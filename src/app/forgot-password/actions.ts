"use server";

import { createPasswordResetToken } from "@/lib/password-reset";
import { sendEmail, emailTemplates } from "@/lib/email";
import { getBaseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/prisma";

// Message générique volontaire : ne jamais révéler si un email est connu ou non.
const GENERIC_SUCCESS =
  "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.";

export async function requestPasswordResetAction(
  _prevState: { message: string | null },
  formData: FormData
): Promise<{ message: string | null }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { message: null };

  const token = await createPasswordResetToken(email);
  if (token) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;
    await sendEmail({ to: user.email, subject: "Réinitialisation du mot de passe", html: emailTemplates.passwordReset(resetUrl) });
  }

  return { message: GENERIC_SUCCESS };
}
