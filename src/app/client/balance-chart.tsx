"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const COLORS = {
  green: "#34d399",
  red: "#f16565",
  blue: "#5b9dd9",
  gold: "#d4af37",
  muted: "#8b95a5",
  bg: "#0a0d12",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

type Point = { label: string; balance: number; kind: "DEPOSIT" | "WITHDRAWAL" | "TRADE"; gainUsd?: number };

function dotColor(p: Point) {
  if (p.kind === "DEPOSIT") return COLORS.blue;
  if (p.kind === "WITHDRAWAL") return COLORS.gold;
  return (p.gainUsd ?? 0) >= 0 ? COLORS.green : COLORS.red;
}

function CustomDot(props: { cx?: number; cy?: number; payload?: Point }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isFlow = payload.kind !== "TRADE";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isFlow ? 5 : 3}
      fill={dotColor(payload)}
      stroke={COLORS.bg}
      strokeWidth={isFlow ? 1.5 : 1}
    />
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const label = p.kind === "DEPOSIT" ? "Dépôt" : p.kind === "WITHDRAWAL" ? "Retrait" : "Trade";
  return (
    <div style={{ background: "#171c27", border: "1px solid #232a38", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ color: COLORS.muted, marginBottom: 2 }}>{label}</div>
      {p.kind === "TRADE" && p.gainUsd !== undefined && (
        <div style={{ color: p.gainUsd >= 0 ? COLORS.green : COLORS.red }}>
          {p.gainUsd >= 0 ? "+" : ""}
          {fmt(p.gainUsd)}
        </div>
      )}
      <div style={{ marginTop: 2 }}>Solde : {fmt(p.balance)}</div>
    </div>
  );
}

export function BalanceChart({ data }: { data: Point[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1a1f2a" />
          <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 10 }} />
          <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="balance" stroke={COLORS.green} strokeWidth={2} dot={<CustomDot />} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 flex-wrap text-xs text-muted mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.blue }} />
          Dépôt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLORS.gold }} />
          Retrait
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
