import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../prisma";
import { approveDeposit, requestDeposit } from "../movements";
import { logManualTrade } from "../trades";
import { getPerformanceFeeSummary, withdrawPerformanceFees } from "../fee-withdrawal";

async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.feeWithdrawal.deleteMany();
  await prisma.kycSubmission.deleteMany();
  await prisma.feeLedger.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.navSnapshot.deleteMany();
  await prisma.pendingMovement.deleteMany();
  await prisma.clientHolding.deleteMany();
  await prisma.poolState.deleteMany();
  await prisma.user.deleteMany();
}

async function makeClient(email: string) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: "x",
      name: email,
      role: "CLIENT",
      kycStatus: "VERIFIED",
      usdcNetwork: "ETHEREUM",
      usdcAddress: "0x" + "a".repeat(40),
    },
  });
}
async function makeManager(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "x", name: email, role: "MANAGER" },
  });
}
async function makeEligible(movementId: string) {
  await prisma.pendingMovement.update({
    where: { id: movementId },
    data: { eligibleAt: new Date(0) },
  });
}

describe("retrait de performance fee — argent déjà sur la plateforme de trading", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.poolState.create({ data: { id: 1 } });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("le disponible correspond au cumul gagné tant qu'aucun retrait n'est fait", async () => {
    const client = await makeClient("feewd1@test.local");
    const manager = await makeManager("feewdmgr1@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    await logManualTrade({ pnlPct: new Decimal(10), loggedById: manager.id }); // perf fee = 30

    const summary = await getPerformanceFeeSummary();
    expect(summary.earned.toString()).toBe("30");
    expect(summary.withdrawn.toString()).toBe("0");
    expect(summary.available.toString()).toBe("30");
  });

  it("un retrait partiel réduit le disponible sans toucher à l'AUM ni aux parts clients", async () => {
    const client = await makeClient("feewd2@test.local");
    const manager = await makeManager("feewdmgr2@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);
    await logManualTrade({ pnlPct: new Decimal(10), loggedById: manager.id }); // perf fee = 30

    const poolBefore = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    const holdingBefore = await prisma.clientHolding.findUniqueOrThrow({ where: { clientId: client.id } });

    await withdrawPerformanceFees({ amount: new Decimal(20), managerId: manager.id, note: "test" });

    const summary = await getPerformanceFeeSummary();
    expect(summary.withdrawn.toString()).toBe("20");
    expect(summary.available.toString()).toBe("10");

    const poolAfter = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    const holdingAfter = await prisma.clientHolding.findUniqueOrThrow({ where: { clientId: client.id } });
    expect(poolAfter.totalAssets.toString()).toBe(poolBefore.totalAssets.toString());
    expect(holdingAfter.parts.toString()).toBe(holdingBefore.parts.toString());
  });

  it("refuse un retrait supérieur au disponible", async () => {
    const client = await makeClient("feewd3@test.local");
    const manager = await makeManager("feewdmgr3@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);
    await logManualTrade({ pnlPct: new Decimal(10), loggedById: manager.id }); // perf fee = 30

    await expect(
      withdrawPerformanceFees({ amount: new Decimal(31), managerId: manager.id })
    ).rejects.toThrow(/FEE_WITHDRAWAL_EXCEEDS_AVAILABLE/);
  });

  it("refuse un retrait négatif ou nul", async () => {
    const manager = await makeManager("feewdmgr4@test.local");
    await expect(
      withdrawPerformanceFees({ amount: new Decimal(0), managerId: manager.id })
    ).rejects.toThrow(/FEE_WITHDRAWAL_INVALID_AMOUNT/);
    await expect(
      withdrawPerformanceFees({ amount: new Decimal(-5), managerId: manager.id })
    ).rejects.toThrow(/FEE_WITHDRAWAL_INVALID_AMOUNT/);
  });

  it("après retrait total, le disponible retombe à zéro (plus rien à retirer)", async () => {
    const client = await makeClient("feewd5@test.local");
    const manager = await makeManager("feewdmgr5@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);
    await logManualTrade({ pnlPct: new Decimal(10), loggedById: manager.id }); // perf fee = 30

    await withdrawPerformanceFees({ amount: new Decimal(30), managerId: manager.id });

    const summary = await getPerformanceFeeSummary();
    expect(summary.available.toString()).toBe("0");

    await expect(
      withdrawPerformanceFees({ amount: new Decimal(0.01), managerId: manager.id })
    ).rejects.toThrow(/FEE_WITHDRAWAL_EXCEEDS_AVAILABLE/);
  });
});
