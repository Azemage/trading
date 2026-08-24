"use client";

import { useActionState, useState } from "react";
import { submitKycAction } from "./actions";

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

function FileSizeCheck({ file, error }: { file: File | null; error: string | null }) {
  if (!file || !error) return null;
  return <div className="text-red text-xs mt-1">{error}</div>;
}

export function KycForm() {
  const [state, formAction, pending] = useActionState(submitKycAction, { error: null });
  const [frontError, setFrontError] = useState<string | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backError, setBackError] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  function checkFile(file: File | null, setError: (e: string | null) => void) {
    if (!file) return setError(null);
    setError(
      file.size > MAX_PHOTO_BYTES
        ? `Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo) — 1,5 Mo maximum, choisis une photo plus légère.`
        : null
    );
  }

  const hasOversizedFile = !!frontError || !!backError;

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
          <input
            name="idFront"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="w-full text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setFrontFile(file);
              checkFile(file, setFrontError);
            }}
          />
          <FileSizeCheck file={frontFile} error={frontError} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Photo verso</label>
          <input
            name="idBack"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="w-full text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setBackFile(file);
              checkFile(file, setBackError);
            }}
          />
          <FileSizeCheck file={backFile} error={backError} />
        </div>
      </div>
      <div className="text-xs text-muted">JPEG, PNG ou WebP, 1,5 Mo maximum par photo.</div>
      <div>
        <label className="text-xs text-muted block mb-1">Note (optionnel)</label>
        <input name="note" className="w-full" />
      </div>
      {state.error && <div className="text-red text-xs">{state.error}</div>}
      <button type="submit" disabled={pending || hasOversizedFile} className="btn">
        {pending ? "Envoi…" : "Soumettre pour vérification →"}
      </button>
    </form>
  );
}
