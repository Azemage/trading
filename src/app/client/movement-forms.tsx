"use client";

import { useActionState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { depositAction, withdrawAction } from "./actions";
import { fmtUsd } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export function MovementForms({
  kycVerified,
  maxWithdrawable,
}: {
  kycVerified: boolean;
  maxWithdrawable: number;
}) {
  const t = useTranslations("client");
  const locale = useLocale() as Locale;
  const fmt = (n: number) => fmtUsd(n, locale);
  const [depositState, depositFormAction, depositPending] = useActionState(depositAction, {
    error: null,
  });
  const [withdrawState, withdrawFormAction, withdrawPending] = useActionState(withdrawAction, {
    error: null,
  });
  const withdrawFormRef = useRef<HTMLFormElement>(null);
  const withdrawAmountRef = useRef<HTMLInputElement>(null);

  function handleWithdrawSubmit(e: React.FormEvent<HTMLFormElement>) {
    const raw = withdrawAmountRef.current?.value.trim().toLowerCase() ?? "";
    if (raw === "all" || raw === "") return;
    const requested = Number(raw);
    if (Number.isNaN(requested) || requested <= maxWithdrawable) return;

    e.preventDefault();
    const confirmed = window.confirm(t("confirmWithdrawCap", { amount: fmt(maxWithdrawable) }));
    if (confirmed && withdrawAmountRef.current) {
      withdrawAmountRef.current.value = "all";
      withdrawFormRef.current?.requestSubmit();
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="card">
        <div className="label-mono text-gold mb-3">{t("depositAction")}</div>
        <form action={depositFormAction} className="space-y-2">
          <input name="amount" type="number" step="0.01" min="0" required className="w-full" placeholder={t("amount")} />
          {depositState.error && <div className="text-red text-xs">{depositState.error}</div>}
          <button type="submit" disabled={depositPending || !kycVerified} className="btn">
            {depositPending ? t("sending") : t("requestDeposit")}
          </button>
        </form>
        {kycVerified ? (
          <div className="text-xs text-muted mt-2">{t("depositPendingHint")}</div>
        ) : (
          <div className="text-xs text-red mt-2">{t("kycRequiredForDeposit")}</div>
        )}
      </div>
      <div className="card">
        <div className="label-mono text-red mb-3">{t("withdrawAction")}</div>
        <form ref={withdrawFormRef} action={withdrawFormAction} onSubmit={handleWithdrawSubmit} className="space-y-2">
          <input
            ref={withdrawAmountRef}
            name="amount"
            required
            className="w-full"
            placeholder={t("amountOrAll")}
          />
          {withdrawState.error && <div className="text-red text-xs">{withdrawState.error}</div>}
          <button type="submit" disabled={withdrawPending || !kycVerified} className="btn btn-red">
            {withdrawPending ? t("sending") : t("requestWithdrawal")}
          </button>
        </form>
        {kycVerified ? (
          <>
            <div className="text-xs text-muted mt-2">{t("maxWithdrawable", { amount: fmt(maxWithdrawable) })}</div>
            <div className="text-xs text-muted">{t("withdrawPendingHint")}</div>
          </>
        ) : (
          <div className="text-xs text-red mt-2">{t("kycRequiredForWithdrawal")}</div>
        )}
      </div>
    </div>
  );
}
