"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitKycAction } from "./actions";

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

export function KycForm() {
  const t = useTranslations("client");
  const [state, formAction, pending] = useActionState(submitKycAction, { error: null });
  const [frontError, setFrontError] = useState<string | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backError, setBackError] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  function checkFile(file: File | null, setError: (e: string | null) => void) {
    if (!file) return setError(null);
    setError(
      file.size > MAX_PHOTO_BYTES
        ? t("photoTooLarge", { size: (file.size / (1024 * 1024)).toFixed(1) })
        : null
    );
  }

  const hasOversizedFile = !!frontError || !!backError;

  return (
    <form action={formAction} className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted block mb-1">{t("legalName")}</label>
          <input name="legalName" required className="w-full" />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">{t("documentType")}</label>
          <select name="documentType" required className="w-full">
            <option value="Passeport">{t("documentPassport")}</option>
            <option value="Carte d'identité">{t("documentIdCard")}</option>
            <option value="Permis de conduire">{t("documentDrivingLicense")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">{t("documentNumber")}</label>
        <input name="documentNumber" required className="w-full" />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted block mb-1">{t("photoFront")}</label>
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
          {frontFile && frontError && <div className="text-red text-xs mt-1">{frontError}</div>}
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">{t("photoBack")}</label>
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
          {backFile && backError && <div className="text-red text-xs mt-1">{backError}</div>}
        </div>
      </div>
      <div className="text-xs text-muted">{t("photoHint")}</div>
      <div>
        <label className="text-xs text-muted block mb-1">{t("note")}</label>
        <input name="note" className="w-full" />
      </div>
      {state.error && <div className="text-red text-xs">{state.error}</div>}
      <button type="submit" disabled={pending || hasOversizedFile} className="btn">
        {pending ? t("sending") : t("submitForVerification")}
      </button>
    </form>
  );
}
