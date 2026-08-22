import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeNav } from "@/lib/nav";
import { serialize } from "@/lib/serialize";

// Vue globale publique : NAV historique, AUM, registre des trades. Aucune
// authentification requise — ne doit jamais exposer de données par client.
export async function GET() {
  const [pool, navHistory, trades, activeClients] = await Promise.all([
    prisma.poolState.findUnique({ where: { id: 1 } }),
    prisma.navSnapshot.findMany({ orderBy: { createdAt: "asc" }, take: 500 }),
    prisma.trade.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
      select: { id: true, pnlPct: true, note: true, timestamp: true, navAfter: true, source: true },
    }),
    prisma.clientHolding.count({ where: { parts: { gt: 0 } } }),
  ]);

  const totalAssets = pool?.totalAssets ?? 0;
  const totalParts = pool?.totalParts ?? 0;

  return NextResponse.json(
    serialize({
      nav: computeNav(totalAssets, totalParts),
      totalAssets,
      activeClients,
      tradesCount: trades.length,
      navHistory,
      trades,
    })
  );
}
