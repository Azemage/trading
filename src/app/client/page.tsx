import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNav, valueForParts } from "@/lib/nav";
import { buildClientLedger } from "@/lib/ledger";
import { fmtUsd, fmtDateTime } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { MovementForms } from "./movement-forms";
import { BalanceChart } from "./balance-chart";
import { KycForm } from "./kyc-form";
import { UsdcAddressForm } from "./usdc-address-form";
import type { UsdcNetworkValue } from "@/lib/usdc";

export default async function ClientView() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/manager");

  const [t, locale, pool, holding, movements, me, latestKyc] = await Promise.all([
    getTranslations("client"),
    getLocale(),
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

  const loc = locale as Locale;
  const fmt = (n: number) => fmtUsd(n, loc);
  const STATUS_LABEL: Record<string, string> = {
    PENDING_CONFIRMATION: t("statusPendingConfirmation"),
    PENDING_EXECUTION: t("statusPendingExecution"),
    COMPLETED: t("statusCompleted"),
    REJECTED: t("statusRejected"),
  };

  const totalAssets = pool?.totalAssets.toNumber() ?? 0;
  const totalParts = pool?.totalParts.toNumber() ?? 0;
  const nav = computeNav(totalAssets, totalParts).toNumber();
  const parts = holding?.parts.toNumber() ?? 0;
  const confirmedBalance = valueForParts(parts, nav).toNumber();

  const { joinDate, totalDeposited, entries } = await buildClientLedger(session.user.id);

  const chartData = entries.map((e, i) => ({
    label:
      e.kind === "DEPOSIT"
        ? `${t("deposit")} ${i + 1}`
        : e.kind === "WITHDRAWAL"
          ? `${t("withdrawal")} ${i + 1}`
          : `${t("trade")} ${i + 1}`,
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
      <h1 className="text-2xl font-bold">{t("greeting", { name: session.user.name ?? "" })}</h1>

      <div className="card">
        <div className="label-mono">{t("confirmedBalance")}</div>
        <div className="text-3xl font-bold text-green mt-1">{fmt(confirmedBalance)}</div>
        <div className="text-xs text-muted mt-1">
          {t("partsTimesNav", { parts: parts.toFixed(4), nav: nav.toFixed(4) })}
        </div>
        {(pendingDepositsTotal > 0 || pendingWithdrawalsTotal > 0) && (
          <div className="text-xs text-gold mt-2 space-y-0.5">
            {pendingDepositsTotal > 0 && <div>{t("pendingDeposit", { amount: fmt(pendingDepositsTotal) })}</div>}
            {pendingWithdrawalsTotal > 0 && (
              <div>{t("pendingWithdrawal", { amount: fmt(pendingWithdrawalsTotal) })}</div>
            )}
          </div>
        )}
      </div>

      {joinDate && (
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="label-mono">{t("balanceHistory")}</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted">
                {t("totalDeposited")} <span className="text-foreground">{fmt(totalDeposited)}</span>
              </span>
              <a href="/client/export/ledger" className="text-green">
                {t("exportCsv")}
              </a>
            </div>
          </div>
          <BalanceChart data={chartData} />
          <div className="max-h-80 overflow-y-auto mt-3">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">{t("date")}</th>
                  <th className="text-left p-1.5">{t("event")}</th>
                  <th className="text-right p-1.5">{t("impact")}</th>
                  <th className="text-right p-1.5">{t("tradingFee")}</th>
                  <th className="text-right p-1.5">{t("perfFee")}</th>
                  <th className="text-right p-1.5">{t("balanceAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  if (e.kind === "DEPOSIT") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{fmtDateTime(e.date, loc)}</td>
                        <td className="p-1.5 text-blue">{t("deposit")}</td>
                        <td className="p-1.5 text-right text-green">+{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right">{fmt(e.balanceAfter)}</td>
                      </tr>
                    );
                  }
                  if (e.kind === "WITHDRAWAL") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{fmtDateTime(e.date, loc)}</td>
                        <td className="p-1.5 text-gold">{t("withdrawal")}</td>
                        <td className="p-1.5 text-right text-red">-{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right">{fmt(e.balanceAfter)}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="p-1.5 text-muted">{fmtDateTime(e.date, loc)}</td>
                      <td className={`p-1.5 ${e.pnlPct >= 0 ? "text-green" : "text-red"}`}>
                        {t("trade")}
                        {e.pair ? ` ${e.pair}` : ""} ({e.pnlPct >= 0 ? "+" : ""}
                        {e.pnlPct.toFixed(2)}%)
                      </td>
                      <td className={`p-1.5 text-right ${e.gainUsd >= 0 ? "text-green" : "text-red"}`}>
                        {e.gainUsd >= 0 ? "+" : ""}
                        {fmt(e.gainUsd)}
                      </td>
                      <td className="p-1.5 text-right text-muted">
                        {e.tradingFeeUsd > 0.005 ? fmt(e.tradingFeeUsd) : "—"}
                      </td>
                      <td className="p-1.5 text-right text-gold">
                        {e.perfFeeUsd > 0.005 ? `-${fmt(e.perfFeeUsd)}` : "—"}
                      </td>
                      <td className="p-1.5 text-right">{fmt(e.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted mt-3">{t("ledgerFootnote")}</div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="label-mono">{t("myAccount")}</div>

        <div>
          <div className="text-xs text-gold mb-2">{t("kycVerification")}</div>
          {me.kycStatus === "VERIFIED" ? (
            <div className="text-green text-sm">{t("kycVerified")}</div>
          ) : latestKyc?.status === "PENDING" ? (
            <div className="text-gold text-sm">{t("kycPending")}</div>
          ) : (
            <>
              {latestKyc?.status === "REJECTED" && (
                <div className="text-red text-xs mb-2">
                  {t("kycRejected", { reason: latestKyc.rejectionReason ? ` : ${latestKyc.rejectionReason}` : "" })}
                </div>
              )}
              <KycForm />
            </>
          )}
          <div className="text-xs text-muted mt-2">{t("kycRequiredHint")}</div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="text-xs text-gold mb-2">{t("usdcAddressLabel")}</div>
          <UsdcAddressForm
            currentNetwork={me.usdcNetwork as UsdcNetworkValue | null}
            currentAddress={me.usdcAddress}
          />
        </div>
      </div>

      <MovementForms kycVerified={me.kycStatus === "VERIFIED"} maxWithdrawable={confirmedBalance} />

      <div className="card">
        <div className="label-mono mb-3">{t("myMovements")}</div>
        {movements.length === 0 ? (
          <div className="text-muted text-sm">{t("noMovementYet")}</div>
        ) : (
          movements.map((m) => (
            <div key={m.id} className="text-xs py-1.5 border-t border-line first:border-t-0">
              <span className="text-muted">{m.type === "DEPOSIT" ? t("deposit") : t("withdrawal")}</span>{" "}
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
