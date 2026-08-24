"use client";

import { useActionState } from "react";
import { submitKycAction } from "./actions";

export function KycForm() {
  const [state, formAction, pending] = useActionState(submitKycAction, { error: null });

  return (
    <form action={formAction} className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted block mb-1">Nom légal complet</label>
          <input name="legalName" required className="w-full" />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Type de document</label>
          <select name="documentType" required className="w-full">
            <option value="Passeport">Passeport</option>
            <option value="Carte d'identité">Carte d&apos;identité</option>
            <option value="Permis de conduire">Permis de conduire</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Numéro de document</label>
        <input name="documentNumber" required className="w-full" />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted block mb-1">Photo recto</label>
          <input name="idFront" type="file" accept="image/jpeg,image/png,image/webp" required className="w-full text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Photo verso</label>
          <input name="idBack" type="file" accept="image/jpeg,image/png,image/webp" required className="w-full text-xs" />
        </div>
      </div>
      <div className="text-xs text-muted">JPEG, PNG ou WebP, 1,5 Mo maximum par photo.</div>
      <div>
        <label className="text-xs text-muted block mb-1">Note (optionnel)</label>
        <input name="note" className="w-full" />
      </div>
      {state.error && <div className="text-red text-xs">{state.error}</div>}
      <button type="submit" disabled={pending} className="btn">
        {pending ? "Envoi…" : "Soumettre pour vérification →"}
      </button>
    </form>
  );
}
