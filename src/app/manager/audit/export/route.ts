import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

const MAX_ROWS = 20000;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MANAGER") {
    return new Response("Non autorisé", { status: 403 });
  }

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { actor: { select: { name: true, email: true } } },
  });

  const rows = entries.map((e) => ({
    date: e.createdAt.toISOString(),
    acteur: e.actor ? `${e.actor.name} <${e.actor.email}>` : "système",
    role: e.actorRole ?? "",
    action: e.action,
    entite: e.entityType,
    entiteId: e.entityId ?? "",
    details: e.details ? JSON.stringify(e.details) : "",
  }));

  const csv = toCsv(rows, [
    { key: "date", header: "Date" },
    { key: "acteur", header: "Acteur" },
    { key: "role", header: "Rôle" },
    { key: "action", header: "Action" },
    { key: "entite", header: "Entité" },
    { key: "entiteId", header: "ID entité" },
    { key: "details", header: "Détails" },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
