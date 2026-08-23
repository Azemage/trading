"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, { message: null });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-2">Mot de passe oublié</h1>
      <p className="text-xs text-muted mb-6">
        Indique ton email, tu recevras un lien pour choisir un nouveau mot de passe s&apos;il correspond à un compte.
      </p>
      {state.message ? (
        <div className="text-green text-sm">{state.message}</div>
      ) : (
        <form action={formAction} className="space-y-3">
          <div>
            <label className="label-mono block mb-1">Email</label>
            <input name="email" type="email" required className="w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn w-full">
            {pending ? "Envoi…" : "Envoyer le lien →"}
          </button>
        </form>
      )}
      <p className="text-xs text-muted mt-4">
        <a href="/login" className="text-green">← Retour à la connexion</a>
      </p>
    </div>
  );
}
