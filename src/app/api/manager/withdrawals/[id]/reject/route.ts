import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleApiError, ApiError } from "@/lib/api-guard";
import { rejectWithdrawal } from "@/lib/movements";
import { serialize } from "@/lib/serialize";

const schema = z.object({ reason: z.string().min(1).max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireRole("MANAGER");
    const { id } = await params;
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ApiError("Motif de rejet requis");

    const movement = await rejectWithdrawal(id, manager.id, body.data.reason);
    return NextResponse.json(serialize(movement));
  } catch (e) {
    return handleApiError(e);
  }
}
