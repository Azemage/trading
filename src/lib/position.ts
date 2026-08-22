import { Decimal } from "@prisma/client/runtime/library";
import { d, type Decimalish } from "./nav";

export type TradeDirection = "LONG" | "SHORT";

export const ALLOWED_LEVERAGES = [1, 2, 3, 5, 10, 20] as const;

/**
 * Calcule le résultat en % de l'AUM total d'une position, à partir d'un prix
 * d'entrée/sortie, d'un levier et de la taille de la position exprimée en %
 * de l'AUM (la mise réelle, marge, pas la valeur notionnelle).
 *
 * Ex: +10% sur la paire, levier x5 => +50% sur la mise ; 30% de l'AUM misé
 * => +15% de l'AUM total.
 *
 * La perte sur la mise est plafonnée à -100% (liquidation en marge isolée) :
 * on ne peut jamais perdre plus que ce qui a été engagé sur la position.
 */
export function computePositionPnlPct(params: {
  entryPrice: Decimalish;
  exitPrice: Decimalish;
  positionSizePct: Decimalish; // ex: 30 pour 30% de l'AUM
  direction: TradeDirection;
  leverage?: Decimalish; // 1 par défaut (spot, pas de levier)
}): { priceChangePct: Decimal; marginReturnPct: Decimal; pnlPctOfAum: Decimal } {
  const entryPrice = d(params.entryPrice);
  const exitPrice = d(params.exitPrice);
  const positionSizePct = d(params.positionSizePct);
  const leverage = params.leverage !== undefined ? d(params.leverage) : new Decimal(1);

  if (entryPrice.lessThanOrEqualTo(0)) {
    throw new Error("Le prix d'entrée doit être strictement positif");
  }
  if (leverage.lessThan(1)) {
    throw new Error("Le levier doit être supérieur ou égal à 1");
  }

  const rawChangePct = exitPrice.minus(entryPrice).dividedBy(entryPrice).times(100);
  const priceChangePct = params.direction === "SHORT" ? rawChangePct.negated() : rawChangePct;

  // Résultat rapporté à la mise réelle (marge), plafonné à -100% : impossible
  // de perdre plus que ce qui a été engagé sur la position.
  const marginReturnPct = Decimal.max(priceChangePct.times(leverage), -100);

  const pnlPctOfAum = marginReturnPct.times(positionSizePct).dividedBy(100);

  return { priceChangePct, marginReturnPct, pnlPctOfAum };
}
