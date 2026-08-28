"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("resetPassword");
  const [state, formAction, pending] = useActionState(resetPasswordAction, { error: null });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6">{t("title")}</h1>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label-mono block mb-1">{t("newPassword")}</label>
          <input name="password" type="password" required minLength={10} className="w-full" />
        </div>
        <div>
          <label className="label-mono block mb-1">{t("confirmPassword")}</label>
          <input name="confirm" type="password" required minLength={10} className="w-full" />
        </div>
        {state.error && <div className="text-red text-sm">{state.error}</div>}
        <button type="submit" disabled={pending} className="btn w-full">
          {pending ? t("saving") : t("submit")}
        </button>
      </form>
    </div>
  );
}
