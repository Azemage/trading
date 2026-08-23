"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { verifyPassword } from "@/lib/credentials";

export async function loginAction(
  _prevState: { error: string | null; needsCode: boolean },
  formData: FormData
): Promise<{ error: string | null; needsCode: boolean }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    const user = await verifyPassword(email, password);
    if (!user) return { error: "Email ou mot de passe incorrect", needsCode: false };
    if (user.twoFactorEnabled) return { error: null, needsCode: true };
  }

  try {
    await signIn("credentials", { email, password, code, redirectTo: "/" });
    return { error: null, needsCode: false };
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        error: code ? "Code de vérification incorrect" : "Email ou mot de passe incorrect",
        needsCode: !!code,
      };
    }
    throw e;
  }
}
