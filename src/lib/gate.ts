import { Decimal } from "@prisma/client/runtime/library";
import { d, type Decimalish } from "./nav";
import { GATE_RATE } from "./constants";

export function computeGateBudget(totalAssets: Decimalish): Decimal {
  return d(totalAssets).times(GATE_RATE);
}

export function computeGateRemaining(
  totalAssets: Decimalish,
  gateUsedThisPeriod: Decimalish
): Decimal {
  const remaining = computeGateBudget(totalAssets).minus(d(gateUsedThisPeriod));
  return Decimal.max(remaining, 0);
}

export interface WithdrawalSplit {
  valueRequested: Decimal;
  partsRequested: Decimal;
  grantedValue: Decimal;
  grantedParts: Decimal;
  deferredValue: Decimal;
}

/**
 * Répartit une demande de retrait entre montant accordé immédiatement
 * (dans la limite du gate mensuel restant) et montant différé.
 * Le NAV utilisé doit être celui figé au moment de la demande.
 */
export function splitWithdrawal(params: {
  requestedAmount: Decimal; // valeur en $ demandée (déjà résolue si "all")
  clientParts: Decimalish;
  navAtRequest: Decimalish;
  gateRemaining: Decimalish;
}): WithdrawalSplit {
  const nav = d(params.navAtRequest);
  const clientParts = d(params.clientParts);
  const maxValue = clientParts.times(nav);
  const valueRequested = Decimal.min(d(params.requestedAmount), maxValue);
  const partsRequested = valueRequested.dividedBy(nav);

  const grantedValue = Decimal.min(valueRequested, d(params.gateRemaining));
  const grantedParts = grantedValue.dividedBy(nav);
  const deferredValue = valueRequested.minus(grantedValue);

  return { valueRequested, partsRequested, grantedValue, grantedParts, deferredValue };
}
