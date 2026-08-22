import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleApiError, ApiError } from "@/lib/api-guard";
import { markWithdrawalSent } from "@/lib/movements";
import { serialize } from "@/lib/serialize";

const schema = z.object({ txHash: z.string().min(1).max(200) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireRole("MANAGER");
    const { id } = await params;
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ApiError("tx_hash requis");

    const movement = await markWithdrawalSent(id, manager.id, body.data.txHash);
    return NextResponse.json(serialize(movement));
  } catch (e) {
    return handleApiError(e);
  }
}
