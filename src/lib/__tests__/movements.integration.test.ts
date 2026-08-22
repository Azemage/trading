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
    data: { email, passwordHash: "x", name: email, role: "CLIENT" },
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

    // Gate mensuel = 20% de l'AUM (1000) = 200 : seul ce montant est immédiatement accordé.
    const wd = await requestWithdrawal(client.id, new Decimal(150));
    await makeEligible(wd.id);
    await markWithdrawalSent(wd.id, manager.id, "0xabc");

    const holding = await prisma.clientHolding.findUniqueOrThrow({
      where: { clientId: client.id },
    });
    const poolAfter = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    expect(holding.parts.toString()).toBe("850");
    expect(poolAfter.totalAssets.toString()).toBe("850");
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

  it("gate mensuel atteint : le surplus est différé, pas envoyé", async () => {
    const client = await makeClient("gate@test.local");
    const manager = await makeManager("mgr3@test.local");

    const dep = await requestDeposit(client.id, new Decimal(1000));
    await makeEligible(dep.id);
    await approveDeposit(dep.id, manager.id);

    // Gate = 20% de 1000 = 200. Le client demande 350.
    const wd = await requestWithdrawal(client.id, new Decimal(350));
    expect(wd.grantedAmount?.toString()).toBe("200");
    expect(wd.deferredAmount?.toString()).toBe("150");

    const pool = await prisma.poolState.findUniqueOrThrow({ where: { id: 1 } });
    expect(pool.gateUsedThisPeriod.toString()).toBe("200");
    // seule la part accordée est réellement sortie du pool
    expect(pool.totalAssets.toString()).toBe("800");
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
    expect(pool.gateUsedThisPeriod.toString()).toBe("0");
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
});
