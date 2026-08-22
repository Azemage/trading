"use client";

import { useActionState } from "react";
import { adjustPoolAction } from "./actions";

export function PoolAdjustForm({ currentTotalAssets }: { currentTotalAssets: number }) {
  const [state, formAction, pending] = useActionState(adjustPoolAction, { error: null });

  return (
    <form action={formAction} className="flex gap-3 flex-wrap items-end">
      <div>
        <div className="text-xs text-muted mb-1">Nouvel AUM total (actuel : {currentTotalAssets.toFixed(2)} $)</div>
        <input name="newTotalAssets" type="number" step="any" required className="w-36" />
      </div>
      <div className="flex-1 min-w-48">
        <div className="text-xs text-muted mb-1">Motif (obligatoire, tracé en audit)</div>
        <input name="reason" required placeholder="ex: scénario de test dépôt/retrait" className="w-full" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-red">
        {pending ? "Application…" : "Forcer cet AUM"}
      </button>
      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
    </form>
  );
}
