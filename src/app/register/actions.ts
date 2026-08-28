"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { registerClient, registerSchema } from "@/lib/register";
import { signIn } from "@/auth";
import { sendEmail, emailTemplates } from "@/lib/email";
import { translateActionError } from "@/lib/error-i18n";
import { AppError } from "@/lib/app-error";
import { isLocale } from "@/i18n/config";

export async function registerAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const usdcAddress = String(formData.get("usdcAddress") ?? "").trim();
  const requestedLocale = String(formData.get("preferredLocale") ?? "");
  const fallbackLocale = await getLocale();
  const preferredLocale = isLocale(requestedLocale) ? requestedLocale : fallbackLocale;

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    usdcNetwork: usdcAddress ? formData.get("usdcNetwork") || undefined : undefined,
    usdcAddress: usdcAddress || undefined,
    preferredLocale,
  });
  if (!parsed.success) {
    return { error: await translateActionError(new AppError("VALIDATION_INVALID_FIELDS")) };
  }

  try {
    await registerClient(parsed.data);
  } catch (e) {
    return { error: await translateActionError(e) };
  }

  const emailT = await getTranslations({ locale: preferredLocale, namespace: "emails" });
  const { subject, html } = emailTemplates.welcomeRegistration(emailT, parsed.data.name);
  await sendEmail({ to: parsed.data.email.trim().toLowerCase(), subject, html });

  await signIn("credentials", {
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    redirectTo: "/client",
  });

  return { error: null };
}
