"use client";

import { useActionState } from "react";
import { createTestClientAction } from "./actions";

export function CreateTestClientForm() {
  const [state, formAction, pending] = useActionState(createTestClientAction, {
    error: null,
    created: null,
  });

  return (
    <form action={formAction} className="flex gap-3 flex-wrap items-end">
      <div>
        <div className="text-xs text-muted mb-1">Nom</div>
        <input name="name" placeholder="Client A" required className="w-32" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">Email</div>
        <input name="email" type="email" placeholder="client-a@test.local" required className="w-48" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">Mot de passe</div>
        <input name="password" placeholder="min. 8 caractères" required className="w-32" />
      </div>
      <div>
        <div className="text-xs text-muted mb-1">Dépôt initial ($)</div>
        <input name="initialDeposit" type="number" step="any" min="0" required className="w-28" />
      </div>
      <button type="submit" disabled={pending} className="btn">
        {pending ? "Création…" : "Créer le client de test"}
      </button>

      {state.error && <div className="text-red text-xs w-full">{state.error}</div>}
      {state.created && (
        <div className="text-green text-xs w-full">
          Client créé — connexion : {state.created.email} / {state.created.password}
        </div>
      )}
    </form>
  );
}
