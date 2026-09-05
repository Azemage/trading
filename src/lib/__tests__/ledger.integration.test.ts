import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../prisma";
import { approveDeposit, requestDeposit } from "../movements";
import { logManualTrade } from "../trades";
import { buildClientLedger } from "../ledger";

async function resetDb() {
  await prisma.auditLog.deleteMany();
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

describe("fiche de calcul client — répartition des frais de trading vs performance", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.poolState.create({ data: { id: 1 } });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("attribue à un client détenant 100% du pool exactement les frais réellement prélevés", async () => {
    const client = await makeClient("ledgerclient@test.local");
    const manager = await makeManager("ledgermgr@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    const trade = await logManualTrade({
      pnlPct: new Decimal(5),
      tradingFeeUsd: new Decimal(20),
      loggedById: manager.id,
    });

    const feeEntries = await prisma.feeLedger.findMany({ where: { tradeId: trade.id } });
    const actualTradingFee = feeEntries.find((f) => f.type === "TRADING")?.amount.toNumber() ?? 0;
    const actualPerfFee = feeEntries.find((f) => f.type === "PERFORMANCE")?.amount.toNumber() ?? 0;
    expect(actualTradingFee).toBeCloseTo(20, 6);
    expect(actualPerfFee).toBeCloseTo(9, 6);

    const { entries } = await buildClientLedger(client.id);
    const tradeEntry = entries.find((e) => e.kind === "TRADE");
    if (tradeEntry?.kind !== "TRADE") throw new Error("trade entry not found");

    // Le client détient 100% des parts : sa part de chaque frais doit être exacte.
    expect(tradeEntry.tradingFeeUsd).toBeCloseTo(actualTradingFee, 6);
    expect(tradeEntry.perfFeeUsd).toBeCloseTo(actualPerfFee, 6);
    expect(tradeEntry.feeUsd).toBeCloseTo(actualTradingFee + actualPerfFee, 6);
  });

  it("répartit les frais au prorata entre deux clients de parts inégales", async () => {
    const clientA = await makeClient("ledgera@test.local");
    const clientB = await makeClient("ledgerb@test.local");
    const manager = await makeManager("ledgermgr2@test.local");

    const depA = await requestDeposit(clientA.id, new Decimal(750));
    await makeEligible(depA.id);
    await approveDeposit(depA.id, manager.id);

    const depB = await requestDeposit(clientB.id, new Decimal(250));
    await makeEligible(depB.id);
    await approveDeposit(depB.id, manager.id);

    const trade = await logManualTrade({
      pnlPct: new Decimal(10),
      tradingFeeUsd: new Decimal(40),
      loggedById: manager.id,
    });

    const feeEntries = await prisma.feeLedger.findMany({ where: { tradeId: trade.id } });
    const actualTradingFee = feeEntries.find((f) => f.type === "TRADING")?.amount.toNumber() ?? 0;
    const actualPerfFee = feeEntries.find((f) => f.type === "PERFORMANCE")?.amount.toNumber() ?? 0;

    const [ledgerA, ledgerB] = await Promise.all([
      buildClientLedger(clientA.id),
      buildClientLedger(clientB.id),
    ]);
    const tradeA = ledgerA.entries.find((e) => e.kind === "TRADE");
    const tradeB = ledgerB.entries.find((e) => e.kind === "TRADE");
    if (tradeA?.kind !== "TRADE" || tradeB?.kind !== "TRADE") throw new Error("trade entry not found");

    // 75% / 25% des parts : la somme des deux parts doit reconstituer exactement
    // le montant réellement prélevé sur le pool, pour chaque type de frais.
    expect(tradeA.tradingFeeUsd + tradeB.tradingFeeUsd).toBeCloseTo(actualTradingFee, 6);
    expect(tradeA.perfFeeUsd + tradeB.perfFeeUsd).toBeCloseTo(actualPerfFee, 6);
    expect(tradeA.tradingFeeUsd).toBeCloseTo(actualTradingFee * 0.75, 6);
    expect(tradeB.tradingFeeUsd).toBeCloseTo(actualTradingFee * 0.25, 6);
  });
});
