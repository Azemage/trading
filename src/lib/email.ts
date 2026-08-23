import { Resend } from "resend";
import { prisma } from "./prisma";

const FROM = process.env.EMAIL_FROM ?? "Ledger Capital <onboarding@resend.dev>";

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * Envoie un email via Resend si RESEND_API_KEY est configurée, sinon logge
 * le contenu en console (dev sans clé) — ne fait jamais échouer l'action
 * appelante : une notification manquée ne doit jamais bloquer un dépôt,
 * un retrait ou une revue KYC.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const client = getClient();
  if (!client) {
    console.log(`[email:dev] À: ${params.to} — Objet: ${params.subject}\n${params.html}\n`);
    return;
  }

  try {
    await client.emails.send({ from: FROM, to: params.to, subject: params.subject, html: params.html });
  } catch (e) {
    console.error("[email] Échec d'envoi (non bloquant) :", e);
  }
}

/** Envoie le même email à tous les comptes gestionnaire. */
export async function notifyManagers(subject: string, html: string) {
  const managers = await prisma.user.findMany({ where: { role: "MANAGER" }, select: { email: true } });
  await Promise.all(managers.map((m) => sendEmail({ to: m.email, subject, html })));
}

function layout(title: string, bodyHtml: string) {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="color: #0a0d12;">${title}</h2>
    ${bodyHtml}
    <p style="color: #8b95a5; font-size: 12px; margin-top: 24px;">Ledger Capital — cet email est automatique, ne pas répondre.</p>
  </div>`;
}

function fmtUsd(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

export const emailTemplates = {
  depositApproved: (clientName: string, amount: number) =>
    layout(
      "Dépôt confirmé",
      `<p>Bonjour ${clientName},</p><p>Ton dépôt de <strong>${fmtUsd(amount)}</strong> a été confirmé et ajouté au pool commun.</p>`
    ),
  depositRejected: (clientName: string, amount: number, reason: string) =>
    layout(
      "Dépôt rejeté",
      `<p>Bonjour ${clientName},</p><p>Ton dépôt de <strong>${fmtUsd(amount)}</strong> a été rejeté.</p><p>Motif : ${reason}</p>`
    ),
  withdrawalSent: (clientName: string, amount: number, txHash: string) =>
    layout(
      "Retrait envoyé",
      `<p>Bonjour ${clientName},</p><p>Ton retrait de <strong>${fmtUsd(amount)}</strong> a été envoyé.</p><p>Référence de transaction : <code>${txHash}</code></p>`
    ),
  withdrawalRejected: (clientName: string, amount: number, reason: string) =>
    layout(
      "Retrait rejeté",
      `<p>Bonjour ${clientName},</p><p>Ta demande de retrait de <strong>${fmtUsd(amount)}</strong> a été rejetée, tes parts ont été restituées.</p><p>Motif : ${reason}</p>`
    ),
  kycApproved: (clientName: string) =>
    layout(
      "Vérification KYC approuvée",
      `<p>Bonjour ${clientName},</p><p>Ta vérification d'identité a été approuvée. Tu peux maintenant demander des retraits.</p>`
    ),
  kycRejected: (clientName: string, reason: string) =>
    layout(
      "Vérification KYC rejetée",
      `<p>Bonjour ${clientName},</p><p>Ta vérification d'identité a été rejetée.</p><p>Motif : ${reason}</p><p>Tu peux soumettre une nouvelle demande depuis ton espace client.</p>`
    ),
  managerNewDeposit: (clientName: string, amount: number) =>
    layout(
      "Nouvelle demande de dépôt",
      `<p>${clientName} a demandé un dépôt de <strong>${fmtUsd(amount)}</strong>. À valider dans l'espace gestionnaire.</p>`
    ),
  managerNewWithdrawal: (clientName: string, amount: number) =>
    layout(
      "Nouvelle demande de retrait",
      `<p>${clientName} a demandé un retrait de <strong>${fmtUsd(amount)}</strong>. À traiter dans l'espace gestionnaire.</p>`
    ),
  managerNewKyc: (clientName: string) =>
    layout(
      "Nouvelle soumission KYC",
      `<p>${clientName} a soumis ses documents KYC. À revoir dans l'espace gestionnaire.</p>`
    ),
};
