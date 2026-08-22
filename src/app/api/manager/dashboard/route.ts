import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-guard";
import { computeGateBudget, computeGateRemaining } from "@/lib/gate";
import { computeNav } from "@/lib/nav";
import { serialize } from "@/lib/serialize";

export async function GET() {
  try {
    await requireRole("MANAGER");

    const [pool, pendingDeposits, pendingWithdrawals, feeAgg, holdings] = await Promise.all([
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
      prisma.feeLedger.aggregate({
        where: { type: "PERFORMANCE" },
        _sum: { amount: true },
      }),
      prisma.clientHolding.findMany({
        where: { parts: { gt: 0 } },
        include: { client: { select: { name: true, email: true, tier: true } } },
      }),
    ]);

    const totalAssets = pool?.totalAssets ?? 0;
    const nav = computeNav(totalAssets, pool?.totalParts ?? 0);

    return NextResponse.json(
      serialize({
        nav,
        totalAssets,
        gateBudget: computeGateBudget(totalAssets),
        gateUsed: pool?.gateUsedThisPeriod ?? 0,
        gateRemaining: computeGateRemaining(totalAssets, pool?.gateUsedThisPeriod ?? 0),
        managerRevenuePerf: feeAgg._sum.amount ?? 0,
        pendingDeposits,
        pendingWithdrawals,
        holdings: holdings.map((h) => ({
          clientName: h.client.name,
          clientEmail: h.client.email,
          tier: h.client.tier,
          parts: h.parts,
          value: h.parts.times(nav),
        })),
      })
    );
  } catch (e) {
    return handleApiError(e);
  }
}
