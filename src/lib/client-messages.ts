import { prisma } from "./prisma";

/** Stocke un message dans la boîte de réception interne d'un client (ex: rapport
 * hebdomadaire) — canal fiable indépendant de l'envoi d'email. */
export async function createClientMessage(clientId: string, subject: string, bodyHtml: string) {
  return prisma.clientMessage.create({ data: { clientId, subject, bodyHtml } });
}

export async function getClientMessages(clientId: string, limit = 50) {
  return prisma.clientMessage.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
