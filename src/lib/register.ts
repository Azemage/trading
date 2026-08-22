import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";

export const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
});

export class RegisterError extends Error {}

// Auto-inscription réservée aux clients. Les comptes gestionnaire sont créés
// manuellement (seed / accès base) — jamais via ce chemin public.
export async function registerClient(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new RegisterError("Un compte existe déjà pour cet email");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { email, name: input.name, passwordHash, role: "CLIENT" },
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
