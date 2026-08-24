import { Resend } from "resend";
import { prisma } from "./prisma";

const FROM = process.env.EMAIL_FROM ?? "Ledger Capital <onboarding@resend.dev>";

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

/**
 * Envoie un email via Resend si RESEND_API_KEY est configurée, sinon logge
 * le contenu en console (dev sans clé) — ne fait jamais échouer l'action
 * appelante : une notification manquée ne doit jamais bloquer un dépôt,
 * un retrait ou une revue KYC.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}) {
  const client = getClient();
  if (!client) {
    const attachmentNote = params.attachments?.length
      ? ` (+ ${params.attachments.length} pièce(s) jointe(s) : ${params.attachments.map((a) => a.filename).join(", ")})`
      : "";
    console.log(`[email:dev] À: ${params.to} — Objet: ${params.subject}${attachmentNote}\n${params.html}\n`);
    return;
  }

  try {
    await client.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
  } catch (e) {
    console.error("[email] Échec d'envoi (non bloquant) :", e);
  }
}

/** Envoie le même email (avec pièces jointes éventuelles) à tous les comptes gestionnaire. */
export async function notifyManagers(subject: string, html: string, attachments?: EmailAttachment[]) {
  const managers = await prisma.user.findMany({ where: { role: "MANAGER" }, select: { email: true } });
  await Promise.all(managers.map((m) => sendEmail({ to: m.email, subject, html, attachments })));
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
  welcomeRegistration: (clientName: string) =>
    layout(
      "Bienvenue chez Ledger Capital",
      `<p>Bonjour ${clientName},</p><p>Ton compte a bien été créé. Avant de pouvoir effectuer un premier dépôt, complète ta vérification KYC depuis ton espace client.</p>`
    ),
  kycSubmittedConfirmation: (clientName: string) =>
    layout(
      "KYC reçu",
      `<p>Bonjour ${clientName},</p><p>Ta soumission KYC a bien été reçue et est en attente de revue par un gestionnaire. Tu seras notifié dès qu'elle sera traitée.</p>`
    ),
  depositSubmittedConfirmation: (clientName: string, amount: number) =>
    layout(
      "Demande de dépôt reçue",
      `<p>Bonjour ${clientName},</p><p>Ta demande de dépôt de <strong>${fmtUsd(amount)}</strong> a bien été reçue et est en attente de confirmation par un gestionnaire.</p>`
    ),
  withdrawalSubmittedConfirmation: (clientName: string, amount: number) =>
    layout(
      "Demande de retrait reçue",
      `<p>Bonjour ${clientName},</p><p>Ta demande de retrait de <strong>${fmtUsd(amount)}</strong> a bien été reçue et est en cours de traitement par un gestionnaire.</p>`
    ),
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
  passwordReset: (resetUrl: string) =>
    layout(
      "Réinitialisation du mot de passe",
      `<p>Une demande de réinitialisation de mot de passe a été faite pour ce compte.</p><p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p><p>Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`
    ),
  managerNewKyc: (clientName: string, hasPhotos: boolean) =>
    layout(
      "Nouvelle soumission KYC",
      `<p>${clientName} a soumis ses documents KYC. À revoir dans l'espace gestionnaire.</p>${
        hasPhotos ? "<p>Les photos recto/verso sont jointes à cet email.</p>" : ""
      }`
    ),
};
