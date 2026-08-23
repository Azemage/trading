import { auth } from "@/auth";
import { buildManagerLedger } from "@/lib/ledger";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MANAGER") {
    return new Response("Non autorisé", { status: 403 });
  }

  const ledger = await buildManagerLedger(100000);
  const rows = ledger.map((e) => ({
    date: e.date.toISOString(),
    type: e.kind === "DEPOSIT" ? "Dépôt" : e.kind === "WITHDRAWAL" ? "Retrait" : "Trade",
    detail: e.kind === "TRADE" ? (e.pair ?? e.note ?? "") : e.clientName,
    pnlPct: e.kind === "TRADE" ? e.pnlPct : "",
    montant: e.kind === "TRADE" ? e.gainUsd : e.amount,
    fraisPerf: e.kind === "TRADE" ? e.fee : "",
  }));

  const csv = toCsv(rows, [
    { key: "date", header: "Date" },
    { key: "type", header: "Type" },
    { key: "detail", header: "Détail" },
    { key: "pnlPct", header: "Résultat %" },
    { key: "montant", header: "Montant $" },
    { key: "fraisPerf", header: "Frais perf. $" },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fiche-de-calcul-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
