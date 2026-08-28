import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { prisma } from "./prisma";
import { fmtUsd } from "./format";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";

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

/** Fonction de traduction scopée au namespace "emails", pour une locale donnée. */
export type EmailT = Awaited<ReturnType<typeof getTranslations>>;

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

function resolveLocale(locale: string | null | undefined): Locale {
  return locale && isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Résout la fonction de traduction "emails" pour la locale préférée d'un utilisateur. */
export async function getEmailT(locale: string | null | undefined): Promise<EmailT> {
  return getTranslations({ locale: resolveLocale(locale), namespace: "emails" });
}

/** Langue préférée actuelle d'un utilisateur (toujours lue en base, jamais mise en cache dans la session). */
export async function getUserPreferredLocale(userId: string): Promise<Locale> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferredLocale: true } });
  return resolveLocale(user?.preferredLocale);
}

/**
 * Envoie le même modèle d'email (avec pièces jointes éventuelles) à tous les
 * comptes gestionnaire, CHACUN dans sa propre langue préférée.
 */
export async function notifyManagers(
  build: (t: EmailT, locale: Locale) => { subject: string; html: string },
  attachments?: EmailAttachment[]
) {
  const managers = await prisma.user.findMany({
    where: { role: "MANAGER" },
    select: { email: true, preferredLocale: true },
  });
  await Promise.all(
    managers.map(async (m) => {
      const locale = resolveLocale(m.preferredLocale);
      const t = await getEmailT(locale);
      const { subject, html } = build(t, locale);
      return sendEmail({ to: m.email, subject, html, attachments });
    })
  );
}

function layout(t: EmailT, title: string, bodyHtml: string) {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="color: #0a0d12;">${title}</h2>
    ${bodyHtml}
    <p style="color: #8b95a5; font-size: 12px; margin-top: 24px;">${t("footer")}</p>
  </div>`;
}

export const emailTemplates = {
  welcomeRegistration: (t: EmailT, clientName: string) => ({
    subject: t("welcomeSubject"),
    html: layout(t, t("welcomeTitle"), t("welcomeBody", { name: clientName })),
  }),
  kycSubmittedConfirmation: (t: EmailT, clientName: string) => ({
    subject: t("kycSubmittedSubject"),
    html: layout(t, t("kycSubmittedTitle"), t("kycSubmittedBody", { name: clientName })),
  }),
  depositSubmittedConfirmation: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("depositSubmittedSubject"),
    html: layout(
      t,
      t("depositSubmittedTitle"),
      t("depositSubmittedBody", { name: clientName, amount: fmtUsd(amount, locale) })
    ),
  }),
  withdrawalSubmittedConfirmation: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("withdrawalSubmittedSubject"),
    html: layout(
      t,
      t("withdrawalSubmittedTitle"),
      t("withdrawalSubmittedBody", { name: clientName, amount: fmtUsd(amount, locale) })
    ),
  }),
  depositApproved: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("depositApprovedSubject"),
    html: layout(t, t("depositApprovedTitle"), t("depositApprovedBody", { name: clientName, amount: fmtUsd(amount, locale) })),
  }),
  depositRejected: (t: EmailT, locale: Locale, clientName: string, amount: number, reason: string) => ({
    subject: t("depositRejectedSubject"),
    html: layout(
      t,
      t("depositRejectedTitle"),
      t("depositRejectedBody", { name: clientName, amount: fmtUsd(amount, locale), reason })
    ),
  }),
  withdrawalSent: (t: EmailT, locale: Locale, clientName: string, amount: number, txHash: string) => ({
    subject: t("withdrawalSentSubject"),
    html: layout(
      t,
      t("withdrawalSentTitle"),
      t("withdrawalSentBody", { name: clientName, amount: fmtUsd(amount, locale), txHash })
    ),
  }),
  withdrawalRejected: (t: EmailT, locale: Locale, clientName: string, amount: number, reason: string) => ({
    subject: t("withdrawalRejectedSubject"),
    html: layout(
      t,
      t("withdrawalRejectedTitle"),
      t("withdrawalRejectedBody", { name: clientName, amount: fmtUsd(amount, locale), reason })
    ),
  }),
  kycApproved: (t: EmailT, clientName: string) => ({
    subject: t("kycApprovedSubject"),
    html: layout(t, t("kycApprovedTitle"), t("kycApprovedBody", { name: clientName })),
  }),
  kycRejected: (t: EmailT, clientName: string, reason: string) => ({
    subject: t("kycRejectedSubject"),
    html: layout(t, t("kycRejectedTitle"), t("kycRejectedBody", { name: clientName, reason })),
  }),
  managerNewDeposit: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("managerNewDepositSubject"),
    html: layout(
      t,
      t("managerNewDepositTitle"),
      t("managerNewDepositBody", { name: clientName, amount: fmtUsd(amount, locale) })
    ),
  }),
  managerNewWithdrawal: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("managerNewWithdrawalSubject"),
    html: layout(
      t,
      t("managerNewWithdrawalTitle"),
      t("managerNewWithdrawalBody", { name: clientName, amount: fmtUsd(amount, locale) })
    ),
  }),
  passwordReset: (t: EmailT, resetUrl: string) => ({
    subject: t("passwordResetSubject"),
    html: layout(t, t("passwordResetTitle"), t.raw("passwordResetBody").replace("{url}", resetUrl)),
  }),
  managerNewKyc: (t: EmailT, clientName: string, hasPhotos: boolean) => ({
    subject: t("managerNewKycSubject"),
    html: layout(
      t,
      t("managerNewKycTitle"),
      t("managerNewKycBody", { name: clientName }) + (hasPhotos ? t("managerNewKycPhotosNote") : "")
    ),
  }),
};
