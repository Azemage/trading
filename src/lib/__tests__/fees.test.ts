import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTradeResult } from "../fees";

describe("applyTradeResult — performance fee au high-water mark", () => {
  it("prélève 30% du gain quand on dépasse le HWM initial", () => {
    const r = applyTradeResult({
      totalAssetsBefore: 1000,
      totalParts: 1000, // NAV = 1
      pnlPct: 10, // +10% => 1100 brut, gain de 100 au-dessus du HWM=1
      highWaterMark: 1,
    });
    expect(r.fee.toString()).toBe("30"); // 30% de 100
    expect(r.totalAssetsAfterNet.toString()).toBe("1070");
    expect(r.newHighWaterMark.toString()).toBe(r.navAfterNet.toString());
  });

  it("ne prélève aucun frais sur un résultat négatif", () => {
    const r = applyTradeResult({
      totalAssetsBefore: 1000,
      totalParts: 1000,
      pnlPct: -8,
      highWaterMark: 1,
    });
    expect(r.fee.toString()).toBe("0");
    expect(r.totalAssetsAfterNet.toString()).toBe("920");
    // le HWM ne baisse jamais
    expect(r.newHighWaterMark.toString()).toBe("1");
  });

  it("ne refacture pas une simple remontée jusqu'au HWM après une perte (pas de double frais)", () => {
    // Après une perte, le NAV est à 0.9 ; le HWM reste à 1.
    const r = applyTradeResult({
      totalAssetsBefore: 900,
      totalParts: 1000, // NAV brut avant ce trade = 0.9
      pnlPct: new Decimal(100).dividedBy(9), // remonte tout juste à 1000 (NAV=1), pile le HWM
      highWaterMark: 1,
    });
    expect(r.navAfterGross.toDecimalPlaces(8).toString()).toBe("1");
    expect(r.fee.toString()).toBe("0");
  });

  it("ne facture que la portion de gain qui dépasse le HWM lors d'une remontée au-delà", () => {
    // NAV avant = 0.9 (perte précédente), HWM = 1. Ce trade fait +20% => NAV brut = 1.08.
    // Seul le dépassement au-dessus de 1 (soit 0.08 par part) doit être facturé.
    const r = applyTradeResult({
      totalAssetsBefore: 900,
      totalParts: 1000,
      pnlPct: 20,
      highWaterMark: 1,
    });
    expect(r.navAfterGross.toString()).toBe("1.08");
    // gain facturable = (1.08 - 1) * 1000 parts = 80 ; fee = 30% => 24
    expect(r.fee.toString()).toBe("24");
    expect(r.totalAssetsAfterNet.toString()).toBe("1056");
  });

  it("ne divise jamais par zéro si le pool est encore vide", () => {
    const r = applyTradeResult({
      totalAssetsBefore: 0,
      totalParts: 0,
      pnlPct: 5,
      highWaterMark: 1,
    });
    expect(r.fee.toString()).toBe("0");
    expect(r.navAfterNet.toString()).toBe("1");
  });
});
