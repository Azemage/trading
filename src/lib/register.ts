import bcrypt from "bcryptjs";
import { z } from "zod";
import type { UsdcNetwork } from "@prisma/client";
import { prisma } from "./prisma";
import { validateUsdcAddress } from "./usdc";
import { AppError } from "./app-error";
import { LOCALES } from "@/i18n/config";

export const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
  usdcNetwork: z.enum(["ETHEREUM", "POLYGON", "BASE", "SOLANA", "TRON", "OTHER"]).optional(),
  usdcAddress: z.string().max(128).optional(),
  preferredLocale: z.enum(LOCALES).optional(),
});

export class RegisterError extends AppError {}

// Auto-inscription réservée aux clients. Les comptes gestionnaire sont créés
// manuellement (seed / accès base) — jamais via ce chemin public.
// L'adresse USDC est optionnelle à l'inscription (ajoutable plus tard depuis
// l'espace client) mais requise pour pouvoir demander un retrait.
export async function registerClient(input: {
  name: string;
  email: string;
  password: string;
  usdcNetwork?: string;
  usdcAddress?: string;
  preferredLocale?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new RegisterError("REGISTER_EMAIL_TAKEN");

  let usdcNetwork: UsdcNetwork | undefined;
  let usdcAddress: string | undefined;
  if (input.usdcAddress?.trim()) {
    if (!input.usdcNetwork) throw new RegisterError("REGISTER_USDC_NETWORK_REQUIRED");
    const { valid, error } = validateUsdcAddress(
      input.usdcNetwork as Parameters<typeof validateUsdcAddress>[0],
      input.usdcAddress
    );
    if (!valid) throw new RegisterError(error ?? "USDC_ADDRESS_INVALID");
    usdcNetwork = input.usdcNetwork as UsdcNetwork;
    usdcAddress = input.usdcAddress.trim();
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash,
      role: "CLIENT",
      usdcNetwork,
      usdcAddress,
      preferredLocale: input.preferredLocale ?? "fr",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorRole: "CLIENT",
      action: "user.registered",
      entityType: "User",
      entityId: user.id,
    },
  });

  return user;
}
