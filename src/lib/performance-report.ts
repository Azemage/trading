import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { computeNav } from "./nav";
import { buildClientLedger } from "./ledger";

export interface WeeklyPerformanceReport {
  clientId: string;
  name: string;
  email: string;
  preferredLocale: string;
  previousBalance: number;
  currentBalance: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calcule, pour chaque client détenant encore des parts et ayant rejoint le
 * pool depuis au moins 7 jours, son solde actuel et son solde il y a
 * exactement 7 jours — pour générer un rapport de performance hebdomadaire
 * personnalisé. Les clients trop récents (moins d'une semaine d'ancienneté)
 * sont exclus : il n'y a pas encore de "il y a une semaine" à comparer.
 */
export async function computeWeeklyPerformanceReports(): Promise<WeeklyPerformanceReport[]> {
  const [pool, clients] = await Promise.all([
    prisma.poolState.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({
      where: { role: "CLIENT", holding: { parts: { gt: 0 } } },
      select: { id: true, name: true, email: true, preferredLocale: true, holding: { select: { parts: true } } },
    }),
  ]);
  if (!pool) return [];

  const currentNav = computeNav(pool.totalAssets, pool.totalParts).toNumber();
  const cutoff = new Date(Date.now() - WEEK_MS);

  const reports: WeeklyPerformanceReport[] = [];
  for (const client of clients) {
    const { joinDate, entries } = await buildClientLedger(client.id);
    if (!joinDate || joinDate.getTime() > cutoff.getTime()) continue;

    // Solde "il y a une semaine" : celui laissé par le dernier événement
    // (dépôt, retrait ou trade) survenu au plus tard à la date de coupure.
    let previousBalance = 0;
    for (const entry of entries) {
      if (entry.date.getTime() > cutoff.getTime()) break;
      previousBalance = entry.balanceAfter;
    }

    const currentBalance = (client.holding?.parts.toNumber() ?? 0) * currentNav;

    reports.push({
      clientId: client.id,
      name: client.name,
      email: client.email,
      preferredLocale: client.preferredLocale,
      previousBalance,
      currentBalance,
    });
  }

  return reports;
}

/** Trace l'envoi des rapports hebdomadaires dans le journal d'audit. */
export async function recordWeeklyReportsSent(managerId: string, sent: number, skipped: number) {
  await prisma.auditLog.create({
    data: {
      actorId: managerId,
      actorRole: Role.MANAGER,
      action: "reports.weekly_sent",
      entityType: "PerformanceReport",
      details: { sent, skipped },
    },
  });
}
