"use client";

import { useActionState, useMemo, useState } from "react";
import { logTradeAction } from "./actions";
import { ALLOWED_LEVERAGES } from "@/lib/leverage-options";

function computePreview(
  entryPrice: string,
  exitPrice: string,
  positionSizePct: string,
  direction: "LONG" | "SHORT",
  leverage: number,
  tradingFeeUsd: number,
  currentTotalAssets: number
) {
  const entry = parseFloat(entryPrice);
  const exit = parseFloat(exitPrice);
  const size = parseFloat(positionSizePct);
  if (!entry || Number.isNaN(exit) || Number.isNaN(size) || entry <= 0) return null;

  const rawChangePct = ((exit - entry) / entry) * 100;
  const priceChangePct = direction === "SHORT" ? -rawChangePct : rawChangePct;
  const marginReturnPct = Math.max(priceChangePct * leverage, -100);
  const pnlPctOfAum = (marginReturnPct * size) / 100;
  const feePct = currentTotalAssets > 0 ? (tradingFeeUsd / currentTotalAssets) * 100 : 0;
  const pnlPctOfAumNet = pnlPctOfAum - feePct;
  return { priceChangePct, marginReturnPct, pnlPctOfAum, pnlPctOfAumNet };
}

export function TradeForm({ currentTotalAssets }: { currentTotalAssets: number }) {
  const [state, formAction, pending] = useActionState(logTradeAction, { error: null });
  const [mode, setMode] = useState<"simple" | "position">("position");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [positionSizePct, setPositionSizePct] = useState("");
  const [positionSizeUsd, setPositionSizeUsd] = useState("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState<number>(1);
  const [tradingFeeUsd, setTradingFeeUsd] = useState("");

  function handleUsdChange(value: string) {
    setPositionSizeUsd(value);
    const usd = parseFloat(value);
    if (!Number.isNaN(usd) && currentTotalAssets > 0) {
      setPositionSizePct(((usd / currentTotalAssets) * 100).toFixed(4));
    }
  }

  function handlePctChange(value: string) {
    setPositionSizePct(value);
    const pct = parseFloat(value);
    if (!Number.isNaN(pct) && currentTotalAssets > 0) {
      setPositionSizeUsd(((pct / 100) * currentTotalAssets).toFixed(2));
    }
  }

  const preview = useMemo(
    () =>
      computePreview(
        entryPrice,
        exitPrice,
        positionSizePct,
        direction,
        leverage,
        parseFloat(tradingFeeUsd) || 0,
        currentTotalAssets
      ),
    [entryPrice, exitPrice, positionSizePct, direction, leverage, tradingFeeUsd, currentTotalAssets]
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="mode" value={mode} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("position")}
          className={`btn text-xs ${mode === "position" ? "btn-gold" : ""}`}
        >
          Depuis une paire
        </button>
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={`btn text-xs ${mode === "simple" ? "btn-gold" : ""}`}
        >
          % direct de l&apos;AUM
        </button>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">Frais de trading (plateforme, $)</div>
        <input
          name="tradingFeeUsd"
          type="number"
          step="any"
          min="0"
          placeholder="0"
          className="w-32"
          value={tradingFeeUsd}
          onChange={(e) => setTradingFeeUsd(e.target.value)}
        />
        <div className="text-xs text-muted mt-1">
          Spread, financement, frais d&apos;exécution facturés par la/les plateformes utilisées — déduits avant le
          calcul du % d&apos;impact sur l&apos;AUM et donc avant la performance fee.
        </div>
      </div>

      {mode === "position" ? (
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <div className="text-xs text-muted mb-1">Paire</div>
            <input name="pair" placeholder="BTC/USDT" required className="w-28" />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Sens</div>
            <select
              name="direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "LONG" | "SHORT")}
              className="w-28"
            >
              <option value="LONG">Achat (long)</option>
              <option value="SHORT">Vente à découvert (short)</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Prix d&apos;entrée</div>
            <input
              name="entryPrice"
              type="number"
              step="any"
              required
              className="w-28"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Prix de sortie</div>
            <input
              name="exitPrice"
              type="number"
              step="any"
              required
              className="w-28"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Montant misé ($)</div>
            <input
              type="number"
              step="any"
              min="0"
              className="w-28"
              value={positionSizeUsd}
              onChange={(e) => handleUsdChange(e.target.value)}
              placeholder={`AUM: ${currentTotalAssets.toFixed(0)}$`}
            />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">% de l&apos;AUM misé</div>
            <input
              name="positionSizePct"
              type="number"
              step="any"
              min="0"
              max="100"
              required
              className="w-24"
              value={positionSizePct}
              onChange={(e) => handlePctChange(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Levier</div>
            <select
              name="leverage"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-20"
            >
              {ALLOWED_LEVERAGES.map((lv) => (
                <option key={lv} value={lv}>
                  x{lv}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <div className="text-xs text-muted mb-1">Note (optionnel)</div>
            <input name="note" className="w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-gold">
            {pending ? "Enregistrement…" : "Enregistrer →"}
          </button>

          {preview && (
            <div className="text-xs w-full space-y-0.5">
              <div>
                Variation de la paire :{" "}
                <span className={preview.priceChangePct >= 0 ? "text-green" : "text-red"}>
                  {preview.priceChangePct >= 0 ? "+" : ""}
                  {preview.priceChangePct.toFixed(2)}%
                </span>
                {leverage > 1 && (
                  <>
                    {" — "}Sur la mise (x{leverage}) :{" "}
                    <span className={preview.marginReturnPct >= 0 ? "text-green" : "text-red"}>
                      {preview.marginReturnPct >= 0 ? "+" : ""}
                      {preview.marginReturnPct.toFixed(2)}%
                      {preview.marginReturnPct === -100 && " (liquidation)"}
                    </span>
                  </>
                )}
              </div>
              <div>
                Impact sur l&apos;AUM total :{" "}
                <span className={preview.pnlPctOfAum >= 0 ? "text-green" : "text-red"}>
                  {preview.pnlPctOfAum >= 0 ? "+" : ""}
                  {preview.pnlPctOfAum.toFixed(3)}%
                </span>
                {preview.pnlPctOfAumNet !== preview.pnlPctOfAum && (
                  <>
                    {" — "}net des frais de trading :{" "}
                    <span className={preview.pnlPctOfAumNet >= 0 ? "text-green" : "text-red"}>
                      {preview.pnlPctOfAumNet >= 0 ? "+" : ""}
                      {preview.pnlPctOfAumNet.toFixed(3)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <div className="text-xs text-muted mb-1">Résultat en % de l&apos;AUM</div>
            <input name="pnlPct" type="number" step="0.01" required className="w-28" />
          </div>
          <div className="flex-1 min-w-40">
            <div className="text-xs text-muted mb-1">Note (optionnel)</div>
            <input name="note" className="w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-gold">
            {pending ? "Enregistrement…" : "Enregistrer →"}
          </button>
        </div>
      )}

      {state.error && <div className="text-red text-xs">{state.error}</div>}
    </form>
  );
}
