import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireRole(role: Role) {
  const session = await auth();
  if (!session?.user) throw new ApiError("Non authentifié", 401);
  if (session.user.role !== role) throw new ApiError("Accès refusé", 403);
  return session.user;
}

export function handleApiError(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof Error) {
    // Erreurs métier (MovementError, TradeError, etc.) : message safe à afficher.
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Erreur inconnue" }, { status: 500 });
}
