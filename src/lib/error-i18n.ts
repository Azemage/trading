import { getTranslations } from "next-intl/server";
import { AppError } from "./app-error";

/** Traduit une erreur métier (AppError) dans la langue active, avec repli générique. */
export async function translateActionError(e: unknown): Promise<string> {
  const t = await getTranslations("errors");
  if (e instanceof AppError) {
    return t(e.code, e.values);
  }
  if (e instanceof Error) return e.message;
  return t("UNKNOWN");
}
