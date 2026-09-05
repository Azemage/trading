"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { logTradeAction } from "./actions";
import { ALLOWED_LEVERAGES } from "@/lib/leverage-options";

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

export function TradeForm({ currentTotalAssets }: { currentTotalAssets: number }) {
  const t = useTranslations("manager");
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
          {t("fromPair")}
        </button>
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={`btn text-xs ${mode === "simple" ? "btn-gold" : ""}`}
        >
          {t("directAumPct")}
        </button>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">{t("tradingFeeLabel")}</div>
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
        <div className="text-xs text-muted mt-1">{t("tradingFeeHint")}</div>
      </div>

      {mode === "position" ? (
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <div className="text-xs text-muted mb-1">{t("pair")}</div>
            <input name="pair" placeholder="BTC/USDT" required className="w-28" />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">{t("direction")}</div>
            <select
              name="direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as "LONG" | "SHORT")}
              className="w-28"
            >
              <option value="LONG">{t("directionLong")}</option>
              <option value="SHORT">{t("directionShort")}</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">{t("entryPrice")}</div>
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
            <div className="text-xs text-muted mb-1">{t("exitPrice")}</div>
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
            <div className="text-xs text-muted mb-1">{t("positionSizeUsd")}</div>
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
            <div className="text-xs text-muted mb-1">{t("positionSizePct")}</div>
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
            <div className="text-xs text-muted mb-1">{t("leverage")}</div>
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
            <div className="text-xs text-muted mb-1">{t("note")}</div>
            <input name="note" className="w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-gold">
            {pending ? t("saving") : t("save")}
          </button>

          {preview && (
            <div className="text-xs w-full space-y-0.5">
              <div>
                {t("pairChange")}{" "}
                <span className={preview.priceChangePct >= 0 ? "text-green" : "text-red"}>
                  {preview.priceChangePct >= 0 ? "+" : ""}
                  {preview.priceChangePct.toFixed(2)}%
                </span>
                {leverage > 1 && (
                  <>
                    {" — "}
                    {t("onStake", { leverage })}{" "}
                    <span className={preview.marginReturnPct >= 0 ? "text-green" : "text-red"}>
                      {preview.marginReturnPct >= 0 ? "+" : ""}
                      {preview.marginReturnPct.toFixed(2)}%
                      {preview.marginReturnPct === -100 && ` ${t("liquidation")}`}
                    </span>
                  </>
                )}
              </div>
              <div>
                {t("aumImpact")}{" "}
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
            <div className="text-xs text-muted mb-1">{t("resultPctOfAum")}</div>
            <input name="pnlPct" type="number" step="0.01" required className="w-28" />
          </div>
          <div className="flex-1 min-w-40">
            <div className="text-xs text-muted mb-1">{t("note")}</div>
            <input name="note" className="w-full" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-gold">
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      )}

      {state.error && <div className="text-red text-xs">{state.error}</div>}
    </form>
  );
}
