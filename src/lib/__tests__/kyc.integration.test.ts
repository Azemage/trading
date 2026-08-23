import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import { submitKyc, reviewKyc, KycError } from "../kyc";

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.kycSubmission.deleteMany();
  await prisma.user.deleteMany();
}

async function makeClient(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x", name: email, role: "CLIENT" } });
}
async function makeManager(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x", name: email, role: "MANAGER" } });
}

describe("KYC — revue manuelle", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("une soumission approuvée passe le client en VERIFIED", async () => {
    const client = await makeClient("kyc1@test.local");
    const manager = await makeManager("mgrkyc1@test.local");

    const sub = await submitKyc({
      clientId: client.id,
      legalName: "Jean Dupont",
      documentType: "Passeport",
      documentNumber: "AB123456",
    });

    await reviewKyc({ submissionId: sub.id, approve: true, managerId: manager.id });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(updated.kycStatus).toBe("VERIFIED");
  });

  it("une soumission rejetée passe le client en REJECTED et permet de resoumettre", async () => {
    const client = await makeClient("kyc2@test.local");
    const manager = await makeManager("mgrkyc2@test.local");

    const sub = await submitKyc({
      clientId: client.id,
      legalName: "Jean Dupont",
      documentType: "Passeport",
      documentNumber: "AB123456",
    });
    await reviewKyc({ submissionId: sub.id, approve: false, reason: "Document illisible", managerId: manager.id });

    const afterReject = await prisma.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(afterReject.kycStatus).toBe("REJECTED");

    // Resoumission autorisée après un rejet.
    const sub2 = await submitKyc({
      clientId: client.id,
      legalName: "Jean Dupont",
      documentType: "Passeport",
      documentNumber: "AB123457",
    });
    expect(sub2.status).toBe("PENDING");
  });

  it("refuse une nouvelle soumission tant qu'une est déjà en attente", async () => {
    const client = await makeClient("kyc3@test.local");
    await submitKyc({
      clientId: client.id,
      legalName: "Jean Dupont",
      documentType: "Passeport",
      documentNumber: "AB123456",
    });

    await expect(
      submitKyc({
        clientId: client.id,
        legalName: "Jean Dupont",
        documentType: "Passeport",
        documentNumber: "AB999999",
      })
    ).rejects.toThrow(KycError);
  });

  it("refuse un rejet sans motif", async () => {
    const client = await makeClient("kyc4@test.local");
    const manager = await makeManager("mgrkyc4@test.local");
    const sub = await submitKyc({
      clientId: client.id,
      legalName: "Jean Dupont",
      documentType: "Passeport",
      documentNumber: "AB123456",
    });

    await expect(reviewKyc({ submissionId: sub.id, approve: false, managerId: manager.id })).rejects.toThrow(
      KycError
    );
  });

  it("accepte une soumission avec recto/verso au format valide et les stocke", async () => {
    const client = await makeClient("kycphoto1@test.local");
    const idFront = { data: Buffer.from([0xff, 0xd8, 0xff]), mimeType: "image/jpeg" };
    const idBack = { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mimeType: "image/png" };

    const sub = await submitKyc({
      clientId: client.id,
      legalName: "Jean Dupont",
      documentType: "Passeport",
      documentNumber: "AB123456",
      idFront,
      idBack,
    });

    const stored = await prisma.kycSubmission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(stored.idFrontMimeType).toBe("image/jpeg");
    expect(stored.idBackMimeType).toBe("image/png");
    expect(Buffer.from(stored.idFrontImage!).equals(idFront.data)).toBe(true);
  });

  it("rejette un format de photo non supporté", async () => {
    const client = await makeClient("kycphoto2@test.local");
    await expect(
      submitKyc({
        clientId: client.id,
        legalName: "Jean Dupont",
        documentType: "Passeport",
        documentNumber: "AB123456",
        idFront: { data: Buffer.from("fake pdf"), mimeType: "application/pdf" },
      })
    ).rejects.toThrow(/format/);
  });

  it("rejette une photo trop volumineuse", async () => {
    const client = await makeClient("kycphoto3@test.local");
    const tooLarge = Buffer.alloc(6 * 1024 * 1024); // 6 Mo > limite de 5 Mo
    await expect(
      submitKyc({
        clientId: client.id,
        legalName: "Jean Dupont",
        documentType: "Passeport",
        documentNumber: "AB123456",
        idFront: { data: tooLarge, mimeType: "image/jpeg" },
      })
    ).rejects.toThrow(/volumineux/);
  });
});
