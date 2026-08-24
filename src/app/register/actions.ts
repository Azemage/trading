"use server";

import { registerClient, registerSchema, RegisterError } from "@/lib/register";
import { signIn } from "@/auth";
import { sendEmail, emailTemplates } from "@/lib/email";

export async function registerAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const usdcAddress = String(formData.get("usdcAddress") ?? "").trim();
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    usdcNetwork: usdcAddress ? formData.get("usdcNetwork") || undefined : undefined,
    usdcAddress: usdcAddress || undefined,
  });
  if (!parsed.success) {
    return { error: "Champs invalides (mot de passe : 10 caractères minimum)" };
  }

  try {
    await registerClient(parsed.data);
  } catch (e) {
    if (e instanceof RegisterError) return { error: e.message };
    throw e;
  }

  await sendEmail({
    to: parsed.data.email.trim().toLowerCase(),
    subject: "Bienvenue chez Ledger Capital",
    html: emailTemplates.welcomeRegistration(parsed.data.name),
  });

  await signIn("credentials", {
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    redirectTo: "/client",
  });

  return { error: null };
}
