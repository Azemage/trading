import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNav, valueForParts } from "@/lib/nav";
import { computeGateRemaining } from "@/lib/gate";
import { MovementForms } from "./movement-forms";

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
