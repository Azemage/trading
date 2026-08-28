"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword");
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, { message: null });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-2">{t("title")}</h1>
      <p className="text-xs text-muted mb-6">{t("hint")}</p>
      {state.message ? (
        <div className="text-green text-sm">{state.message}</div>
      ) : (
        <form action={formAction} className="space-y-3">
          <div>
            <label className="label-mono block mb-1">{t("email")}</label>
            <input name="email" type="email" required className="w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn w-full">
            {pending ? t("sending") : t("submit")}
          </button>
        </form>
      )}
      <p className="text-xs text-muted mt-4">
        <a href="/login" className="text-green">{t("backToLogin")}</a>
      </p>
    </div>
  );
}
