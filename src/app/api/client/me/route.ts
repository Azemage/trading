import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-guard";
import { computeNav, valueForParts } from "@/lib/nav";
import { serialize } from "@/lib/serialize";

export async function GET() {
  try {
    const user = await requireRole("CLIENT");

    const [pool, holding, movements] = await Promise.all([
      prisma.poolState.findUnique({ where: { id: 1 } }),
      prisma.clientHolding.findUnique({ where: { clientId: user.id } }),
      prisma.pendingMovement.findMany({
        where: { clientId: user.id },
        orderBy: { requestedAt: "desc" },
        take: 50,
      }),
    ]);

    const nav = computeNav(pool?.totalAssets ?? 0, pool?.totalParts ?? 0);
    const parts = holding?.parts ?? 0;
    const confirmedBalance = valueForParts(parts, nav);

    const pendingDeposits = movements.filter(
      (m) => m.type === "DEPOSIT" && m.status === "PENDING_CONFIRMATION"
    );
    const pendingWithdrawals = movements.filter(
      (m) => m.type === "WITHDRAWAL" && m.status === "PENDING_EXECUTION"
    );

    return NextResponse.json(
      serialize({
        name: user.name,
        nav,
        parts,
        confirmedBalance,
        pendingDepositsTotal: pendingDeposits.reduce((s, m) => s + m.amount.toNumber(), 0),
        pendingWithdrawalsTotal: pendingWithdrawals.reduce(
          (s, m) => s + (m.grantedAmount?.toNumber() ?? 0),
          0
        ),
        movements,
      })
    );
  } catch (e) {
    return handleApiError(e);
  }
}
