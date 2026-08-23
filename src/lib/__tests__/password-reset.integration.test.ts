import { afterAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import {
  createPasswordResetToken,
  findValidPasswordResetToken,
  resetPasswordWithToken,
  PasswordResetError,
} from "../password-reset";

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
}

async function makeClient(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash("old-password", 12), name: email, role: "CLIENT" },
  });
}

describe("Réinitialisation de mot de passe", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("retourne null pour un email inconnu (pas de fuite d'information)", async () => {
    const token = await createPasswordResetToken("inconnu@test.local");
    expect(token).toBeNull();
  });

  it("génère un jeton valide pour un compte existant", async () => {
    const client = await makeClient("resetpw1@test.local");
    const token = await createPasswordResetToken(client.email);
    expect(token).not.toBeNull();

    const record = await findValidPasswordResetToken(token!);
    expect(record?.userId).toBe(client.id);
  });

  it("change effectivement le mot de passe et consomme le jeton", async () => {
    const client = await makeClient("resetpw2@test.local");
    const token = await createPasswordResetToken(client.email);

    await resetPasswordWithToken({ token: token!, newPassword: "un-nouveau-mdp-solide" });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(await bcrypt.compare("un-nouveau-mdp-solide", updated.passwordHash)).toBe(true);

    // Le jeton ne peut plus être réutilisé.
    const record = await findValidPasswordResetToken(token!);
    expect(record).toBeNull();
  });

  it("refuse un jeton déjà utilisé", async () => {
    const client = await makeClient("resetpw3@test.local");
    const token = await createPasswordResetToken(client.email);
    await resetPasswordWithToken({ token: token!, newPassword: "un-nouveau-mdp-solide" });

    await expect(
      resetPasswordWithToken({ token: token!, newPassword: "autre-mdp-solide" })
    ).rejects.toThrow(PasswordResetError);
  });

  it("refuse un jeton inconnu", async () => {
    await expect(
      resetPasswordWithToken({ token: "jeton-invalide", newPassword: "un-nouveau-mdp-solide" })
    ).rejects.toThrow(PasswordResetError);
  });

  it("refuse un mot de passe trop court", async () => {
    const client = await makeClient("resetpw4@test.local");
    const token = await createPasswordResetToken(client.email);

    await expect(resetPasswordWithToken({ token: token!, newPassword: "court" })).rejects.toThrow(
      PasswordResetError
    );
  });
});
