"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendWeeklyReportsAction } from "./actions";

export function SendWeeklyReportsForm() {
  const t = useTranslations("manager");
  const [state, formAction, pending] = useActionState(sendWeeklyReportsAction, { error: null, result: null });

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="btn btn-gold">
        {pending ? t("sendingReports") : t("sendReportsButton")}
      </button>
      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
      {state.result && (
        <div className={`text-xs w-full ${state.result.failed > 0 ? "text-red" : "text-green"}`}>
          {t("reportsSent", {
            sent: state.result.sent,
            failed: state.result.failed,
            skipped: state.result.skipped,
          })}
          {state.result.firstError && (
            <div className="text-muted mt-1">
              {t("reportsFirstError", { error: state.result.firstError })}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
