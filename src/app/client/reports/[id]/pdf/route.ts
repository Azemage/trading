import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReportPdf } from "@/lib/pdf-report";
import { getLocale } from "next-intl/server";
import { fmtDateTime } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return new Response("Non autorisé", { status: 403 });
  }

  const { id } = await params;
  const message = await prisma.clientMessage.findUnique({ where: { id } });
  if (!message || message.clientId !== session.user.id) {
    return new Response("Introuvable", { status: 404 });
  }

  const locale = (await getLocale()) as Locale;
  const pdf = await generateReportPdf(message.subject, message.bodyHtml, fmtDateTime(message.createdAt, locale));

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rapport-${message.createdAt.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
