"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor, TwoFactorError } from "@/lib/two-factor";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
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
    return { error: e instanceof Error ? e.message : "Erreur inconnue", qrCodeDataUrl: null, secret: null };
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
    if (e instanceof TwoFactorError) return { error: e.message, success: false };
    return { error: e instanceof Error ? e.message : "Erreur inconnue", success: false };
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
    if (e instanceof TwoFactorError) return { error: e.message };
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
