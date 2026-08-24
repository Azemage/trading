import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNav, valueForParts } from "@/lib/nav";
import { buildClientLedger } from "@/lib/ledger";
import { MovementForms } from "./movement-forms";
import { BalanceChart } from "./balance-chart";
import { KycForm } from "./kyc-form";
import { UsdcAddressForm } from "./usdc-address-form";
import type { UsdcNetworkValue } from "@/lib/usdc";

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

  const [pool, holding, movements, me, latestKyc] = await Promise.all([
    prisma.poolState.findUnique({ where: { id: 1 } }),
    prisma.clientHolding.findUnique({ where: { clientId: session.user.id } }),
    prisma.pendingMovement.findMany({
      where: { clientId: session.user.id },
      orderBy: { requestedAt: "desc" },
      take: 30,
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { kycStatus: true, usdcNetwork: true, usdcAddress: true },
    }),
    prisma.kycSubmission.findFirst({
      where: { clientId: session.user.id },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const totalAssets = pool?.totalAssets.toNumber() ?? 0;
  const totalParts = pool?.totalParts.toNumber() ?? 0;
  const nav = computeNav(totalAssets, totalParts).toNumber();
  const parts = holding?.parts.toNumber() ?? 0;
  const confirmedBalance = valueForParts(parts, nav).toNumber();

  const { joinDate, totalDeposited, entries } = await buildClientLedger(session.user.id);

  const chartData = entries.map((e, i) => ({
    label: e.kind === "DEPOSIT" ? `Dépôt ${i + 1}` : e.kind === "WITHDRAWAL" ? `Retrait ${i + 1}` : `Trade ${i + 1}`,
    balance: e.balanceAfter,
    kind: e.kind,
    gainUsd: e.kind === "TRADE" ? e.gainUsd : undefined,
  }));

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
            <div className="label-mono">Historique de mon solde</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted">
                Total déposé : <span className="text-foreground">{fmt(totalDeposited)}</span>
              </span>
              <a href="/client/export/ledger" className="text-green">
                Exporter en CSV ↓
              </a>
            </div>
          </div>
          <BalanceChart data={chartData} />
          <div className="max-h-80 overflow-y-auto mt-3">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">Date</th>
                  <th className="text-left p-1.5">Événement</th>
                  <th className="text-right p-1.5">Impact</th>
                  <th className="text-right p-1.5">Frais</th>
                  <th className="text-right p-1.5">Solde après</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  if (e.kind === "DEPOSIT") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{e.date.toLocaleString("fr-FR")}</td>
                        <td className="p-1.5 text-blue">Dépôt</td>
                        <td className="p-1.5 text-right text-green">+{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right">{fmt(e.balanceAfter)}</td>
                      </tr>
                    );
                  }
                  if (e.kind === "WITHDRAWAL") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{e.date.toLocaleString("fr-FR")}</td>
                        <td className="p-1.5 text-gold">Retrait</td>
                        <td className="p-1.5 text-right text-red">-{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right">{fmt(e.balanceAfter)}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="p-1.5 text-muted">{e.date.toLocaleString("fr-FR")}</td>
                      <td className={`p-1.5 ${e.pnlPct >= 0 ? "text-green" : "text-red"}`}>
                        Trade{e.pair ? ` ${e.pair}` : ""} ({e.pnlPct >= 0 ? "+" : ""}
                        {e.pnlPct.toFixed(2)}%)
                      </td>
                      <td className={`p-1.5 text-right ${e.gainUsd >= 0 ? "text-green" : "text-red"}`}>
                        {e.gainUsd >= 0 ? "+" : ""}
                        {fmt(e.gainUsd)}
                      </td>
                      <td className="p-1.5 text-right text-gold">{e.feeUsd > 0.005 ? `-${fmt(e.feeUsd)}` : "—"}</td>
                      <td className="p-1.5 text-right">{fmt(e.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted mt-3">
            &quot;Impact&quot; est déjà net des frais (frais de trading des plateformes utilisées, puis performance
            fee de 30% sur les gains prélevée uniquement au-dessus du plus haut NAV jamais atteint). La colonne
            &quot;Frais&quot; indique le montant total qui t&apos;aurait été attribué en plus si aucun frais
            n&apos;avait été prélevé sur ce trade.
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="label-mono">Mon compte</div>

        <div>
          <div className="text-xs text-gold mb-2">Vérification KYC</div>
          {me.kycStatus === "VERIFIED" ? (
            <div className="text-green text-sm">Vérifiée ✓</div>
          ) : latestKyc?.status === "PENDING" ? (
            <div className="text-gold text-sm">En attente de revue par le gestionnaire.</div>
          ) : (
            <>
              {latestKyc?.status === "REJECTED" && (
                <div className="text-red text-xs mb-2">
                  Rejetée{latestKyc.rejectionReason ? ` : ${latestKyc.rejectionReason}` : ""}. Tu peux resoumettre.
                </div>
              )}
              <KycForm />
            </>
          )}
          <div className="text-xs text-muted mt-2">Requise avant de pouvoir demander un retrait.</div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="text-xs text-gold mb-2">Adresse USDC pour recevoir tes retraits</div>
          <UsdcAddressForm
            currentNetwork={me.usdcNetwork as UsdcNetworkValue | null}
            currentAddress={me.usdcAddress}
          />
        </div>
      </div>

      <MovementForms kycVerified={me.kycStatus === "VERIFIED"} maxWithdrawable={confirmedBalance} />

      <div className="card">
        <div className="label-mono mb-3">Mes mouvements</div>
        {movements.length === 0 ? (
          <div className="text-muted text-sm">Aucun mouvement pour l&apos;instant.</div>
        ) : (
          movements.map((m) => (
            <div key={m.id} className="text-xs py-1.5 border-t border-line first:border-t-0">
              <span className="text-muted">{m.type === "DEPOSIT" ? "Dépôt" : "Retrait"}</span>{" "}
              {fmt(m.amount.toNumber())}{" "}
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
