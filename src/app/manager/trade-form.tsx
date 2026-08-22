"use client";

import { useActionState, useMemo, useState } from "react";
import { logTradeAction } from "./actions";
import { ALLOWED_LEVERAGES } from "@/lib/position";

function computePreview(
  entryPrice: string,
  exitPrice: string,
  positionSizePct: string,
  direction: "LONG" | "SHORT",
  leverage: number
) {
  const entry = parseFloat(entryPrice);
  const exit = parseFloat(exitPrice);
  const size = parseFloat(positionSizePct);
  if (!entry || Number.isNaN(exit) || Number.isNaN(size) || entry <= 0) return null;

  const rawChangePct = ((exit - entry) / entry) * 100;
  const priceChangePct = direction === "SHORT" ? -rawChangePct : rawChangePct;
  const marginReturnPct = Math.max(priceChangePct * leverage, -100);
  const pnlPctOfAum = (marginReturnPct * size) / 100;
  return { priceChangePct, marginReturnPct, pnlPctOfAum };
}

export function TradeForm() {
  const [state, formAction, pending] = useActionState(logTradeAction, { error: null });
  const [mode, setMode] = useState<"simple" | "position">("position");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [positionSizePct, setPositionSizePct] = useState("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState<number>(1);

  const preview = useMemo(
    () => computePreview(entryPrice, exitPrice, positionSizePct, direction, leverage),
    [entryPrice, exitPrice, positionSizePct, direction, leverage]
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
              onChange={(e) => setPositionSizePct(e.target.value)}
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
