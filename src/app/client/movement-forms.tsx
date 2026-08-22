"use client";

import { useActionState } from "react";
import { depositAction, withdrawAction } from "./actions";

export function MovementForms({ gateRemaining }: { gateRemaining: number }) {
  const [depositState, depositFormAction, depositPending] = useActionState(depositAction, {
    error: null,
  });
  const [withdrawState, withdrawFormAction, withdrawPending] = useActionState(withdrawAction, {
    error: null,
  });

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="card">
        <div className="label-mono text-gold mb-3">Déposer</div>
        <form action={depositFormAction} className="space-y-2">
          <input name="amount" type="number" step="0.01" min="0" required className="w-full" placeholder="Montant" />
          {depositState.error && <div className="text-red text-xs">{depositState.error}</div>}
          <button type="submit" disabled={depositPending} className="btn">
            {depositPending ? "Envoi…" : "Demander le dépôt →"}
          </button>
        </form>
        <div className="text-xs text-muted mt-2">
          Passe en attente jusqu&apos;à validation du gestionnaire (délai anti-arbitrage).
        </div>
      </div>
      <div className="card">
        <div className="label-mono text-red mb-3">Retirer</div>
        <form action={withdrawFormAction} className="space-y-2">
          <input name="amount" required className="w-full" placeholder='Montant ou "all"' />
          {withdrawState.error && <div className="text-red text-xs">{withdrawState.error}</div>}
          <button type="submit" disabled={withdrawPending} className="btn btn-red">
            {withdrawPending ? "Envoi…" : "Demander le retrait →"}
          </button>
        </form>
        <div className="text-xs text-muted mt-2">
          Soumis au gate mensuel. Budget restant : {gateRemaining.toFixed(2)} $
        </div>
      </div>
    </div>
  );
}
