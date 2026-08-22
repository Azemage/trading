"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

export function BalanceChart({ data }: { data: { label: string; balance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid stroke="#1a1f2a" />
        <XAxis dataKey="label" tick={{ fill: "#8b95a5", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8b95a5", fontSize: 10 }} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: "#171c27", border: "1px solid #232a38", fontSize: 12 }}
          formatter={(value) => fmt(Number(value))}
        />
        <Line type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
