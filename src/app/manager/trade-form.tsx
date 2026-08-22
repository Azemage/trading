"use client";

import { useActionState } from "react";
import { logTradeAction } from "./actions";

export function TradeForm() {
  const [state, formAction, pending] = useActionState(logTradeAction, { error: null });

  return (
    <form action={formAction} className="flex gap-3 flex-wrap items-end">
      <div>
        <div className="text-xs text-muted mb-1">Résultat en % de l&apos;AUM</div>
        <input name="pnlPct" type="number" step="0.01" required className="w-28" />
      </div>
      <div className="flex-1 min-w-40">
        <div className="text-xs text-muted mb-1">Note (optionnel)</div>
        <input name="note" className="w-full" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-gold">
        {pending ? "Enregistrement…" : "Enregistrer →"}
      </button>
      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
    </form>
  );
}
