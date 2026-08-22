import { NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { requireRole, handleApiError, ApiError } from "@/lib/api-guard";
import { logManualTrade } from "@/lib/trades";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  pnlPct: z.number().min(-100).max(1000),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const manager = await requireRole("MANAGER");
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ApiError("Résultat invalide");

    const trade = await logManualTrade({
      pnlPct: new Decimal(body.data.pnlPct),
      note: body.data.note,
      loggedById: manager.id,
    });
    return NextResponse.json(serialize(trade));
  } catch (e) {
    return handleApiError(e);
  }
}
