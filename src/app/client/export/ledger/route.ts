import { auth } from "@/auth";
import { buildClientLedger } from "@/lib/ledger";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT") {
    return new Response("Non autorisé", { status: 403 });
  }

  const { entries } = await buildClientLedger(session.user.id);
  const rows = entries.map((e) => ({
    date: e.date.toISOString(),
    type: e.kind === "DEPOSIT" ? "Dépôt" : e.kind === "WITHDRAWAL" ? "Retrait" : "Trade",
    detail: e.kind === "TRADE" ? (e.pair ?? "") : "",
    pnlPct: e.kind === "TRADE" ? e.pnlPct : "",
    impact: e.kind === "TRADE" ? e.gainUsd : e.amount,
    fraisPerf: e.kind === "TRADE" ? e.feeUsd : "",
    soldeApres: e.balanceAfter,
  }));

  const csv = toCsv(rows, [
    { key: "date", header: "Date" },
    { key: "type", header: "Type" },
    { key: "detail", header: "Détail" },
    { key: "pnlPct", header: "Résultat %" },
    { key: "impact", header: "Impact $" },
    { key: "fraisPerf", header: "Frais perf. $" },
    { key: "soldeApres", header: "Solde après $" },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mon-historique-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
