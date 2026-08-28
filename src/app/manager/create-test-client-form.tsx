"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createTestClientAction } from "./actions";

export function CreateTestClientForm() {
  const t = useTranslations("manager");
  const [state, formAction, pending] = useActionState(createTestClientAction, {
    error: null,
    created: null,
  });

  return (
    <form action={formAction} className="flex gap-3 flex-wrap items-end">
      <div>
        <div className="text-xs text-muted mb-1">{t("name")}</div>
        <input name="name" placeholder="Client A" required className="w-32" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">{t("email")}</div>
        <input name="email" type="email" placeholder="client-a@test.local" required className="w-48" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">{t("password")}</div>
        <input name="password" placeholder={t("passwordMinChars")} required className="w-32" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">{t("initialDeposit")}</div>
        <input name="initialDeposit" type="number" step="any" min="0" required className="w-28" />
      </div>
      <button type="submit" disabled={pending} className="btn">
        {pending ? t("creating") : t("createTestClientButton")}
      </button>

      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
      {state.created && (
        <div className="text-green text-xs w-full">
          {t("clientCreated", { email: state.created.email, password: state.created.password })}
          {" — "}
          <a href={`/login?email=${encodeURIComponent(state.created.email)}`} className="underline">
            {t("loginPageLink")}
          </a>
          <span className="text-muted"> {t("willLogYouOut")}</span>
        </div>
      )}
    </form>
  );
}
