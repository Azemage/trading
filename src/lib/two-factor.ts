import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { AppError } from "./app-error";

export class TwoFactorError extends AppError {}

const ISSUER = "Ledger Capital";
// Tolère une dérive d'horloge de ±30s (1 pas de temps) de part et d'autre, comme la plupart des apps 2FA.
const EPOCH_TOLERANCE = 30;

export async function verifyTwoFactorCode(secret: string, token: string): Promise<boolean> {
  if (!token.trim()) return false;
  const result = await verify({ secret, token: token.trim(), epochTolerance: EPOCH_TOLERANCE });
  return result.valid;
}

/**
 * Démarre (ou redémarre) la configuration 2FA d'un utilisateur : génère un
 * nouveau secret, le stocke (sans encore activer la 2FA — activée seulement
 * après confirmation d'un code valide), et retourne un QR code à scanner.
 */
export async function beginTwoFactorSetup(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: ISSUER, label: user.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

  return { secret, qrCodeDataUrl };
}

export async function confirmTwoFactorSetup(params: { userId: string; code: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });
  if (!user.twoFactorSecret) {
    throw new TwoFactorError("TWO_FACTOR_NO_PENDING_SETUP");
  }
  if (!(await verifyTwoFactorCode(user.twoFactorSecret, params.code))) {
    throw new TwoFactorError("TWO_FACTOR_INVALID_CODE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: params.userId }, data: { twoFactorEnabled: true } });
    await logAudit(tx, {
      actorId: params.userId,
      actorRole: user.role,
      action: "2fa.enabled",
      entityType: "User",
      entityId: params.userId,
    });
  });
}

export async function disableTwoFactor(params: { userId: string; password: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });
  const validPassword = await bcrypt.compare(params.password, user.passwordHash);
  if (!validPassword) throw new TwoFactorError("TWO_FACTOR_WRONG_PASSWORD");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await logAudit(tx, {
      actorId: params.userId,
      actorRole: user.role,
      action: "2fa.disabled",
      entityType: "User",
      entityId: params.userId,
    });
  });
}
