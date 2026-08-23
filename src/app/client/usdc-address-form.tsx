"use client";

import { useActionState, useState } from "react";
import { updateUsdcAddressAction } from "./actions";
import { USDC_NETWORK_LABELS, type UsdcNetworkValue } from "@/lib/usdc";

export function UsdcAddressForm({
  currentNetwork,
  currentAddress,
}: {
  currentNetwork: UsdcNetworkValue | null;
  currentAddress: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateUsdcAddressAction, { error: null });
  const [network, setNetwork] = useState<UsdcNetworkValue>(currentNetwork ?? "ETHEREUM");

  return (
    <div>
      {currentAddress && (
        <div className="text-xs text-muted mb-2">
          Actuelle : {USDC_NETWORK_LABELS[currentNetwork ?? "ETHEREUM"]} — <code>{currentAddress}</code>
        </div>
      )}
      <form action={formAction} className="flex gap-2 flex-wrap items-end">
        <select
          name="network"
          value={network}
          onChange={(e) => setNetwork(e.target.value as UsdcNetworkValue)}
          className="w-40"
        >
          {Object.entries(USDC_NETWORK_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input name="address" placeholder="Adresse" required className="flex-1 min-w-48" />
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Enregistrement…" : currentAddress ? "Mettre à jour" : "Enregistrer"}
        </button>
      </form>
      {state.error && <div className="text-red text-xs mt-1">{state.error}</div>}
    </div>
  );
}
