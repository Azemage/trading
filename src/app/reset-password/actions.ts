"use server";

import { redirect } from "next/navigation";
import { resetPasswordWithToken, PasswordResetError } from "@/lib/password-reset";

export async function resetPasswordAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas" };

  try {
    await resetPasswordWithToken({ token, newPassword: password });
  } catch (e) {
    if (e instanceof PasswordResetError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }

  redirect("/login");
}
