import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/** Vérifie email/mot de passe, retourne l'utilisateur complet si valide, sinon null. */
export async function verifyPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return user;
}
