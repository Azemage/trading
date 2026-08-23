"use client";

import { useActionState, useState } from "react";
import { beginTwoFactorSetupAction, confirmTwoFactorSetupAction, disableTwoFactorAction } from "./actions";

export function TwoFactorSettings({ initiallyEnabled }: { initiallyEnabled: boolean }) {
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
        <div className="text-green text-sm">2FA activée ✓ — un code te sera demandé à chaque connexion.</div>
        <form action={disableAction} className="flex gap-2 items-start flex-wrap">
          <input
            name="password"
            type="password"
            placeholder="Mot de passe actuel"
            required
            className="text-sm"
          />
          <button type="submit" disabled={disablePending} className="btn btn-red">
            {disablePending ? "…" : "Désactiver la 2FA"}
          </button>
        </form>
        {disableState.error && <div className="text-red text-sm">{disableState.error}</div>}
      </div>
    );
  }

  if (!beginState.qrCodeDataUrl) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted">
          La 2FA ajoute un code à usage unique (application type Google Authenticator, Authy…) en plus du mot de
          passe à chaque connexion.
        </div>
        <form action={beginAction}>
          <button type="submit" disabled={beginPending} className="btn">
            {beginPending ? "Génération…" : "Configurer la 2FA →"}
          </button>
        </form>
        {beginState.error && <div className="text-red text-sm">{beginState.error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">
        Scanne ce QR code avec ton application d&apos;authentification, puis saisis le code généré pour confirmer.
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={beginState.qrCodeDataUrl} alt="QR code 2FA" className="w-40 h-40 rounded border border-line bg-white p-1" />
      <div className="text-xs text-muted">
        Impossible de scanner ? Code manuel : <code className="text-foreground">{beginState.secret}</code>
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
          {confirmPending ? "Vérification…" : "Activer →"}
        </button>
      </form>
      {confirmState.error && <div className="text-red text-sm">{confirmState.error}</div>}
    </div>
  );
}
