"use client";

import { useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const t = useTranslations("register");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(registerAction, { error: null });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6">{t("title")}</h1>
      <form action={formAction} className="space-y-3">
        <div>
          <label className="label-mono block mb-1">{t("name")}</label>
          <input name="name" required className="w-full" />
        </div>
        <div>
          <label className="label-mono block mb-1">{t("preferredLanguage")}</label>
          <select name="preferredLocale" defaultValue={locale} className="w-full">
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Español</option>
          </select>
          <div className="text-xs text-muted mt-1">{t("preferredLanguageHint")}</div>
        </div>
        <div>
          <label className="label-mono block mb-1">{t("email")}</label>
          <input name="email" type="email" required className="w-full" />
        </div>
        <div>
          <label className="label-mono block mb-1">{t("password")}</label>
          <input name="password" type="password" minLength={10} required className="w-full" />
        </div>
        <div className="border-t border-line pt-3">
          <label className="label-mono block mb-1">{t("usdcAddress")}</label>
          <div className="flex gap-2">
            <select name="usdcNetwork" className="w-40">
              <option value="ETHEREUM">Ethereum</option>
              <option value="POLYGON">Polygon</option>
              <option value="BASE">Base</option>
              <option value="SOLANA">Solana</option>
              <option value="TRON">Tron</option>
              <option value="OTHER">{t("otherNetwork")}</option>
            </select>
            <input name="usdcAddress" placeholder={t("usdcAddressPlaceholder")} className="flex-1" />
          </div>
          <div className="text-xs text-muted mt-1">{t("usdcAddressHint")}</div>
        </div>
        {state.error && <div className="text-red text-sm">{state.error}</div>}
        <button type="submit" disabled={pending} className="btn w-full">
          {pending ? t("submitting") : t("submit")}
        </button>
      </form>
      <p className="text-xs text-muted mt-4">
        {t("hasAccount")} <a href="/login" className="text-green">{t("login")}</a>
      </p>
    </div>
  );
}
