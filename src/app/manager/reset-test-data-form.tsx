"use client";

import { useActionState, useRef } from "react";
import { resetAllTestDataAction } from "./actions";

export function ResetTestDataForm() {
  const [state, formAction, pending] = useActionState(resetAllTestDataAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Effacer TOUTES les données (clients, dépôts, retraits, trades, frais) et repartir à zéro ? Cette action est irréversible."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex gap-3 flex-wrap items-end"
    >
      <div>
        <div className="text-xs text-muted mb-1">
          Tape <span className="text-red font-bold">RESET</span> pour confirmer
        </div>
        <input name="confirm" required className="w-32" autoComplete="off" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-red">
        {pending ? "Réinitialisation…" : "🗑️ Tout réinitialiser"}
      </button>
      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
    </form>
  );
}
