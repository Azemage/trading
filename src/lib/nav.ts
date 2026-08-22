import { Decimal } from "@prisma/client/runtime/library";

export type Decimalish = Decimal | number | string;

function isDecimalLike(value: unknown): value is { toFixed(): string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toFixed?: unknown }).toFixed === "function"
  );
}

/**
 * Normalise n'importe quelle valeur numérique en Decimal.
 * Utilise un duck-type plutôt que `instanceof` : selon le bundler, le
 * Decimal.js utilisé en interne par le client Prisma généré peut être une
 * copie de module distincte de celle importée ici (cassant `instanceof`),
 * d'où la reconstruction via `toFixed()` (pleine précision, sans notation
 * exponentielle) plutôt qu'un cast direct.
 */
export function d(value: Decimalish): Decimal {
  if (value instanceof Decimal) return value;
  if (isDecimalLike(value)) return new Decimal(value.toFixed());
  return new Decimal(value);
}

/**
 * NAV par part. Convention du prototype validé : 1.0 tant qu'il n'y a aucune
 * part émise (pool vide), pour amorcer proprement le tout premier dépôt.
 */
export function computeNav(totalAssets: Decimalish, totalParts: Decimalish): Decimal {
  const parts = d(totalParts);
  if (parts.lessThanOrEqualTo(0)) return new Decimal(1);
  return d(totalAssets).dividedBy(parts);
}

export function partsForAmount(amount: Decimalish, nav: Decimalish): Decimal {
  return d(amount).dividedBy(d(nav));
}

export function valueForParts(parts: Decimalish, nav: Decimalish): Decimal {
  return d(parts).times(d(nav));
}
