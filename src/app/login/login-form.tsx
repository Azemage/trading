"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "./actions";

export function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState(loginAction, { error: null, needsCode: false });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6">{t("title")}</h1>
      <form action={formAction} className="space-y-3">
        <div>
          <label className="label-mono block mb-1">{t("email")}</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            readOnly={state.needsCode}
            className="w-full"
          />
        </div>
        <div>
          <label className="label-mono block mb-1">{t("password")}</label>
          <input name="password" type="password" required className="w-full" />
        </div>
        {state.needsCode && (
          <div>
            <label className="label-mono block mb-1">{t("code")}</label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              placeholder="123456"
              className="w-full"
            />
          </div>
        )}
        {state.error && <div className="text-red text-sm">{state.error}</div>}
        <button type="submit" disabled={pending} className="btn w-full">
          {pending ? t("submitting") : state.needsCode ? t("verify") : t("submit")}
        </button>
      </form>
      <p className="text-xs text-muted mt-4">
        {t("noAccount")} <a href="/register" className="text-green">{t("createAccount")}</a>
      </p>
      <p className="text-xs text-muted mt-1">
        <a href="/forgot-password" className="text-green">{t("forgotPassword")}</a>
      </p>
    </div>
  );
}
