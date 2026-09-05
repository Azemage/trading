import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeNav } from "@/lib/nav";
import {
  approveDepositAction,
  rejectDepositAction,
  rejectWithdrawalAction,
  reviewKycAction,
  sendWithdrawalAction,
} from "./actions";
import { TradeForm } from "./trade-form";
import { PoolAdjustForm } from "./pool-adjust-form";
import { CreateTestClientForm } from "./create-test-client-form";
import { ResetTestDataForm } from "./reset-test-data-form";
import { buildManagerLedger } from "@/lib/ledger";
import { fmtUsd, fmtDateTime } from "@/lib/format";
import { USDC_NETWORK_LABELS, type UsdcNetworkValue } from "@/lib/usdc";
import type { Locale } from "@/i18n/config";

export default async function ManagerView() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MANAGER") redirect("/client");

  const [t, locale, pool, pendingDeposits, pendingWithdrawals, feeAgg, tradingFeeAgg, holdings, ledger, pendingKyc] =
    await Promise.all([
      getTranslations("manager"),
      getLocale(),
      prisma.poolState.findUnique({ where: { id: 1 } }),
      prisma.pendingMovement.findMany({
        where: { type: "DEPOSIT", status: "PENDING_CONFIRMATION" },
        include: { client: { select: { name: true, email: true } } },
        orderBy: { requestedAt: "asc" },
      }),
      prisma.pendingMovement.findMany({
        where: { type: "WITHDRAWAL", status: "PENDING_EXECUTION" },
        include: { client: { select: { name: true, email: true, usdcNetwork: true, usdcAddress: true } } },
        orderBy: { requestedAt: "asc" },
      }),
      prisma.feeLedger.aggregate({ where: { type: "PERFORMANCE" }, _sum: { amount: true } }),
      prisma.feeLedger.aggregate({ where: { type: "TRADING" }, _sum: { amount: true } }),
      prisma.clientHolding.findMany({
        where: { parts: { gt: 0 } },
        include: { client: { select: { name: true, email: true } } },
      }),
      buildManagerLedger(100),
      prisma.kycSubmission.findMany({
        where: { status: "PENDING" },
        include: { client: { select: { name: true, email: true } } },
        orderBy: { submittedAt: "asc" },
      }),
    ]);

  const loc = locale as Locale;
  const fmt = (n: number) => fmtUsd(n, loc);
  const networkLabel = (value: UsdcNetworkValue) => (value === "OTHER" ? t("otherNetwork") : USDC_NETWORK_LABELS[value]);
  const defaultRejectReason = t("defaultRejectReason");

  const totalAssets = pool?.totalAssets.toNumber() ?? 0;
  const totalParts = pool?.totalParts.toNumber() ?? 0;
  const nav = computeNav(totalAssets, totalParts).toNumber();
  // Horodatage serveur pris une fois par requête, comparé aux échéances déjà figées en base.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <a href="/manager/audit" className="text-xs text-muted hover:text-foreground">
          {t("auditLog")}
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card">
          <div className="label-mono">{t("perfFeeRevenue")}</div>
          <div className="text-xl font-bold text-gold mt-1">{fmt(feeAgg._sum.amount?.toNumber() ?? 0)}</div>
        </div>
        <div className="card">
          <div className="label-mono">{t("tradingFeeCumulative")}</div>
          <div className="text-xl font-bold text-muted mt-1">{fmt(tradingFeeAgg._sum.amount?.toNumber() ?? 0)}</div>
        </div>
        <div className="card">
          <div className="label-mono">{t("pendingDeposits")}</div>
          <div className="text-xl font-bold mt-1">{pendingDeposits.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="label-mono text-gold mb-3">{t("logTradeTitle")}</div>
        <TradeForm currentTotalAssets={totalAssets} />
        <div className="text-xs text-muted mt-2">{t("logTradeHint")}</div>
      </div>

      <div className="card border-red space-y-4">
        <div className="label-mono text-red">🧪 {t("testTools")}</div>

        <div>
          <div className="text-xs text-gold mb-2">{t("createTestClient")}</div>
          <CreateTestClientForm />
          <div className="text-xs text-muted mt-2">{t("createTestClientHint")}</div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="text-xs text-gold mb-2">{t("adjustAum")}</div>
          <PoolAdjustForm currentTotalAssets={totalAssets} />
          <div className="text-xs text-muted mt-2">{t("adjustAumHint")}</div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="text-xs text-gold mb-2">{t("resetAll")}</div>
          <ResetTestDataForm />
          <div className="text-xs text-muted mt-2">{t("resetAllHint")}</div>
        </div>
      </div>

      <div className="card">
        <div className="label-mono mb-3">{t("kycToValidate")}</div>
        {pendingKyc.length === 0 ? (
          <div className="text-muted text-sm">{t("noPendingKyc")}</div>
        ) : (
          pendingKyc.map((k) => (
            <div key={k.id} className="py-2 border-t border-line first:border-t-0 text-sm space-y-1">
              <div>
                {k.client.name} ({k.client.email}) — {k.documentType} {k.documentNumber}
              </div>
              <div className="text-xs text-muted">
                {t("declaredLegalName")} {k.legalName}
                {k.note ? ` — ${k.note}` : ""}
              </div>
              {(k.idFrontImage || k.idBackImage) && (
                <div className="flex gap-2">
                  {k.idFrontImage && k.idFrontMimeType && (
                    <a
                      href={`data:${k.idFrontMimeType};base64,${Buffer.from(k.idFrontImage).toString("base64")}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <img
                        src={`data:${k.idFrontMimeType};base64,${Buffer.from(k.idFrontImage).toString("base64")}`}
                        alt={t("photoFrontAlt")}
                        className="h-24 w-auto rounded border border-line"
                      />
                    </a>
                  )}
                  {k.idBackImage && k.idBackMimeType && (
                    <a
                      href={`data:${k.idBackMimeType};base64,${Buffer.from(k.idBackImage).toString("base64")}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <img
                        src={`data:${k.idBackMimeType};base64,${Buffer.from(k.idBackImage).toString("base64")}`}
                        alt={t("photoBackAlt")}
                        className="h-24 w-auto rounded border border-line"
                      />
                    </a>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <form action={reviewKycAction.bind(null, k.id)}>
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn">{t("approve")}</button>
                </form>
                <form action={reviewKycAction.bind(null, k.id)} className="flex gap-1">
                  <input type="hidden" name="decision" value="reject" />
                  <input name="reason" placeholder={t("rejectReasonPlaceholder")} required className="text-xs w-40" />
                  <button className="btn btn-red">{t("reject")}</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="label-mono mb-3">{t("depositsToValidate")}</div>
        {pendingDeposits.length === 0 ? (
          <div className="text-muted text-sm">{t("noPendingDeposit")}</div>
        ) : (
          pendingDeposits.map((d) => {
            const eligible = now >= d.eligibleAt.getTime();
            return (
              <div key={d.id} className="flex items-center justify-between flex-wrap gap-2 py-2 border-t border-line first:border-t-0 text-sm">
                <span>
                  {d.client.name} — {fmt(d.amount.toNumber())}
                  {!eligible && (
                    <span className="text-xs text-muted"> {t("eligibleOn", { date: fmtDateTime(d.eligibleAt, loc) })}</span>
                  )}
                </span>
                <div className="flex gap-2">
                  <form action={approveDepositAction.bind(null, d.id)}>
                    <button className="btn" disabled={!eligible}>{t("approve")}</button>
                  </form>
                  <form action={rejectDepositAction.bind(null, d.id)} className="flex gap-1">
                    <input type="hidden" name="reason" value={defaultRejectReason} />
                    <button className="btn btn-red">{t("reject")}</button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="mb-3">
          <div className="label-mono">{t("withdrawalsToProcess")}</div>
        </div>
        {pendingWithdrawals.length === 0 ? (
          <div className="text-muted text-sm">{t("noPendingWithdrawal")}</div>
        ) : (
          pendingWithdrawals.map((w) => {
            const eligible = now >= w.eligibleAt.getTime();
            return (
              <div key={w.id} className="flex items-center justify-between flex-wrap gap-2 py-2 border-t border-line first:border-t-0 text-sm">
                <span>
                  {w.client.name} — {fmt(w.grantedAmount?.toNumber() ?? 0)}
                  {!eligible && (
                    <span className="text-xs text-muted"> {t("eligibleOn", { date: fmtDateTime(w.eligibleAt, loc) })}</span>
                  )}
                  <div className="text-xs text-muted">
                    {w.client.usdcAddress ? (
                      <>
                        {networkLabel(w.client.usdcNetwork as UsdcNetworkValue)} — <code>{w.client.usdcAddress}</code>
                      </>
                    ) : (
                      <span className="text-red">{t("noUsdcAddress")}</span>
                    )}
                  </div>
                </span>
                <div className="flex gap-2 items-center">
                  <form action={sendWithdrawalAction.bind(null, w.id)} className="flex gap-1 items-center">
                    <input name="txHash" placeholder="tx_hash" required className="text-xs w-32" />
                    <button className="btn" disabled={!eligible}>{t("markSent")}</button>
                  </form>
                  <form action={rejectWithdrawalAction.bind(null, w.id)}>
                    <input type="hidden" name="reason" value={defaultRejectReason} />
                    <button className="btn btn-red">{t("reject")}</button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="label-mono mb-3">{t("clientBalances")}</div>
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="text-muted">
              <th className="text-left p-1.5">{t("client")}</th>
              <th className="text-right p-1.5">{t("parts")}</th>
              <th className="text-right p-1.5">{t("value")}</th>
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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="label-mono">{t("ledgerTitle")}</div>
          <a href="/manager/export/ledger" className="text-xs text-green">
            {t("exportCsv")}
          </a>
        </div>
        {ledger.length === 0 ? (
          <div className="text-muted text-sm">{t("noMovementYet")}</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">{t("date")}</th>
                  <th className="text-left p-1.5">{t("type")}</th>
                  <th className="text-left p-1.5">{t("detail")}</th>
                  <th className="text-right p-1.5">{t("amount")}</th>
                  <th className="text-right p-1.5">{t("tradingFee")}</th>
                  <th className="text-right p-1.5">{t("perfFee")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => {
                  if (e.kind === "DEPOSIT") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{fmtDateTime(e.date, loc)}</td>
                        <td className="p-1.5 text-blue">{t("deposit")}</td>
                        <td className="p-1.5">{e.clientName}</td>
                        <td className="p-1.5 text-right text-green">+{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                      </tr>
                    );
                  }
                  if (e.kind === "WITHDRAWAL") {
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="p-1.5 text-muted">{fmtDateTime(e.date, loc)}</td>
                        <td className="p-1.5 text-gold">{t("withdrawal")}</td>
                        <td className="p-1.5">{e.clientName}</td>
                        <td className="p-1.5 text-right text-red">-{fmt(e.amount)}</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                        <td className="p-1.5 text-right text-muted">—</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="p-1.5 text-muted">{fmtDateTime(e.date, loc)}</td>
                      <td className="p-1.5">{t("trade")}</td>
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
                      <td className="p-1.5 text-right text-muted">{e.tradingFeeUsd > 0 ? fmt(e.tradingFeeUsd) : "—"}</td>
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
