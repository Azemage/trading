"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { withdrawPerformanceFeesAction } from "./actions";

export function WithdrawFeeForm({ availableAmount }: { availableAmount: number }) {
  const t = useTranslations("manager");
  const [state, formAction, pending] = useActionState(withdrawPerformanceFeesAction, {
    error: null,
    success: null,
  });
  const amountRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex gap-3 flex-wrap items-end">
      <div>
        <div className="text-xs text-muted mb-1">{t("withdrawAmountLabel")}</div>
        <input
          ref={amountRef}
          name="amount"
          type="number"
          step="any"
          min="0"
          max={availableAmount}
          placeholder="0"
          required
          className="w-32"
        />
      </div>
      <button
        type="button"
        className="btn text-xs"
        onClick={() => {
          if (amountRef.current) amountRef.current.value = availableAmount.toFixed(2);
        }}
        disabled={availableAmount <= 0}
      >
        {t("withdrawAllButton", { amount: availableAmount.toFixed(2) })}
      </button>
      <div className="flex-1 min-w-40">
        <div className="text-xs text-muted mb-1">{t("note")}</div>
        <input name="note" className="w-full" />
      </div>
      <button type="submit" disabled={pending || availableAmount <= 0} className="btn btn-gold">
        {pending ? t("withdrawing") : t("withdrawSubmit")}
      </button>

      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
      {state.success && <div className="text-green text-xs w-full">{state.success}</div>}
    </form>
  );
}
