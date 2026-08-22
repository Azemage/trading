import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNav, valueForParts } from "@/lib/nav";
import { computeGateRemaining } from "@/lib/gate";
import { buildClientTradeLedger } from "@/lib/ledger";
import { MovementForms } from "./movement-forms";
import { BalanceChart } from "./balance-chart";

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: "en attente de confirmation",
  PENDING_EXECUTION: "en cours d'envoi",
  COMPLETED: "envoyé ✓",
  REJECTED: "rejeté",
};

export default async function ClientView() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/manager");

  const [pool, holding, movements] = await Promise.all([
    prisma.poolState.findUnique({ where: { id: 1 } }),
    prisma.clientHolding.findUnique({ where: { clientId: session.user.id } }),
    prisma.pendingMovement.findMany({
      where: { clientId: session.user.id },
      orderBy: { requestedAt: "desc" },
      take: 30,
    }),
  ]);

  const totalAssets = pool?.totalAssets.toNumber() ?? 0;
  const totalParts = pool?.totalParts.toNumber() ?? 0;
  const nav = computeNav(totalAssets, totalParts).toNumber();
  const parts = holding?.parts.toNumber() ?? 0;
  const confirmedBalance = valueForParts(parts, nav).toNumber();
  const gateRemaining = computeGateRemaining(totalAssets, pool?.gateUsedThisPeriod ?? 0).toNumber();

  const { joinDate, totalDeposited, rows: tradeRows } = await buildClientTradeLedger({
    clientId: session.user.id,
    currentParts: parts,
  });

  const chartData = [
    ...(joinDate ? [{ label: "Entrée", balance: totalDeposited }] : []),
    ...tradeRows.map((r, i) => ({ label: `Trade ${i + 1}`, balance: r.balanceAfter })),
  ];

  const pendingDeposits = movements.filter(
    (m) => m.type === "DEPOSIT" && m.status === "PENDING_CONFIRMATION"
  );
  const pendingWithdrawals = movements.filter(
    (m) => m.type === "WITHDRAWAL" && m.status === "PENDING_EXECUTION"
  );
  const pendingDepositsTotal = pendingDeposits.reduce((s, m) => s + m.amount.toNumber(), 0);
  const pendingWithdrawalsTotal = pendingWithdrawals.reduce(
    (s, m) => s + (m.grantedAmount?.toNumber() ?? 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Bonjour, {session.user.name}</h1>

      <div className="card">
        <div className="label-mono">Solde confirmé</div>
        <div className="text-3xl font-bold text-green mt-1">{fmt(confirmedBalance)}</div>
        <div className="text-xs text-muted mt-1">
          {parts.toFixed(4)} parts × NAV {nav.toFixed(4)}
        </div>
        {(pendingDepositsTotal > 0 || pendingWithdrawalsTotal > 0) && (
          <div className="text-xs text-gold mt-2 space-y-0.5">
            {pendingDepositsTotal > 0 && <div>+ {fmt(pendingDepositsTotal)} en attente de confirmation (dépôt)</div>}
            {pendingWithdrawalsTotal > 0 && <div>− {fmt(pendingWithdrawalsTotal)} en cours d&apos;envoi (retrait)</div>}
          </div>
        )}
      </div>

      {joinDate && (
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="label-mono">Mon historique de performance</div>
            <div className="text-xs text-muted">
              Total déposé : <span className="text-foreground">{fmt(totalDeposited)}</span>
            </div>
          </div>
          <BalanceChart data={chartData} />
          {tradeRows.length === 0 ? (
            <div className="text-muted text-sm mt-3">Aucun trade enregistré depuis ton entrée.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto mt-3">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left p-1.5">Date</th>
                    <th className="text-left p-1.5">Résultat</th>
                    <th className="text-right p-1.5">Solde avant</th>
                    <th className="text-right p-1.5">Solde après</th>
                    <th className="text-right p-1.5">Gain/perte</th>
                    <th className="text-right p-1.5">Cumul</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeRows.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="p-1.5 text-muted">{r.date.toLocaleString("fr-FR")}</td>
                      <td className={`p-1.5 ${r.pnlPct >= 0 ? "text-green" : "text-red"}`}>
                        {r.pair ? `${r.pair} ` : ""}
                        {r.pnlPct >= 0 ? "+" : ""}
                        {r.pnlPct.toFixed(2)}%
                      </td>
                      <td className="p-1.5 text-right text-muted">{fmt(r.balanceBefore)}</td>
                      <td className="p-1.5 text-right">{fmt(r.balanceAfter)}</td>
                      <td className={`p-1.5 text-right ${r.gainUsd >= 0 ? "text-green" : "text-red"}`}>
                        {r.gainUsd >= 0 ? "+" : ""}
                        {fmt(r.gainUsd)}
                      </td>
                      <td className={`p-1.5 text-right ${r.cumulativeGainUsd >= 0 ? "text-green" : "text-red"}`}>
                        {r.cumulativeGainUsd >= 0 ? "+" : ""}
                        {fmt(r.cumulativeGainUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-xs text-muted mt-3">
            Calculé avec ton nombre de parts actuel appliqué à chaque trade depuis ton entrée. Si tu as fait un
            retrait partiel entre-temps, les montants avant ce retrait sont approximatifs.
          </div>
        </div>
      )}

      <MovementForms gateRemaining={gateRemaining} />

      <div className="card">
        <div className="label-mono mb-3">Mes mouvements</div>
        {movements.length === 0 ? (
          <div className="text-muted text-sm">Aucun mouvement pour l&apos;instant.</div>
        ) : (
          movements.map((m) => (
            <div key={m.id} className="text-xs py-1.5 border-t border-line first:border-t-0">
              <span className="text-muted">{m.type === "DEPOSIT" ? "Dépôt" : "Retrait"}</span>{" "}
              {fmt(m.amount.toNumber())}
              {m.type === "WITHDRAWAL" && m.deferredAmount && m.deferredAmount.toNumber() > 0.01 && (
                <span className="text-gold"> ({fmt(m.deferredAmount.toNumber())} différé au prochain cycle)</span>
              )}{" "}
              — <span className={m.status === "COMPLETED" ? "text-green" : m.status === "REJECTED" ? "text-red" : "text-gold"}>
                {STATUS_LABEL[m.status]}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
