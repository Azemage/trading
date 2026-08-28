"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor } from "@/lib/two-factor";
import { translateActionError } from "@/lib/error-i18n";
import { AppError } from "@/lib/app-error";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new AppError("UNAUTHENTICATED");
  return session.user;
}

export async function beginTwoFactorSetupAction(
  _prevState: { error: string | null; qrCodeDataUrl: string | null; secret: string | null }
): Promise<{
  error: string | null;
  qrCodeDataUrl: string | null;
  secret: string | null;
}> {
  try {
    const user = await requireUser();
    const { secret, qrCodeDataUrl } = await beginTwoFactorSetup(user.id);
    return { error: null, qrCodeDataUrl, secret };
  } catch (e) {
    return { error: await translateActionError(e), qrCodeDataUrl: null, secret: null };
  }
}

export async function confirmTwoFactorSetupAction(
  _prevState: { error: string | null; success: boolean },
  formData: FormData
): Promise<{ error: string | null; success: boolean }> {
  try {
    const user = await requireUser();
    const code = String(formData.get("code") ?? "");
    await confirmTwoFactorSetup({ userId: user.id, code });
    revalidatePath("/security");
    return { error: null, success: true };
  } catch (e) {
    return { error: await translateActionError(e), success: false };
  }
}

export async function disableTwoFactorAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    const user = await requireUser();
    const password = String(formData.get("password") ?? "");
    await disableTwoFactor({ userId: user.id, password });
    revalidatePath("/security");
    return { error: null };
  } catch (e) {
    return { error: await translateActionError(e) };
  }
}
