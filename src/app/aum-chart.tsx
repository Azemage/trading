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

const REASON_LABELS: Record<string, string> = {
  INIT: "Initialisation",
  DEPOSIT: "Dépôt client",
  WITHDRAWAL: "Retrait client",
  TRADE: "Trade",
  MANUAL_ADJUSTMENT: "Ajustement manuel (test)",
  TEST_CLIENT_SEED: "Client de test créé",
};

const COLORS = {
  green: "#34d399",
  red: "#f16565",
  gold: "#d4af37",
  blue: "#5b9dd9",
  muted: "#8b95a5",
  bg: "#0a0d12",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

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
}: {
  active?: boolean;
  payload?: { payload: { reason: string; delta: number; totalAssets: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const label = REASON_LABELS[p.reason] ?? p.reason;
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
      <div style={{ marginTop: 2 }}>AUM : {fmt(p.totalAssets)}</div>
    </div>
  );
}

export function AumChart({ data }: { data: { totalAssets: number; reason: string }[] }) {
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
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="totalAssets" stroke={COLORS.green} strokeWidth={2} dot={<CustomDot />} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 flex-wrap text-xs text-muted mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.blue }} />
          Dépôt / client de test
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.gold }} />
          Retrait / ajustement manuel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.green }} />
          Trade gagnant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS.red }} />
          Trade perdant
        </span>
      </div>
    </div>
  );
}
