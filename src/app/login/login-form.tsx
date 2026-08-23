"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(loginAction, { error: null, needsCode: false });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6">Connexion</h1>
      <form action={formAction} className="space-y-3">
        <div>
          <label className="label-mono block mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            readOnly={state.needsCode}
            className="w-full"
          />
        </div>
        <div>
          <label className="label-mono block mb-1">Mot de passe</label>
          <input name="password" type="password" required className="w-full" />
        </div>
        {state.needsCode && (
          <div>
            <label className="label-mono block mb-1">Code de vérification (application 2FA)</label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              placeholder="123456"
              className="w-full"
            />
          </div>
        )}
        {state.error && <div className="text-red text-sm">{state.error}</div>}
        <button type="submit" disabled={pending} className="btn w-full">
          {pending ? "Connexion…" : state.needsCode ? "Vérifier →" : "Se connecter →"}
        </button>
      </form>
      <p className="text-xs text-muted mt-4">
        Pas encore de compte ? <a href="/register" className="text-green">Créer un compte</a>
      </p>
      <p className="text-xs text-muted mt-1">
        <a href="/forgot-password" className="text-green">Mot de passe oublié ?</a>
      </p>
    </div>
  );
}
