import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../prisma";
import {
  approveDeposit,
  markWithdrawalSent,
  rejectWithdrawal,
  requestDeposit,
  requestWithdrawal,
} from "../movements";
import { adjustPoolAssets, logManualTrade } from "../trades";

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

// KYC vérifié + adresse USDC par défaut : la plupart des tests portent sur
// la mécanique NAV/gate/HWM, pas sur le garde-fou KYC (testé séparément).
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

// Force l'éligibilité immédiate pour les tests (pas d'attente de 24h).
async function makeEligible(movementId: string) {
  await prisma.pendingMovement.update({
    where: { id: movementId },
    data: { eligibleAt: new Date(0) },
  });
}

describe("mouvements — cas limites critiques (argent de tiers)", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.poolState.create({ data: { id: 1 } });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("dépôt puis retrait immédiat : les parts/AUM restent cohérents (pas de désynchronisation)", async () => {
    const client = await makeClient("a@test.local");
    const manager = await makeManager("mgr@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    expect(pool.totalAssets.toString()).toBe("1000");

    // Pas de plafond de gate : le retrait demandé est intégralement accordé.
    const wd = await requestWithdrawal(client.id, new Decimal(400));
    await makeEligible(wd.id);
    await markWithdrawalSent(wd.id, manager.id, "0xabc");

    const holding = await prisma.clientHolding.findUniqueOrThrow({
      where: { clientId: client.id },
    });
    const poolAfter = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    expect(holding.parts.toString()).toBe("600");
    expect(poolAfter.totalAssets.toString()).toBe("600");
    // invariant fondamental : totalAssets doit toujours égaler totalParts * NAV constant tant qu'aucun trade n'a eu lieu
    expect(poolAfter.totalParts.toString()).toBe(holding.parts.toString());
  });

  it("deux clients déposent et retirent en parallèle : le pool reste cohérent (verrouillage transactionnel)", async () => {
    const alice = await makeClient("alice@test.local");
    const bob = await makeClient("bob@test.local");
    const manager = await makeManager("mgr2@test.local");

    // Amorçage du pool avec un premier dépôt confirmé.
    const seed = await requestDeposit(alice.id, new Decimal(1000));
    await makeEligible(seed.id);
    await approveDeposit(seed.id, manager.id);

    // Dépôt de Bob et retrait partiel d'Alice lancés en même temps.
    const [bobDep] = await Promise.all([
      requestDeposit(bob.id, new Decimal(500)),
      requestWithdrawal(alice.id, new Decimal(200)),
    ]);
    await makeEligible(bobDep.id);
    await approveDeposit(bobDep.id, manager.id);

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    const aliceHolding = await prisma.clientHolding.findUniqueOrThrow({
      where: { clientId: alice.id },
    });
    const bobHolding = await prisma.clientHolding.findUniqueOrThrow({
      where: { clientId: bob.id },
    });

    // Invariant central : total_parts du pool == somme des parts clients.
    const sumParts = aliceHolding.parts.plus(bobHolding.parts);
    expect(pool.totalParts.toString()).toBe(sumParts.toString());
    // 1000 (seed) - 200 (retrait alice) + 500 (dépôt bob) = 1300
    expect(pool.totalAssets.toString()).toBe("1300");
  });

  it("aucun plafond de gate : un client peut retirer la quasi-totalité de son solde en une fois", async () => {
    const client = await makeClient("nogate@test.local");
    const manager = await makeManager("mgr3@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    // 90% de l'AUM en une seule demande — aurait été bloqué par l'ancien gate à 20%.
    const wd = await requestWithdrawal(client.id, new Decimal(900));
    expect(wd.grantedAmount?.toString()).toBe("900");

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    expect(pool.totalAssets.toString()).toBe("100");
  });

  it("\"all\" retire bien 100% du solde, sans aucun plafond", async () => {
    const client = await makeClient("allout@test.local");
    const manager = await makeManager("mgr7@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    const wd = await requestWithdrawal(client.id, "all");
    expect(wd.grantedAmount?.toString()).toBe("1000");

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    const holding = await prisma.clientHolding.findUniqueOrThrow({ where: { clientId: client.id } });
    expect(pool.totalAssets.toString()).toBe("0");
    expect(holding.parts.toString()).toBe("0");
  });

  it("un retrait rejeté avant envoi restitue intégralement les parts et l'AUM", async () => {
    const client = await makeClient("reject@test.local");
    const manager = await makeManager("mgr4@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    const wd = await requestWithdrawal(client.id, new Decimal(300));
    await rejectWithdrawal(wd.id, manager.id, "vérification KYC en cours");

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    const holding = await prisma.clientHolding.findUniqueOrThrow({
      where: { clientId: client.id },
    });
    expect(pool.totalAssets.toString()).toBe("1000");
    expect(holding.parts.toString()).toBe("1000");
  });

  it("un trade négatif suivi d'un dépôt n'avantage ni ne désavantage le nouveau client (NAV figé à la demande)", async () => {
    const alice = await makeClient("alice2@test.local");
    const bob = await makeClient("bob2@test.local");
    const manager = await makeManager("mgr5@test.local");

    const dep = await requestDeposit(alice.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id); // NAV = 1

    await logManualTrade({ pnlPct: new Decimal(-10), loggedById: manager.id }); // NAV = 0.9

    const bobDep = await requestDeposit(bob.id, new Decimal(900));
    await makeEligible(bobDep.id);
    await approveDeposit(bobDep.id, manager.id);

    const bobHolding = await prisma.clientHolding.findUniqueOrThrow({
      where: { clientId: bob.id },
    });
    // Bob dépose au NAV figé de 0.9 => 900 / 0.9 = 1000 parts, pas 900.
    expect(bobHolding.parts.toString()).toBe("1000");
  });

  it("l'ajustement manuel de l'AUM ne fait pas rattraper de frais sur le trade suivant (bug corrigé)", async () => {
    const client = await makeClient("hwm@test.local");
    const manager = await makeManager("mgr6@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id); // NAV = 1, HWM = 1

    // Forçage de test : AUM boosté à 2000 (NAV = 2) sans passer par un trade.
    await adjustPoolAssets({
      newTotalAssets: new Decimal(2000),
      reason: "scénario de test",
      managerId: manager.id,
    });
    const poolAfterAdjust = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    // Le HWM doit suivre l'ajustement, sinon le prochain trade rattrape tout l'écart.
    expect(poolAfterAdjust.highWaterMark.toString()).toBe("2");

    // Petit trade positif (+1.58%) juste après.
    const trade = await logManualTrade({ pnlPct: new Decimal(1.58), loggedById: manager.id });
    const poolAfterTrade = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });

    // Le résultat net doit rester positif : pas de frais de "rattrapage" sur
    // l'écart créé par l'ajustement manuel, seulement sur le gain réel du trade.
    expect(poolAfterTrade.totalAssets.greaterThan(2000)).toBe(true);
    expect(trade.navAfter.greaterThan(trade.navBefore)).toBe(true);
  });

  it("déduit les frais de trading avant la performance fee et les trace dans le fee ledger", async () => {
    const client = await makeClient("tradingfee@test.local");
    const manager = await makeManager("mgr7@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id); // NAV = 1, HWM = 1

    const trade = await logManualTrade({
      pnlPct: new Decimal(10), // +10% brut => 1100
      loggedById: manager.id,
      tradingFeeUsd: new Decimal(20), // 1080 net de trading => perf fee sur (1080-1000)*30% = 24
    });

    expect(trade.tradingFeeUsd?.toString()).toBe("20");

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    expect(pool.totalAssets.toString()).toBe("1056"); // 1080 - 24

    const feeEntries = await prisma.feeLedger.findMany({ where: { tradeId: trade.id } });
    const tradingEntry = feeEntries.find((f) => f.type === "TRADING");
    const perfEntry = feeEntries.find((f) => f.type === "PERFORMANCE");
    expect(tradingEntry?.amount.toString()).toBe("20");
    expect(perfEntry?.amount.toString()).toBe("24");
  });

  it("refuse des frais de trading négatifs", async () => {
    const manager = await makeManager("mgr8@test.local");
    await expect(
      logManualTrade({ pnlPct: new Decimal(5), loggedById: manager.id, tradingFeeUsd: new Decimal(-1) })
    ).rejects.toThrow(/négatifs/);
  });

  it("bloque un dépôt tant que le KYC n'est pas vérifié", async () => {
    const client = await prisma.user.create({
      data: { email: "nokycdep@test.local", passwordHash: "x", name: "No Kyc Dep", role: "CLIENT" },
    });

    await expect(requestDeposit(client.id, new Decimal(1000))).rejects.toThrow(/KYC/);
  });

  it("bloque un retrait tant que le KYC n'est pas vérifié", async () => {
    // Financé pendant que le KYC est vérifié, puis rejeté ensuite — pour isoler
    // le garde-fou du retrait de celui du dépôt (testé séparément ci-dessus).
    const client = await prisma.user.create({
      data: {
        email: "nokyc@test.local",
        passwordHash: "x",
        name: "No Kyc",
        role: "CLIENT",
        kycStatus: "VERIFIED",
        usdcNetwork: "ETHEREUM",
        usdcAddress: "0x" + "b".repeat(40),
      },
    });
    const manager = await makeManager("mgr8@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    await prisma.user.update({ where: { id: client.id }, data: { kycStatus: "PENDING" } });

    await expect(requestWithdrawal(client.id, new Decimal(100))).rejects.toThrow(/KYC/);
  });

  it("bloque un retrait tant qu'aucune adresse USDC n'est enregistrée", async () => {
    const client = await prisma.user.create({
      data: {
        email: "noaddr@test.local",
        passwordHash: "x",
        name: "No Addr",
        role: "CLIENT",
        kycStatus: "VERIFIED",
      },
    });
    const manager = await makeManager("mgr9@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    await expect(requestWithdrawal(client.id, new Decimal(100))).rejects.toThrow(/adresse USDC/);
  });
});
