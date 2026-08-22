import { NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { requireRole, handleApiError, ApiError } from "@/lib/api-guard";
import { requestWithdrawal } from "@/lib/movements";
import { serialize } from "@/lib/serialize";

const schema = z.object({
  amount: z.union([z.number().positive(), z.literal("all")]),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("CLIENT");
    const body = schema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ApiError("Montant invalide");

    const movement = await requestWithdrawal(
      user.id,
      body.data.amount === "all" ? "all" : new Decimal(body.data.amount)
    );
    return NextResponse.json(serialize(movement));
  } catch (e) {
    return handleApiError(e);
  }
}
