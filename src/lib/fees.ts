import { Decimal } from "@prisma/client/runtime/library";
import { d, type Decimalish } from "./nav";
import { PERFORMANCE_FEE_RATE } from "./constants";

export interface TradeApplication {
  navBefore: Decimal;
  tradingFeeUsd: Decimal;
  totalAssetsAfterGross: Decimal;
  navAfterGross: Decimal;
  fee: Decimal;
  totalAssetsAfterNet: Decimal;
  navAfterNet: Decimal;
  newHighWaterMark: Decimal;
}

/**
 * Applique un résultat de trading (en % de l'AUM) au pool, avec performance
 * fee calculée UNIQUEMENT sur les gains au-dessus du high-water mark (évite
 * de facturer deux fois une même reprise après une perte).
 *
 * `tradingFeeUsd` (frais prélevés par la/les plateformes de trading — spread,
 * financement, frais d'exécution...) est déduit AVANT le calcul du % d'impact
 * sur l'AUM net et donc avant la performance fee : le gestionnaire ne facture
 * jamais sa part de performance sur des gains déjà consommés par ces frais.
 */
export function applyTradeResult(params: {
  totalAssetsBefore: Decimalish;
  totalParts: Decimalish;
  pnlPct: Decimalish; // ex: 5.25 pour +5.25%, -3 pour -3%
  highWaterMark: Decimalish;
  tradingFeeUsd?: Decimalish;
}): TradeApplication {
  const totalAssetsBefore = d(params.totalAssetsBefore);
  const totalParts = d(params.totalParts);
  const pnlFraction = d(params.pnlPct).dividedBy(100);
  const highWaterMark = d(params.highWaterMark);
  const tradingFeeUsd = params.tradingFeeUsd !== undefined ? d(params.tradingFeeUsd) : new Decimal(0);

  const navBefore = totalParts.greaterThan(0)
    ? totalAssetsBefore.dividedBy(totalParts)
    : new Decimal(1);

  const totalAssetsAfterGross = totalAssetsBefore.times(pnlFraction.plus(1)).minus(tradingFeeUsd);
  const navAfterGross = totalParts.greaterThan(0)
    ? totalAssetsAfterGross.dividedBy(totalParts)
    : new Decimal(1);

  const profitPerPartAboveHwm = Decimal.max(navAfterGross.minus(highWaterMark), 0);
  const fee = totalParts.greaterThan(0)
    ? profitPerPartAboveHwm.times(totalParts).times(PERFORMANCE_FEE_RATE)
    : new Decimal(0);

  const totalAssetsAfterNet = totalAssetsAfterGross.minus(fee);
  const navAfterNet = totalParts.greaterThan(0)
    ? totalAssetsAfterNet.dividedBy(totalParts)
    : new Decimal(1);

  const newHighWaterMark = Decimal.max(highWaterMark, navAfterNet);

  return {
    navBefore,
    tradingFeeUsd,
    totalAssetsAfterGross,
    navAfterGross,
    fee,
    totalAssetsAfterNet,
    navAfterNet,
    newHighWaterMark,
  };
}
