import { describe, expect, it } from "vitest";
import { computePositionPnlPct } from "../position";

describe("computePositionPnlPct", () => {
  it("long gagnant sans levier : +10% sur la paire, 30% de l'AUM misé => +3% de l'AUM", () => {
    const r = computePositionPnlPct({
      entryPrice: 100,
      exitPrice: 110,
      positionSizePct: 30,
      direction: "LONG",
    });
    expect(r.priceChangePct.toString()).toBe("10");
    expect(r.pnlPctOfAum.toString()).toBe("3");
  });

  it("long perdant sans levier : -20% sur la paire, 50% de l'AUM misé => -10% de l'AUM", () => {
    const r = computePositionPnlPct({
      entryPrice: 100,
      exitPrice: 80,
      positionSizePct: 50,
      direction: "LONG",
    });
    expect(r.pnlPctOfAum.toString()).toBe("-10");
  });

  it("short gagnant : le prix baisse, le short gagne", () => {
    const r = computePositionPnlPct({
      entryPrice: 100,
      exitPrice: 90,
      positionSizePct: 40,
      direction: "SHORT",
    });
    expect(r.priceChangePct.toString()).toBe("10"); // +10% pour le short
    expect(r.pnlPctOfAum.toString()).toBe("4");
  });

  it("short perdant : le prix monte, le short perd", () => {
    const r = computePositionPnlPct({
      entryPrice: 100,
      exitPrice: 120,
      positionSizePct: 25,
      direction: "SHORT",
    });
    expect(r.pnlPctOfAum.toString()).toBe("-5");
  });

  it("position à 100% de l'AUM => pnl de l'AUM == variation de prix", () => {
    const r = computePositionPnlPct({
      entryPrice: 50,
      exitPrice: 55,
      positionSizePct: 100,
      direction: "LONG",
    });
    expect(r.pnlPctOfAum.toString()).toBe(r.priceChangePct.toString());
  });

  it("rejette un prix d'entrée nul ou négatif", () => {
    expect(() =>
      computePositionPnlPct({ entryPrice: 0, exitPrice: 10, positionSizePct: 10, direction: "LONG" })
    ).toThrow();
  });

  describe("levier", () => {
    it("multiplie le résultat sur la mise par le levier (ex utilisateur : +10% en x5)", () => {
      // AUM = 1000, 10% misé = 100 de mise réelle, x5 => mise notionnelle 500.
      const r = computePositionPnlPct({
        entryPrice: 100,
        exitPrice: 110, // +10% sur la paire
        positionSizePct: 10,
        direction: "LONG",
        leverage: 5,
      });
      // +10% * x5 = +50% sur la mise ; 10% de l'AUM misé => +5% de l'AUM total.
      expect(r.marginReturnPct.toString()).toBe("50");
      expect(r.pnlPctOfAum.toString()).toBe("5");
    });

    it("plafonne la perte à -100% de la mise (liquidation), jamais au-delà", () => {
      const r = computePositionPnlPct({
        entryPrice: 100,
        exitPrice: 70, // -30% sur la paire
        positionSizePct: 20,
        direction: "LONG",
        leverage: 5, // -30% * x5 = -150% brut, doit être plafonné à -100%
      });
      expect(r.marginReturnPct.toString()).toBe("-100");
      // -100% de la mise (20% de l'AUM) => -20% de l'AUM total, pas -30%.
      expect(r.pnlPctOfAum.toString()).toBe("-20");
    });

    it("levier 1 par défaut si non précisé (comportement inchangé)", () => {
      const withDefault = computePositionPnlPct({
        entryPrice: 100,
        exitPrice: 115,
        positionSizePct: 40,
        direction: "LONG",
      });
      const withExplicit1 = computePositionPnlPct({
        entryPrice: 100,
        exitPrice: 115,
        positionSizePct: 40,
        direction: "LONG",
        leverage: 1,
      });
      expect(withDefault.pnlPctOfAum.toString()).toBe(withExplicit1.pnlPctOfAum.toString());
    });

    it("rejette un levier inférieur à 1", () => {
      expect(() =>
        computePositionPnlPct({
          entryPrice: 100,
          exitPrice: 110,
          positionSizePct: 10,
          direction: "LONG",
          leverage: 0.5,
        })
      ).toThrow();
    });
  });
});
