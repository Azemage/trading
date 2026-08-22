import { prisma } from "./prisma";

/** Le pool est un singleton — une seule ligne, id=1. La crée si absente. */
export async function getOrCreatePoolState() {
  const existing = await prisma.poolState.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.poolState.create({ data: { id: 1 } });
}
