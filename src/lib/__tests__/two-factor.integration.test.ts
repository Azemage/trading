import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generate } from "otplib";
import { prisma } from "../prisma";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  verifyTwoFactorCode,
  TwoFactorError,
} from "../two-factor";

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

async function makeClient(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x", name: email, role: "CLIENT" } });
}

describe("2FA — configuration TOTP", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("beginTwoFactorSetup génère un secret et le stocke sans activer la 2FA", async () => {
    const client = await makeClient("2fa1@test.local");
    const { secret, qrCodeDataUrl } = await beginTwoFactorSetup(client.id);

    expect(secret.length).toBeGreaterThan(0);
    expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(updated.twoFactorSecret).toBe(secret);
    expect(updated.twoFactorEnabled).toBe(false);
  });

  it("confirmTwoFactorSetup active la 2FA avec un code valide", async () => {
    const client = await makeClient("2fa2@test.local");
    const { secret } = await beginTwoFactorSetup(client.id);
    const code = await generate({ secret });

    await confirmTwoFactorSetup({ userId: client.id, code });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(updated.twoFactorEnabled).toBe(true);
  });

  it("confirmTwoFactorSetup rejette un code invalide", async () => {
    const client = await makeClient("2fa3@test.local");
    await beginTwoFactorSetup(client.id);

    await expect(confirmTwoFactorSetup({ userId: client.id, code: "000000" })).rejects.toThrow(TwoFactorError);
  });

  it("verifyTwoFactorCode valide un code TOTP correct et rejette un code incorrect", async () => {
    const client = await makeClient("2fa4@test.local");
    const { secret } = await beginTwoFactorSetup(client.id);
    const code = await generate({ secret });

    expect(await verifyTwoFactorCode(secret, code)).toBe(true);
    expect(await verifyTwoFactorCode(secret, "000000")).toBe(false);
  });

  it("disableTwoFactor requiert le mot de passe et efface le secret", async () => {
    const bcrypt = await import("bcryptjs");
    const client = await prisma.user.create({
      data: {
        email: "2fa5@test.local",
        passwordHash: await bcrypt.default.hash("mon-mdp", 12),
        name: "2fa5",
        role: "CLIENT",
      },
    });
    const { secret } = await beginTwoFactorSetup(client.id);
    const code = await generate({ secret });
    await confirmTwoFactorSetup({ userId: client.id, code });

    await expect(disableTwoFactor({ userId: client.id, password: "mauvais-mdp" })).rejects.toThrow(TwoFactorError);

    await disableTwoFactor({ userId: client.id, password: "mon-mdp" });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(updated.twoFactorEnabled).toBe(false);
    expect(updated.twoFactorSecret).toBeNull();
  });
});
