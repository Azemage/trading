import { Decimal } from "@prisma/client/runtime/library";
import { d, type Decimalish } from "./nav";
import { AppError } from "./app-error";

export class PositionError extends AppError {}

export type TradeDirection = "LONG" | "SHORT";

export { ALLOWED_LEVERAGES } from "./leverage-options"; // ré-exporté pour l'usage côté serveur (actions.ts)

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
    throw new PositionError("POSITION_ENTRY_PRICE_POSITIVE");
  }
  if (leverage.lessThan(1)) {
    throw new PositionError("POSITION_LEVERAGE_MIN");
  }

  const rawChangePct = exitPrice.minus(entryPrice).dividedBy(entryPrice).times(100);
  const priceChangePct = params.direction === "SHORT" ? rawChangePct.negated() : rawChangePct;

  // Résultat rapporté à la mise réelle (marge), plafonné à -100% : impossible
  // de perdre plus que ce qui a été engagé sur la position.
  const marginReturnPct = Decimal.max(priceChangePct.times(leverage), -100);

  const pnlPctOfAum = marginReturnPct.times(positionSizePct).dividedBy(100);

  return { priceChangePct, marginReturnPct, pnlPctOfAum };
}
