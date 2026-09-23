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
 * un retrait ou une revue KYC. Retourne néanmoins si l'envoi a réellement
 * réussi (l'API Resend renvoie ses erreurs dans `{ error }`, sans lever
 * d'exception — les ignorer ferait croire à un envoi réussi qui a en
 * réalité échoué, par ex. la restriction "sandbox" de Resend qui bloque
 * l'envoi à toute adresse autre que celle du compte tant qu'aucun domaine
 * n'est vérifié).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();
  if (!client) {
    const attachmentNote = params.attachments?.length
      ? ` (+ ${params.attachments.length} pièce(s) jointe(s) : ${params.attachments.map((a) => a.filename).join(", ")})`
      : "";
    console.log(`[email:dev] À: ${params.to} — Objet: ${params.subject}${attachmentNote}\n${params.html}\n`);
    return { ok: true };
  }

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) {
      console.error(`[email] Échec d'envoi à ${params.to} (non bloquant) :`, error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[email] Échec d'envoi à ${params.to} (non bloquant) :`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
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

// Les messages email contiennent des balises HTML littérales (<p>, <strong>,
// <code>) directement dans le texte traduit. next-intl/ICU les traite comme
// des balises "rich text" qui exigent une fonction de formatage explicite
// pour chaque nom de balise (sinon `t()` lève une FORMATTING_ERROR et
// retombe silencieusement sur la clé brute, ex: "emails.weeklyReportBody",
// au lieu du texte) — d'où l'usage de `t.markup()` partout ci-dessous,
// avec ces fonctions qui renvoient une chaîne (pas du JSX).
const MARKUP_TAGS = {
  p: (chunks: string) => `<p>${chunks}</p>`,
  strong: (chunks: string) => `<strong>${chunks}</strong>`,
  code: (chunks: string) => `<code>${chunks}</code>`,
};

export const emailTemplates = {
  welcomeRegistration: (t: EmailT, clientName: string) => ({
    subject: t("welcomeSubject"),
    html: layout(t, t("welcomeTitle"), t.markup("welcomeBody", { name: clientName, ...MARKUP_TAGS })),
  }),
  kycSubmittedConfirmation: (t: EmailT, clientName: string) => ({
    subject: t("kycSubmittedSubject"),
    html: layout(t, t("kycSubmittedTitle"), t.markup("kycSubmittedBody", { name: clientName, ...MARKUP_TAGS })),
  }),
  depositSubmittedConfirmation: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("depositSubmittedSubject"),
    html: layout(
      t,
      t("depositSubmittedTitle"),
      t.markup("depositSubmittedBody", { name: clientName, amount: fmtUsd(amount, locale), ...MARKUP_TAGS })
    ),
  }),
  withdrawalSubmittedConfirmation: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("withdrawalSubmittedSubject"),
    html: layout(
      t,
      t("withdrawalSubmittedTitle"),
      t.markup("withdrawalSubmittedBody", { name: clientName, amount: fmtUsd(amount, locale), ...MARKUP_TAGS })
    ),
  }),
  depositApproved: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("depositApprovedSubject"),
    html: layout(
      t,
      t("depositApprovedTitle"),
      t.markup("depositApprovedBody", { name: clientName, amount: fmtUsd(amount, locale), ...MARKUP_TAGS })
    ),
  }),
  depositRejected: (t: EmailT, locale: Locale, clientName: string, amount: number, reason: string) => ({
    subject: t("depositRejectedSubject"),
    html: layout(
      t,
      t("depositRejectedTitle"),
      t.markup("depositRejectedBody", { name: clientName, amount: fmtUsd(amount, locale), reason, ...MARKUP_TAGS })
    ),
  }),
  withdrawalSent: (t: EmailT, locale: Locale, clientName: string, amount: number, txHash: string) => ({
    subject: t("withdrawalSentSubject"),
    html: layout(
      t,
      t("withdrawalSentTitle"),
      t.markup("withdrawalSentBody", { name: clientName, amount: fmtUsd(amount, locale), txHash, ...MARKUP_TAGS })
    ),
  }),
  withdrawalRejected: (t: EmailT, locale: Locale, clientName: string, amount: number, reason: string) => ({
    subject: t("withdrawalRejectedSubject"),
    html: layout(
      t,
      t("withdrawalRejectedTitle"),
      t.markup("withdrawalRejectedBody", { name: clientName, amount: fmtUsd(amount, locale), reason, ...MARKUP_TAGS })
    ),
  }),
  kycApproved: (t: EmailT, clientName: string) => ({
    subject: t("kycApprovedSubject"),
    html: layout(t, t("kycApprovedTitle"), t.markup("kycApprovedBody", { name: clientName, ...MARKUP_TAGS })),
  }),
  kycRejected: (t: EmailT, clientName: string, reason: string) => ({
    subject: t("kycRejectedSubject"),
    html: layout(t, t("kycRejectedTitle"), t.markup("kycRejectedBody", { name: clientName, reason, ...MARKUP_TAGS })),
  }),
  managerNewDeposit: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("managerNewDepositSubject"),
    html: layout(
      t,
      t("managerNewDepositTitle"),
      t.markup("managerNewDepositBody", { name: clientName, amount: fmtUsd(amount, locale), ...MARKUP_TAGS })
    ),
  }),
  managerNewWithdrawal: (t: EmailT, locale: Locale, clientName: string, amount: number) => ({
    subject: t("managerNewWithdrawalSubject"),
    html: layout(
      t,
      t("managerNewWithdrawalTitle"),
      t.markup("managerNewWithdrawalBody", { name: clientName, amount: fmtUsd(amount, locale), ...MARKUP_TAGS })
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
      t.markup("managerNewKycBody", { name: clientName, ...MARKUP_TAGS }) +
        (hasPhotos ? t.markup("managerNewKycPhotosNote", { ...MARKUP_TAGS }) : "")
    ),
  }),
  weeklyPerformanceReport: (
    t: EmailT,
    locale: Locale,
    clientName: string,
    previousBalance: number,
    currentBalance: number
  ) => {
    const changePct = previousBalance > 0 ? ((currentBalance - previousBalance) / previousBalance) * 100 : 0;
    const direction = changePct > 0.05 ? "gain" : changePct < -0.05 ? "loss" : "flat";
    const title = t("weeklyReportTitle");
    // bodyHtml (sans le wrapper layout()) est réutilisé tel quel pour la boîte
    // de réception interne (voir lib/client-messages.ts) : pas de style inline
    // fixé pour un fond clair, donc il hérite naturellement du thème sombre
    // de l'app plutôt que de jurer visuellement.
    const bodyHtml = t.markup("weeklyReportBody", {
      name: clientName,
      previousBalance: fmtUsd(previousBalance, locale),
      currentBalance: fmtUsd(currentBalance, locale),
      direction,
      changePct: Math.abs(changePct).toFixed(1),
      ...MARKUP_TAGS,
    });
    return {
      subject: t("weeklyReportSubject"),
      title,
      bodyHtml,
      html: layout(t, title, bodyHtml),
    };
  },
};
