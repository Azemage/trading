import { NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-guard";
import { approveDeposit } from "@/lib/movements";
import { serialize } from "@/lib/serialize";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireRole("MANAGER");
    const { id } = await params;
    const movement = await approveDeposit(id, manager.id);
    return NextResponse.json(serialize(movement));
  } catch (e) {
    return handleApiError(e);
  }
}
