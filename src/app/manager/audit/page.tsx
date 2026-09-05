import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/format";
import type { Locale } from "@/i18n/config";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "MANAGER") redirect("/client");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [t, locale, total, entries] = await Promise.all([
    getTranslations("audit"),
    getLocale(),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  const loc = locale as Locale;
  const ACTION_LABELS: Record<string, string> = {
    "user.registered": t("actionUserRegistered"),
    "kyc.submitted": t("actionKycSubmitted"),
    "kyc.approved": t("actionKycApproved"),
    "kyc.rejected": t("actionKycRejected"),
    "2fa.enabled": t("actionTwoFactorEnabled"),
    "2fa.disabled": t("actionTwoFactorDisabled"),
    "user.password_reset": t("actionPasswordReset"),
    "fee.performance_withdrawn": t("actionPerfFeeWithdrawn"),
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          <a href="/manager/audit/export" className="text-xs text-green">
            {t("exportCsv")}
          </a>
          <Link href="/manager" className="text-xs text-muted hover:text-foreground">
            {t("backToManager")}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="text-xs text-muted mb-3">{t("entryCount", { count: total })}</div>
        {entries.length === 0 ? (
          <div className="text-muted text-sm">{t("noEntryYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">{t("date")}</th>
                  <th className="text-left p-1.5">{t("actor")}</th>
                  <th className="text-left p-1.5">{t("action")}</th>
                  <th className="text-left p-1.5">{t("entity")}</th>
                  <th className="text-left p-1.5">{t("details")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="p-1.5 text-muted whitespace-nowrap">{fmtDateTime(e.createdAt, loc)}</td>
                    <td className="p-1.5 whitespace-nowrap">
                      {e.actor ? (
                        <>
                          {e.actor.name} <span className="text-muted">({e.actorRole})</span>
                        </>
                      ) : (
                        <span className="text-muted">{t("system")}</span>
                      )}
                    </td>
                    <td className="p-1.5">{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td className="p-1.5 text-muted">
                      {e.entityType}
                      {e.entityId ? ` · ${e.entityId.slice(0, 8)}…` : ""}
                    </td>
                    <td className="p-1.5 text-muted break-all max-w-xs">
                      {e.details ? JSON.stringify(e.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-xs">
            <Link
              href={`/manager/audit?page=${page - 1}`}
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none text-muted opacity-40" : "text-green"}
            >
              {t("previous")}
            </Link>
            <span className="text-muted">{t("pageOf", { page, totalPages })}</span>
            <Link
              href={`/manager/audit?page=${page + 1}`}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none text-muted opacity-40" : "text-green"}
            >
              {t("next")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
