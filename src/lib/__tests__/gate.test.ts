import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { computeGateBudget, computeGateRemaining, splitWithdrawal } from "../gate";

describe("computeGateBudget / computeGateRemaining", () => {
  it("budget = 20% de l'AUM", () => {
    expect(computeGateBudget(10_000).toString()).toBe("2000");
  });

  it("ne devient jamais négatif si le gate déjà utilisé dépasse le budget", () => {
    expect(computeGateRemaining(10_000, 5_000).toString()).toBe("0");
  });
});

describe("splitWithdrawal — gate mensuel", () => {
  it("accorde tout le montant si le gate le permet", () => {
    const s = splitWithdrawal({
      requestedAmount: new Decimal(100),
      clientParts: new Decimal(200),
      navAtRequest: new Decimal(1),
      gateRemaining: new Decimal(2000),
    });
    expect(s.grantedValue.toString()).toBe("100");
    expect(s.deferredValue.toString()).toBe("0");
  });

  it("diffère le surplus quand le gate est atteint (cas limite critique)", () => {
    const s = splitWithdrawal({
      requestedAmount: new Decimal(500),
      clientParts: new Decimal(1000),
      navAtRequest: new Decimal(1),
      gateRemaining: new Decimal(300), // gate déjà presque consommé ce mois
    });
    expect(s.grantedValue.toString()).toBe("300");
    expect(s.deferredValue.toString()).toBe("200");
    expect(s.grantedParts.toString()).toBe("300");
  });

  it("refuse d'accorder plus que le solde réel du client même si le gate est large", () => {
    const s = splitWithdrawal({
      requestedAmount: new Decimal(1_000_000), // "all" mal calculé ou demande abusive
      clientParts: new Decimal(50),
      navAtRequest: new Decimal(2),
      gateRemaining: new Decimal(1_000_000),
    });
    // le client ne possède que 50 parts * NAV 2 = 100 de valeur réelle
    expect(s.valueRequested.toString()).toBe("100");
    expect(s.grantedValue.toString()).toBe("100");
  });

  it("gate à zéro : tout le retrait est différé", () => {
    const s = splitWithdrawal({
      requestedAmount: new Decimal(50),
      clientParts: new Decimal(100),
      navAtRequest: new Decimal(1),
      gateRemaining: new Decimal(0),
    });
    expect(s.grantedValue.toString()).toBe("0");
    expect(s.deferredValue.toString()).toBe("50");
  });
});
