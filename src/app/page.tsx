import { prisma } from "@/lib/prisma";
import { computeNav } from "@/lib/nav";
import { NavChart } from "./nav-chart";

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

export default async function GlobalView() {
  const [pool, navHistory, trades, activeClients] = await Promise.all([
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Vue globale (public)</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <div className="label-mono">AUM total</div>
          <div className="text-xl font-bold text-green mt-1">{fmt(totalAssets)}</div>
        </div>
        <div className="card">
          <div className="label-mono">NAV / part</div>
          <div className="text-xl font-bold mt-1">{nav.toFixed(4)}</div>
        </div>
        <div className="card">
          <div className="label-mono">Clients actifs</div>
          <div className="text-xl font-bold mt-1">{activeClients}</div>
        </div>
        <div className="card">
          <div className="label-mono">Trades enregistrés</div>
          <div className="text-xl font-bold mt-1">{trades.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="label-mono mb-3">Évolution du NAV</div>
        <NavChart data={navHistory.map((n) => ({ createdAt: n.createdAt.toISOString(), nav: n.nav.toNumber() }))} />
      </div>

      <div className="card">
        <div className="label-mono mb-3">Registre des trades</div>
        {trades.length === 0 ? (
          <div className="text-muted text-sm">Aucun trade enregistré pour l&apos;instant.</div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">Note</th>
                  <th className="text-right p-1.5">Résultat</th>
                  <th className="text-right p-1.5">NAV après</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const pct = t.pnlPct.toNumber();
                  return (
                    <tr key={t.id} className="border-t border-line">
                      <td className="p-1.5 text-muted">{t.note || "—"}</td>
                      <td className={`p-1.5 text-right ${pct >= 0 ? "text-green" : "text-red"}`}>
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(2)}%
                      </td>
                      <td className="p-1.5 text-right">{t.navAfter.toNumber().toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        Ce système gère des fonds de tiers. Le statut légal de cette activité doit être clarifié
        avant toute mise en production avec de vrais clients externes.
      </p>
    </div>
  );
}
