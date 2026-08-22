import { describe, expect, it } from "vitest";
import { computePositionPnlPct } from "../position";

describe("computePositionPnlPct", () => {
  it("long gagnant : +10% sur la paire, 30% de l'AUM misé => +3% de l'AUM", () => {
    const r = computePositionPnlPct({
      entryPrice: 100,
      exitPrice: 110,
      positionSizePct: 30,
      direction: "LONG",
    });
    expect(r.priceChangePct.toString()).toBe("10");
    expect(r.pnlPctOfAum.toString()).toBe("3");
  });

  it("long perdant : -20% sur la paire, 50% de l'AUM misé => -10% de l'AUM", () => {
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
});
