"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useChartWindow } from "./use-chart-window";
import { ChartNav } from "./chart-nav";

export function NavChart({ data }: { data: { createdAt: string; nav: number }[] }) {
  const points = data.map((d, i) => ({
    label: `T${i}`,
    nav: Math.round(d.nav * 10000) / 10000,
  }));
  const chart = useChartWindow(points, 10);

  return (
    <div>
      <ChartNav
        canGoBack={chart.canGoBack}
        canGoForward={chart.canGoForward}
        onBack={chart.goBack}
        onForward={chart.goForward}
        rangeStart={chart.rangeStart}
        rangeEnd={chart.rangeEnd}
        total={chart.total}
      />
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chart.visible}>
          <CartesianGrid stroke="#1a1f2a" />
          <XAxis dataKey="label" tick={{ fill: "#8b95a5", fontSize: 10 }} />
          <YAxis tick={{ fill: "#8b95a5", fontSize: 10 }} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#171c27", border: "1px solid #232a38", fontSize: 12 }} />
          <Line type="monotone" dataKey="nav" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
