function isDecimalLike(value: unknown): value is { toNumber(): number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toNumber?: unknown }).toNumber === "function" &&
    typeof (value as { toFixed?: unknown }).toFixed === "function"
  );
}

/** Convertit récursivement les Decimal/Date Prisma en valeurs JSON-safe.
 * Détection par duck-typing plutôt que `instanceof` : selon le bundler,
 * le Decimal.js utilisé par le client Prisma généré peut être une copie de
 * module distincte de celle importée ici, ce qui casse `instanceof`. */
export function serialize<T>(value: T): unknown {
  if (isDecimalLike(value)) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])
    );
  }
  return value;
}
