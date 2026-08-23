/** Échappe une valeur pour une cellule CSV (RFC 4180) : guillemets doublés, entoure si nécessaire. */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Construit un CSV (en-têtes + lignes) à partir d'objets, dans l'ordre de colonnes fourni. */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c.key])).join(","));
  // BOM UTF-8 pour un affichage correct des accents dans Excel.
  return "﻿" + [headerLine, ...lines].join("\r\n") + "\r\n";
}
