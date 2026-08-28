import { NextResponse } from "next/server";
import { registerClient, registerSchema, RegisterError } from "@/lib/register";
import { AppError } from "@/lib/app-error";
import { translateActionError } from "@/lib/error-i18n";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: await translateActionError(new AppError("VALIDATION_INVALID_FIELDS")) },
      { status: 400 }
    );
  }

  try {
    await registerClient(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RegisterError) {
      return NextResponse.json({ error: await translateActionError(e) }, { status: 409 });
    }
    return NextResponse.json({ error: await translateActionError(e) }, { status: 500 });
  }
}
