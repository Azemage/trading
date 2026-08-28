"use server";

import { cookies } from "next/headers";
import { type Locale, isLocale } from "./config";

const LOCALE_COOKIE = "NEXT_LOCALE";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale satisfies Locale, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
