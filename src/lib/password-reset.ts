import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { logAudit } from "./audit";

export class PasswordResetError extends Error {}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const MIN_PASSWORD_LENGTH = 10;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Génère un jeton de réinitialisation pour l'utilisateur associé à cet email,
 * si un compte existe. Ne révèle jamais à l'appelant si l'email est connu ou
 * non (l'appelant doit toujours afficher le même message de succès) — seul
 * le jeton en clair (à mettre dans le lien envoyé par email) est retourné,
 * le jeton stocké en base n'est que son hash.
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return token;
}

/** Vérifie qu'un jeton (en clair, tel que reçu dans le lien) est valide et non expiré/consommé. */
export async function findValidPasswordResetToken(token: string) {
  if (!token) return null;
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  return record;
}

export async function resetPasswordWithToken(params: { token: string; newPassword: string }) {
  if (params.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordResetError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
  }

  const record = await findValidPasswordResetToken(params.token);
  if (!record) throw new PasswordResetError("Lien de réinitialisation invalide ou expiré");

  const passwordHash = await bcrypt.hash(params.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await logAudit(tx, {
      actorId: user.id,
      actorRole: user.role,
      action: "user.password_reset",
      entityType: "User",
      entityId: user.id,
    });
  });
}
