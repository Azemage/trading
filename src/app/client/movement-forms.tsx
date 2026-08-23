"use client";

import { useActionState, useRef } from "react";
import { depositAction, withdrawAction } from "./actions";

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

export function MovementForms({
  kycVerified,
  maxWithdrawable,
}: {
  kycVerified: boolean;
  maxWithdrawable: number;
}) {
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
    const confirmed = window.confirm(
      `Tu ne peux retirer que ${fmt(maxWithdrawable)}. Veux-tu confirmer ce retrait de ${fmt(maxWithdrawable)} ?`
    );
    if (confirmed && withdrawAmountRef.current) {
      withdrawAmountRef.current.value = "all";
      withdrawFormRef.current?.requestSubmit();
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="card">
        <div className="label-mono text-gold mb-3">Déposer</div>
        <form action={depositFormAction} className="space-y-2">
          <input name="amount" type="number" step="0.01" min="0" required className="w-full" placeholder="Montant" />
          {depositState.error && <div className="text-red text-xs">{depositState.error}</div>}
          <button type="submit" disabled={depositPending || !kycVerified} className="btn">
            {depositPending ? "Envoi…" : "Demander le dépôt →"}
          </button>
        </form>
        {kycVerified ? (
          <div className="text-xs text-muted mt-2">
            Passe en attente jusqu&apos;à validation du gestionnaire (délai anti-arbitrage).
          </div>
        ) : (
          <div className="text-xs text-red mt-2">
            Remplis ta vérification KYC (section &quot;Mon compte&quot;) avant de faire ton premier dépôt.
          </div>
        )}
      </div>
      <div className="card">
        <div className="label-mono text-red mb-3">Retirer</div>
        <form ref={withdrawFormRef} action={withdrawFormAction} onSubmit={handleWithdrawSubmit} className="space-y-2">
          <input
            ref={withdrawAmountRef}
            name="amount"
            required
            className="w-full"
            placeholder='Montant ou "all"'
          />
          {withdrawState.error && <div className="text-red text-xs">{withdrawState.error}</div>}
          <button type="submit" disabled={withdrawPending || !kycVerified} className="btn btn-red">
            {withdrawPending ? "Envoi…" : "Demander le retrait →"}
          </button>
        </form>
        {kycVerified ? (
          <>
            <div className="text-xs text-muted mt-2">Retrait max : {fmt(maxWithdrawable)}</div>
            <div className="text-xs text-muted">
              Passe en attente pendant le délai anti-arbitrage avant l&apos;envoi effectif.
            </div>
          </>
        ) : (
          <div className="text-xs text-red mt-2">
            Remplis ta vérification KYC (section &quot;Mon compte&quot;) avant de pouvoir demander un retrait.
          </div>
        )}
      </div>
    </div>
  );
}
