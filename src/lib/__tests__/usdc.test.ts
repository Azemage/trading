import { describe, expect, it } from "vitest";
import { validateUsdcAddress } from "../usdc";

describe("validateUsdcAddress", () => {
  it("accepte une adresse EVM valide sur Ethereum/Polygon/Base", () => {
    const addr = "0x" + "a".repeat(40);
    expect(validateUsdcAddress("ETHEREUM", addr).valid).toBe(true);
    expect(validateUsdcAddress("POLYGON", addr).valid).toBe(true);
    expect(validateUsdcAddress("BASE", addr).valid).toBe(true);
  });

  it("rejette une adresse EVM tronquée ou mal préfixée", () => {
    expect(validateUsdcAddress("ETHEREUM", "0x" + "a".repeat(39)).valid).toBe(false);
    expect(validateUsdcAddress("ETHEREUM", "a".repeat(42)).valid).toBe(false);
  });

  it("rejette une adresse Solana envoyée comme si c'était une adresse Ethereum", () => {
    // Adresse Solana typique (base58, ne commence pas par 0x)
    const solanaLike = "5FHwkrdxhgWVpNPUYbdU8XwEBqCT8Xzz1BpQCzT8Y8ib";
    expect(validateUsdcAddress("ETHEREUM", solanaLike).valid).toBe(false);
  });

  it("accepte une adresse Solana valide", () => {
    const solanaLike = "5FHwkrdxhgWVpNPUYbdU8XwEBqCT8Xzz1BpQCzT8Y8ib";
    expect(validateUsdcAddress("SOLANA", solanaLike).valid).toBe(true);
  });

  it("rejette un 0x envoyé comme adresse Solana", () => {
    const addr = "0x" + "a".repeat(40);
    expect(validateUsdcAddress("SOLANA", addr).valid).toBe(false);
  });

  it("accepte une adresse Tron valide (commence par T, 34 caractères)", () => {
    const tronLike = "T" + "9".repeat(33);
    expect(validateUsdcAddress("TRON", tronLike).valid).toBe(true);
  });

  it("rejette une adresse Tron qui ne commence pas par T", () => {
    const notTron = "A" + "9".repeat(33);
    expect(validateUsdcAddress("TRON", notTron).valid).toBe(false);
  });

  it("rejette une adresse vide sur n'importe quel réseau", () => {
    expect(validateUsdcAddress("OTHER", "").valid).toBe(false);
    expect(validateUsdcAddress("OTHER", "   ").valid).toBe(false);
  });

  it("réseau OTHER : accepte toute chaîne de longueur raisonnable", () => {
    expect(validateUsdcAddress("OTHER", "un-identifiant-quelconque-123").valid).toBe(true);
  });
});
