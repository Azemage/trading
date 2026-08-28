"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { translateActionError } from "@/lib/error-i18n";

export async function resetPasswordAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    const t = await getTranslations("errors");
    return { error: t("PASSWORD_MISMATCH") };
  }

  try {
    await resetPasswordWithToken({ token, newPassword: password });
  } catch (e) {
    return { error: await translateActionError(e) };
  }

  redirect("/login");
}
