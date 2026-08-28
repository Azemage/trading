import type { Locale } from "@/i18n/config";

const INTL_LOCALES: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
};

/** Formatte un montant en dollars selon la locale active (séparateurs, virgule/point). */
export function fmtUsd(n: number, locale: Locale): string {
  return n.toLocaleString(INTL_LOCALES[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

/** Formatte une date/heure selon la locale active. */
export function fmtDateTime(d: Date, locale: Locale): string {
  return d.toLocaleString(INTL_LOCALES[locale]);
}
