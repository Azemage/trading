import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "./reset-password-form";
import { findValidPasswordResetToken } from "@/lib/password-reset";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token || !(await findValidPasswordResetToken(token))) {
    const t = await getTranslations("resetPassword");
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-2">{t("invalidLinkTitle")}</h1>
        <p className="text-sm text-muted mb-4">{t("invalidLinkHint")}</p>
        <a href="/forgot-password" className="text-green text-sm">
          {t("requestNewLink")}
        </a>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
