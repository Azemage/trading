import { Decimal } from "@prisma/client/runtime/library";
import { d, type Decimalish } from "./nav";

export type TradeDirection = "LONG" | "SHORT";

/**
 * Calcule le résultat en % de l'AUM total d'une position, à partir d'un prix
 * d'entrée/sortie et de la taille de la position exprimée en % de l'AUM.
 *
 * Ex: +10% sur la paire, 30% de l'AUM misé => +3% de l'AUM total.
 */
export function computePositionPnlPct(params: {
  entryPrice: Decimalish;
  exitPrice: Decimalish;
  positionSizePct: Decimalish; // ex: 30 pour 30% de l'AUM
  direction: TradeDirection;
}): { priceChangePct: Decimal; pnlPctOfAum: Decimal } {
  const entryPrice = d(params.entryPrice);
  const exitPrice = d(params.exitPrice);
  const positionSizePct = d(params.positionSizePct);

  if (entryPrice.lessThanOrEqualTo(0)) {
    throw new Error("Le prix d'entrée doit être strictement positif");
  }

  const rawChangePct = exitPrice.minus(entryPrice).dividedBy(entryPrice).times(100);
  const priceChangePct = params.direction === "SHORT" ? rawChangePct.negated() : rawChangePct;
  const pnlPctOfAum = priceChangePct.times(positionSizePct).dividedBy(100);

  return { priceChangePct, pnlPctOfAum };
}
