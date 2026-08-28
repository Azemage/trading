"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { verifyPassword } from "@/lib/credentials";

export async function loginAction(
  _prevState: { error: string | null; needsCode: boolean },
  formData: FormData
): Promise<{ error: string | null; needsCode: boolean }> {
  const t = await getTranslations("login");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    const user = await verifyPassword(email, password);
    if (!user) return { error: t("errorInvalidCredentials"), needsCode: false };
    if (user.twoFactorEnabled) return { error: null, needsCode: true };
  }

  try {
    await signIn("credentials", { email, password, code, redirectTo: "/" });
    return { error: null, needsCode: false };
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        error: code ? t("errorInvalidCode") : t("errorInvalidCredentials"),
        needsCode: !!code,
      };
    }
    throw e;
  }
}
