import { ResetPasswordForm } from "./reset-password-form";
import { findValidPasswordResetToken } from "@/lib/password-reset";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token || !(await findValidPasswordResetToken(token))) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-2">Lien invalide</h1>
        <p className="text-sm text-muted mb-4">
          Ce lien de réinitialisation est invalide ou a expiré (durée de validité : 1 heure).
        </p>
        <a href="/forgot-password" className="text-green text-sm">
          Demander un nouveau lien →
        </a>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
