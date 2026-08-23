"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, { error: null });

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-xl font-bold mb-6">Créer un compte client</h1>
      <form action={formAction} className="space-y-3">
        <div>
          <label className="label-mono block mb-1">Nom</label>
          <input name="name" required className="w-full" />
        </div>
        <div>
          <label className="label-mono block mb-1">Email</label>
          <input name="email" type="email" required className="w-full" />
        </div>
        <div>
          <label className="label-mono block mb-1">Mot de passe (10 caractères min.)</label>
          <input name="password" type="password" minLength={10} required className="w-full" />
        </div>
        <div className="border-t border-line pt-3">
          <label className="label-mono block mb-1">Adresse USDC (optionnel, ajoutable plus tard)</label>
          <div className="flex gap-2">
            <select name="usdcNetwork" className="w-40">
              <option value="ETHEREUM">Ethereum</option>
              <option value="POLYGON">Polygon</option>
              <option value="BASE">Base</option>
              <option value="SOLANA">Solana</option>
              <option value="TRON">Tron</option>
              <option value="OTHER">Autre</option>
            </select>
            <input name="usdcAddress" placeholder="0x... / adresse" className="flex-1" />
          </div>
          <div className="text-xs text-muted mt-1">Requise avant de pouvoir demander un retrait.</div>
        </div>
        {state.error && <div className="text-red text-sm">{state.error}</div>}
        <button type="submit" disabled={pending} className="btn w-full">
          {pending ? "Création…" : "Créer le compte →"}
        </button>
      </form>
      <p className="text-xs text-muted mt-4">
        Déjà un compte ? <a href="/login" className="text-green">Se connecter</a>
      </p>
    </div>
  );
}
