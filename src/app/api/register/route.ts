import { NextResponse } from "next/server";
import { registerClient, registerSchema, RegisterError } from "@/lib/register";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Champs invalides" }, { status: 400 });
  }

  try {
    await registerClient(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RegisterError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur inconnue" }, { status: 500 });
  }
}
