import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { computeNav, partsForAmount, valueForParts } from "../nav";

describe("computeNav", () => {
  it("vaut 1 tant que le pool est vide (amorçage du tout premier dépôt)", () => {
    expect(computeNav(0, 0).toString()).toBe("1");
  });

  it("calcule assets / parts dans le cas normal", () => {
    expect(computeNav(1100, 1000).toString()).toBe("1.1");
  });

  it("ne divise jamais par zéro même avec des assets résiduels", () => {
    expect(computeNav(5, 0).toString()).toBe("1");
  });
});

describe("partsForAmount / valueForParts", () => {
  it("sont l'inverse l'une de l'autre", () => {
    const nav = new Decimal("1.2345");
    const parts = partsForAmount(1000, nav);
    const value = valueForParts(parts, nav);
    expect(value.toDecimalPlaces(8).toString()).toBe("1000");
  });
});
