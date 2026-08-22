"use server";

import { registerClient, registerSchema, RegisterError } from "@/lib/register";
import { signIn } from "@/auth";

export async function registerAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
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

  await signIn("credentials", {
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    redirectTo: "/client",
  });

  return { error: null };
}
