import { Decimal } from "@prisma/client/runtime/library";
import { d, type Decimalish } from "./nav";
import { PERFORMANCE_FEE_RATE } from "./constants";

export interface TradeApplication {
  navBefore: Decimal;
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
 */
export function applyTradeResult(params: {
  totalAssetsBefore: Decimalish;
  totalParts: Decimalish;
  pnlPct: Decimalish; // ex: 5.25 pour +5.25%, -3 pour -3%
  highWaterMark: Decimalish;
}): TradeApplication {
  const totalAssetsBefore = d(params.totalAssetsBefore);
  const totalParts = d(params.totalParts);
  const pnlFraction = d(params.pnlPct).dividedBy(100);
  const highWaterMark = d(params.highWaterMark);

  const navBefore = totalParts.greaterThan(0)
    ? totalAssetsBefore.dividedBy(totalParts)
    : new Decimal(1);

  const totalAssetsAfterGross = totalAssetsBefore.times(pnlFraction.plus(1));
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
    totalAssetsAfterGross,
    navAfterGross,
    fee,
    totalAssetsAfterNet,
    navAfterNet,
    newHighWaterMark,
  };
}
