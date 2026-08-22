import { NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-guard";
import { resetGatePeriod } from "@/lib/trades";

export async function POST() {
  try {
    const manager = await requireRole("MANAGER");
    await resetGatePeriod(manager.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
