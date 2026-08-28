"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updateUsdcAddressAction } from "./actions";
import { USDC_NETWORK_LABELS, type UsdcNetworkValue } from "@/lib/usdc";

export function UsdcAddressForm({
  currentNetwork,
  currentAddress,
}: {
  currentNetwork: UsdcNetworkValue | null;
  currentAddress: string | null;
}) {
  const t = useTranslations("client");
  const [state, formAction, pending] = useActionState(updateUsdcAddressAction, { error: null });
  const [network, setNetwork] = useState<UsdcNetworkValue>(currentNetwork ?? "ETHEREUM");
  const networkLabel = (value: UsdcNetworkValue) => (value === "OTHER" ? t("otherNetwork") : USDC_NETWORK_LABELS[value]);

  return (
    <div>
      {currentAddress && (
        <div className="text-xs text-muted mb-2">
          {t("current")} {networkLabel(currentNetwork ?? "ETHEREUM")} — <code>{currentAddress}</code>
        </div>
      )}
      <form action={formAction} className="flex gap-2 flex-wrap items-end">
        <select
          name="network"
          value={network}
          onChange={(e) => setNetwork(e.target.value as UsdcNetworkValue)}
          className="w-40"
        >
          {Object.keys(USDC_NETWORK_LABELS).map((value) => (
            <option key={value} value={value}>
              {networkLabel(value as UsdcNetworkValue)}
            </option>
          ))}
        </select>
        <input name="address" placeholder={t("address")} required className="flex-1 min-w-48" />
        <button type="submit" disabled={pending} className="btn">
          {pending ? t("saving") : currentAddress ? t("update") : t("save")}
        </button>
      </form>
      {state.error && <div className="text-red text-xs mt-1">{state.error}</div>}
    </div>
  );
}
