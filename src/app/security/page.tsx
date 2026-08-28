import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TwoFactorSettings } from "./two-factor-settings";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [t, user] = await Promise.all([
    getTranslations("security"),
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
  ]);

  return (
    <div className="max-w-sm mx-auto px-4 sm:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="card">
        <div className="label-mono mb-3">{t("twoFactorTitle")}</div>
        <TwoFactorSettings initiallyEnabled={user.twoFactorEnabled} />
      </div>
    </div>
  );
}
