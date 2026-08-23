import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNav } from "@/lib/nav";
import { computeGateBudget } from "@/lib/gate";
import {
  approveDepositAction,
  rejectDepositAction,
  rejectWithdrawalAction,
  resetGateAction,
  sendWithdrawalAction,
} from "./actions";
import { TradeForm } from "./trade-form";
import { PoolAdjustForm } from "./pool-adjust-form";
import { CreateTestClientForm } from "./create-test-client-form";
import { ResetTestDataForm } from "./reset-test-data-form";
import { buildManagerLedger } from "@/lib/ledger";

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

export default async function ManagerView() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MANAGER") redirect("/client");

  const [pool, pendingDeposits, pendingWithdrawals, feeAgg, holdings, ledger] = await Promise.all([
    prisma.poolState.findUnique({ where: { id: 1 } }),
    prisma.pendingMovement.findMany({
      where: { type: "DEPOSIT", status: "PENDING_CONFIRMATION" },
      include: { client: { select: { name: true, email: true } } },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.pendingMovement.findMany({
      where: { type: "WITHDRAWAL", status: "PENDING_EXECUTION" },
      include: { client: { select: { name: true, email: true } } },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.feeLedger.aggregate({ where: { type: "PERFORMANCE" }, _sum: { amount: true } }),
    prisma.clientHolding.findMany({
      where: { parts: { gt: 0 } },
      include: { client: { select: { name: true, email: true } } },
    }),
    buildManagerLedger(100),
  ]);

  const totalAssets = pool?.totalAssets.toNumber() ?? 0;
  const totalParts = pool?.totalParts.toNumber() ?? 0;
  const nav = computeNav(totalAssets, totalParts).toNumber();
  const gateBudget = computeGateBudget(totalAssets).toNumber();
  const gateUsed = pool?.gateUsedThisPeriod.toNumber() ?? 0;
  // Horodatage serveur pris une fois par requête, comparé aux échéances déjà figées en base.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Espace gestionnaire</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card">
          <div className="label-mono">Revenu perf. fee (cumul)</div>
          <div className="text-xl font-bold text-gold mt-1">{fmt(feeAgg._sum.amount?.toNumber() ?? 0)}</div>
        </div>
        <div className="card">
          <div className="label-mono">Gate utilisé ce mois</div>
          <div className="text-xl font-bold mt-1">{fmt(gateUsed)} / {fmt(gateBudget)}</div>
        </div>
        <div className="card">
          <div className="label-mono">Dépôts en attente</div>
          <div className="text-xl font-bold mt-1">{pendingDeposits.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="label-mono text-gold mb-3">Enregistrer un trade / résultat du jour (saisie manuelle)</div>
        <TradeForm />
        <div className="text-xs text-muted mt-2">
          Performance fee de 30% prélevée sur les gains au-dessus du high-water mark, aucun frais sinon.
        </div>
      </div>

      <div className="card border-red space-y-4">
        <div className="label-mono text-red">🧪 Outils de test</div>

        <div>
          <div className="text-xs text-gold mb-2">Créer un client de test</div>
          <CreateTestClientForm />
          <div className="text-xs text-muted mt-2">
            Crée un compte client et le crédite immédiatement d&apos;un dépôt initial (sans passer par le workflow
            d&apos;attente), pour observer le solde/les parts selon différents montants. N&apos;affecte pas le NAV
            (actifs et parts ajoutés proportionnellement, comme un vrai dépôt).
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="text-xs text-gold mb-2">Ajustement manuel de l&apos;AUM</div>
          <PoolAdjustForm currentTotalAssets={totalAssets} />
          <div className="text-xs text-muted mt-2">
            Impose directement un AUM (donc un NAV) pour tester des scénarios. Aucun frais prélevé ; réinitialise
            aussi le high-water mark à ce niveau (sinon le prochain trade facturerait rétroactivement l&apos;écart
            créé par cet ajustement). À ne pas utiliser en production réelle — chaque usage est tracé dans le
            journal d&apos;audit avec le motif saisi.
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="text-xs text-gold mb-2">Tout réinitialiser</div>
          <ResetTestDataForm />
          <div className="text-xs text-muted mt-2">
            Efface définitivement tous les clients, dépôts, retraits, trades et frais, et remet le pool à zéro (AUM
            0$, NAV 1). Ton compte gestionnaire est conservé. Irréversible — à utiliser uniquement en développement.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="label-mono mb-3">Dépôts à valider</div>
        {pendingDeposits.length === 0 ? (
          <div className="text-muted text-sm">Aucun dépôt en attente.</div>
        ) : (
          pendingDeposits.map((d) => {
            const eligible = now >= d.eligibleAt.getTime();
            return (
              <div key={d.id} className="flex items-center justify-between flex-wrap gap-2 py-2 border-t border-line first:border-t-0 text-sm">
                <span>
                  {d.client.name} — {fmt(d.amount.toNumber())}
                  {!eligible && (
                    <span className="text-xs text-muted"> (éligible le {d.eligibleAt.toLocaleString("fr-FR")})</span>
                  )}
                </span>
                <div className="flex gap-2">
                  <form action={approveDepositAction.bind(null, d.id)}>
                    <button className="btn" disabled={!eligible}>Approuver ✓</button>
                  </form>
                  <form action={rejectDepositAction.bind(null, d.id)} className="flex gap-1">
                    <input type="hidden" name="reason" value="Rejeté par le gestionnaire" />
                    <button className="btn btn-red">Rejeter</button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="label-mono">Sorties à traiter</div>
          <form action={resetGateAction}>
            <button className="btn btn-gold">↻ nouvelle période (reset gate)</button>
          </form>
        </div>
        {pendingWithdrawals.length === 0 ? (
          <div className="text-muted text-sm">Aucune sortie en attente.</div>
        ) : (
          pendingWithdrawals.map((w) => {
            const eligible = now >= w.eligibleAt.getTime();
            const deferred = w.deferredAmount?.toNumber() ?? 0;
            return (
              <div key={w.id} className="flex items-center justify-between flex-wrap gap-2 py-2 border-t border-line first:border-t-0 text-sm">
                <span>
                  {w.client.name} — accordé {fmt(w.grantedAmount?.toNumber() ?? 0)}
                  {deferred > 0.01 && <span className="text-gold"> ({fmt(deferred)} différé)</span>}
                  {!eligible && (
                    <span className="text-xs text-muted"> (éligible le {w.eligibleAt.toLocaleString("fr-FR")})</span>
                  )}
                </span>
                <div className="flex gap-2 items-center">
                  <form action={sendWithdrawalAction.bind(null, w.id)} className="flex gap-1 items-center">
                    <input name="txHash" placeholder="tx_hash" required className="text-xs w-32" />
                    <button className="btn" disabled={!eligible}>Marquer envoyé ✓</button>
                  </form>
                  <form action={rejectWithdrawalAction.bind(null, w.id)}>
                    <input type="hidden" name="reason" value="Rejeté par le gestionnaire" />
                    <button className="btn btn-red">Rejeter</button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="label-mono mb-3">Soldes clients</div>
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="text-muted">
              <th className="text-left p-1.5">Client</th>
              <th className="text-right p-1.5">Parts</th>
              <th className="text-right p-1.5">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id} className="border-t border-line">
                <td className="p-1.5">{h.client.name}</td>
                <td className="p-1.5 text-right">{h.parts.toNumber().toFixed(4)}</td>
                <td className="p-1.5 text-right text-green">{fmt(h.parts.toNumber() * nav)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="label-mono mb-3">Fiche de calcul — entrées, trades &amp; revenus de perf</div>
        {ledger.length === 0 ? (
          <div className="text-muted text-sm">Aucun mouvement enregistré pour l&apos;instant.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">Date</th>
                  <th className="text-left p-1.5">Type</th>
                  <th className="text-left p-1.5">Détail</th>
                  <th className="text-right p-1.5">Montant</th>
                  <th className="text-right p-1.5">Frais perf.</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => {
                  if (e.kind === "DEPOSIT") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{e.date.toLocaleString("fr-FR")}</td>
                        <td className="p-1.5 text-blue">Dépôt</td>
                        <td className="p-1.5">{e.clientName}</td>
                        <td className="p-1.5 text-right text-green">+{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                      </tr>
                    );
                  }
                  if (e.kind === "WITHDRAWAL") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{e.date.toLocaleString("fr-FR")}</td>
                        <td className="p-1.5 text-gold">Retrait</td>
                        <td className="p-1.5">{e.clientName}</td>
                        <td className="p-1.5 text-right text-red">-{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="p-1.5 text-muted">{e.date.toLocaleString("fr-FR")}</td>
                      <td className="p-1.5">Trade</td>
                      <td className="p-1.5 text-muted">
                        {e.pair ?? e.note ?? "—"}{" "}
                        <span className={e.pnlPct >= 0 ? "text-green" : "text-red"}>
                          ({e.pnlPct >= 0 ? "+" : ""}
                          {e.pnlPct.toFixed(2)}%)
                        </span>
                      </td>
                      <td className={`p-1.5 text-right ${e.gainUsd >= 0 ? "text-green" : "text-red"}`}>
                        {e.gainUsd >= 0 ? "+" : ""}
                        {fmt(e.gainUsd)}
                      </td>
                      <td className="p-1.5 text-right text-gold">{e.fee > 0 ? fmt(e.fee) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
