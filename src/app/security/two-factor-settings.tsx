"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { beginTwoFactorSetupAction, confirmTwoFactorSetupAction, disableTwoFactorAction } from "./actions";

export function TwoFactorSettings({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const t = useTranslations("security");
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [beginState, beginAction, beginPending] = useActionState(beginTwoFactorSetupAction, {
    error: null,
    qrCodeDataUrl: null,
    secret: null,
  });
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmTwoFactorSetupAction, {
    error: null,
    success: false,
  });
  const [disableState, disableAction, disablePending] = useActionState(disableTwoFactorAction, { error: null });

  if (confirmState.success && !enabled) {
    setEnabled(true);
  }

  if (enabled) {
    return (
      <div className="space-y-3">
        <div className="text-green text-sm">{t("enabled")}</div>
        <form action={disableAction} className="flex gap-2 items-start flex-wrap">
          <input
            name="password"
            type="password"
            placeholder={t("currentPassword")}
            required
            className="text-sm"
          />
          <button type="submit" disabled={disablePending} className="btn btn-red">
            {disablePending ? "…" : t("disable")}
          </button>
        </form>
        {disableState.error && <div className="text-red text-sm">{disableState.error}</div>}
      </div>
    );
  }

  if (!beginState.qrCodeDataUrl) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted">{t("intro")}</div>
        <form action={beginAction}>
          <button type="submit" disabled={beginPending} className="btn">
            {beginPending ? t("generating") : t("configure")}
          </button>
        </form>
        {beginState.error && <div className="text-red text-sm">{beginState.error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">{t("scanHint")}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beginState.qrCodeDataUrl} alt={t("qrAlt")} className="w-40 h-40 rounded border border-line bg-white p-1" />
      <div className="text-xs text-muted">
        {t("manualCode")} <code className="text-foreground">{beginState.secret}</code>
      </div>
      <form action={confirmAction} className="flex gap-2 items-start flex-wrap">
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
          className="text-sm"
        />
        <button type="submit" disabled={confirmPending} className="btn">
          {confirmPending ? t("verifying") : t("activate")}
        </button>
      </form>
      {confirmState.error && <div className="text-red text-sm">{confirmState.error}</div>}
    </div>
  );
}
