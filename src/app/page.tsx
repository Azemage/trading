import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { computeNav } from "@/lib/nav";
import { fmtUsd } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { NavChart } from "./nav-chart";
import { AumChart } from "./aum-chart";

export default async function GlobalView() {
  const [t, locale, pool, navHistory, trades, activeClients] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    prisma.poolState.findUnique({ where: { id: 1 } }),
    prisma.navSnapshot.findMany({ orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.trade.findMany({
      orderBy: { timestamp: "desc" },
      take: 30,
      select: { id: true, pnlPct: true, note: true, timestamp: true, navAfter: true },
    }),
    prisma.clientHolding.count({ where: { parts: { gt: 0 } } }),
  ]);

  const totalAssets = pool?.totalAssets.toNumber() ?? 0;
  const totalParts = pool?.totalParts.toNumber() ?? 0;
  const nav = computeNav(totalAssets, totalParts).toNumber();
  const loc = locale as Locale;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <div className="label-mono">{t("totalAum")}</div>
          <div className="text-xl font-bold text-green mt-1">{fmtUsd(totalAssets, loc)}</div>
        </div>
        <div className="card">
          <div className="label-mono">{t("navPerShare")}</div>
          <div className="text-xl font-bold mt-1">{nav.toFixed(4)}</div>
        </div>
        <div className="card">
          <div className="label-mono">{t("activeClients")}</div>
          <div className="text-xl font-bold mt-1">{activeClients}</div>
        </div>
        <div className="card">
          <div className="label-mono">{t("loggedTrades")}</div>
          <div className="text-xl font-bold mt-1">{trades.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="label-mono mb-3">{t("aumEvolution")}</div>
        <AumChart
          data={navHistory.map((n) => ({ totalAssets: n.totalAssets.toNumber(), reason: n.reason }))}
        />
        <div className="text-xs text-muted mt-3">{t("aumEvolutionHint")}</div>
      </div>

      <div className="card">
        <div className="label-mono mb-3">{t("navEvolution")}</div>
        <NavChart data={navHistory.map((n) => ({ createdAt: n.createdAt.toISOString(), nav: n.nav.toNumber() }))} />
        <div className="text-xs text-muted mt-3">{t("navEvolutionHint")}</div>
      </div>

      <div className="card">
        <div className="label-mono mb-3">{t("tradeLog")}</div>
        {trades.length === 0 ? (
          <div className="text-muted text-sm">{t("noTradeYet")}</div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">{t("note")}</th>
                  <th className="text-right p-1.5">{t("result")}</th>
                  <th className="text-right p-1.5">{t("navAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const pct = trade.pnlPct.toNumber();
                  return (
                    <tr key={trade.id} className="border-t border-line">
                      <td className="p-1.5 text-muted">{trade.note || "—"}</td>
                      <td className={`p-1.5 text-right ${pct >= 0 ? "text-green" : "text-red"}`}>
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(2)}%
                      </td>
                      <td className="p-1.5 text-right">{trade.navAfter.toNumber().toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">{t("legalDisclaimer")}</p>
    </div>
  );
}
