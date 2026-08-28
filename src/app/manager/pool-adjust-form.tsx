"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { adjustPoolAction } from "./actions";

export function PoolAdjustForm({ currentTotalAssets }: { currentTotalAssets: number }) {
  const t = useTranslations("manager");
  const [state, formAction, pending] = useActionState(adjustPoolAction, { error: null });

  return (
    <form action={formAction} className="flex gap-3 flex-wrap items-end">
      <div>
        <div className="text-xs text-muted mb-1">{t("newTotalAum", { amount: currentTotalAssets.toFixed(2) })}</div>
        <input name="newTotalAssets" type="number" step="any" required className="w-36" />
      </div>
      <div className="flex-1 min-w-48">
        <div className="text-xs text-muted mb-1">{t("adjustReason")}</div>
        <input name="reason" required placeholder={t("adjustReasonPlaceholder")} className="w-full" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-red">
        {pending ? t("applying") : t("forceAum")}
      </button>
      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
    </form>
  );
}
