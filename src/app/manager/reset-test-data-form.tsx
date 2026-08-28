"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { resetAllTestDataAction } from "./actions";

export function ResetTestDataForm() {
  const t = useTranslations("manager");
  const [state, formAction, pending] = useActionState(resetAllTestDataAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("resetConfirm"))) {
          e.preventDefault();
        }
      }}
      className="flex gap-3 flex-wrap items-end"
    >
      <div>
        <div className="text-xs text-muted mb-1">
          {t("typeToConfirm")} <span className="text-red font-bold">RESET</span> {t("toConfirmSuffix")}
        </div>
        <input name="confirm" required className="w-32" autoComplete="off" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-red">
        {pending ? t("resetting") : t("resetAllButton")}
      </button>
      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
    </form>
  );
}
