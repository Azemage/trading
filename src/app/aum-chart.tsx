"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useTranslations, useLocale } from "next-intl";
import { fmtUsd } from "@/lib/format";
import type { Locale } from "@/i18n/config";

const COLORS = {
  green: "#34d399",
  red: "#f16565",
  gold: "#d4af37",
  blue: "#5b9dd9",
  muted: "#8b95a5",
  bg: "#0a0d12",
};

function dotColor(reason: string, delta: number) {
  if (reason === "DEPOSIT" || reason === "TEST_CLIENT_SEED") return COLORS.blue;
  if (reason === "WITHDRAWAL") return COLORS.gold;
  if (reason === "MANUAL_ADJUSTMENT") return COLORS.gold;
  return delta >= 0 ? COLORS.green : COLORS.red;
}

function CustomDot(props: { cx?: number; cy?: number; payload?: { reason: string; delta: number } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isFlow = payload.reason === "DEPOSIT" || payload.reason === "WITHDRAWAL" || payload.reason === "TEST_CLIENT_SEED";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isFlow ? 5 : 3}
      fill={dotColor(payload.reason, payload.delta)}
      stroke={COLORS.bg}
      strokeWidth={isFlow ? 1.5 : 1}
    />
  );
}

function CustomTooltip({
  active,
  payload,
  reasonLabels,
  fmt,
  aumLabel,
}: {
  active?: boolean;
  payload?: { payload: { reason: string; delta: number; totalAssets: number } }[];
  reasonLabels: Record<string, string>;
  fmt: (n: number) => string;
  aumLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const label = reasonLabels[p.reason] ?? p.reason;
  const isFirst = p.reason === "INIT";
  return (
    <div
      style={{
        background: "#171c27",
        border: "1px solid #232a38",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      <div style={{ color: COLORS.muted, marginBottom: 2 }}>{label}</div>
      {!isFirst && (
        <div style={{ color: p.delta >= 0 ? COLORS.green : COLORS.red }}>
          {p.delta >= 0 ? "+" : ""}
          {fmt(p.delta)}
        </div>
      )}
      <div style={{ marginTop: 2 }}>
        {aumLabel} {fmt(p.totalAssets)}
      </div>
    </div>
  );
}

export function AumChart({ data }: { data: { totalAssets: number; reason: string }[] }) {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;
  const fmt = (n: number) => fmtUsd(n, locale);
  const reasonLabels: Record<string, string> = {
    INIT: t("reasonInit"),
    DEPOSIT: t("reasonDeposit"),
    WITHDRAWAL: t("reasonWithdrawal"),
    TRADE: t("reasonTrade"),
    MANUAL_ADJUSTMENT: t("reasonManualAdjustment"),
    TEST_CLIENT_SEED: t("reasonTestClientSeed"),
  };

  const points = data.map((d, i) => ({
    label: `T${i}`,
    totalAssets: Math.round(d.totalAssets * 100) / 100,
    reason: d.reason,
    delta: i > 0 ? Math.round((d.totalAssets - data[i - 1].totalAssets) * 100) / 100 : 0,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points}>
          <CartesianGrid stroke="#1a1f2a" />
          <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 10 }} />
          <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip content={<CustomTooltip reasonLabels={reasonLabels} fmt={fmt} aumLabel={t("totalAum") + " :"} />} />
          <Line type="monotone" dataKey="totalAssets" stroke={COLORS.green} strokeWidth={2} dot={<CustomDot />} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 flex-wrap text-xs text-muted mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.blue }} />
          {t("legendDepositOrTestClient")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.gold }} />
          {t("legendWithdrawalOrAdjustment")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.green }} />
          {t("legendWinningTrade")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.red }} />
          {t("legendLosingTrade")}
        </span>
      </div>
    </div>
  );
}
