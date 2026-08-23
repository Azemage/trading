import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  "user.registered": "Inscription client",
  "kyc.submitted": "Soumission KYC",
  "kyc.approved": "KYC approuvé",
  "kyc.rejected": "KYC rejeté",
  "2fa.enabled": "2FA activée",
  "2fa.disabled": "2FA désactivée",
  "user.password_reset": "Mot de passe réinitialisé",
};

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

  const [total, entries] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
        <div className="flex items-center gap-3">
          <a href="/manager/audit/export" className="text-xs text-green">
            Exporter en CSV ↓
          </a>
          <Link href="/manager" className="text-xs text-muted hover:text-foreground">
            ← Retour à l&apos;espace gestionnaire
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="text-xs text-muted mb-3">
          {total} entrée{total > 1 ? "s" : ""} — écriture seule, aucune entrée n&apos;est jamais modifiée ni
          supprimée.
        </div>
        {entries.length === 0 ? (
          <div className="text-muted text-sm">Aucune entrée pour l&apos;instant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="text-left p-1.5">Date</th>
                  <th className="text-left p-1.5">Acteur</th>
                  <th className="text-left p-1.5">Action</th>
                  <th className="text-left p-1.5">Entité</th>
                  <th className="text-left p-1.5">Détails</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="p-1.5 text-muted whitespace-nowrap">{e.createdAt.toLocaleString("fr-FR")}</td>
                    <td className="p-1.5 whitespace-nowrap">
                      {e.actor ? (
                        <>
                          {e.actor.name} <span className="text-muted">({e.actorRole})</span>
                        </>
                      ) : (
                        <span className="text-muted">système</span>
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
              ← Précédent
            </Link>
            <span className="text-muted">
              Page {page} / {totalPages}
            </span>
            <Link
              href={`/manager/audit?page=${page + 1}`}
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none text-muted opacity-40" : "text-green"}
            >
              Suivant →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
