import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { auth, signOut } from "@/auth";
import { LocaleSwitcher } from "./locale-switcher";
import type { Locale } from "@/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ledger Capital",
  description: "Plateforme de gestion NAV",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [session, locale, t] = await Promise.all([auth(), getLocale(), getTranslations("nav")]);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <header className="border-b border-line">
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between flex-wrap gap-3">
              <Link href="/" className="font-semibold text-lg tracking-tight">
                {t("brand")}
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="text-muted hover:text-foreground">
                  {t("globalView")}
                </Link>
                {session?.user?.role === "CLIENT" && (
                  <Link href="/client" className="text-muted hover:text-foreground">
                    {t("clientSpace")}
                  </Link>
                )}
                {session?.user?.role === "MANAGER" && (
                  <Link href="/manager" className="text-muted hover:text-foreground">
                    {t("managerSpace")}
                  </Link>
                )}
                {session?.user && (
                  <Link href="/security" className="text-muted hover:text-foreground">
                    {t("security")}
                  </Link>
                )}
                {session?.user ? (
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button className="text-muted hover:text-foreground">
                      {t("logout", { name: session.user.name ?? "" })}
                    </button>
                  </form>
                ) : (
                  <>
                    <Link href="/login" className="text-muted hover:text-foreground">
                      {t("login")}
                    </Link>
                    <Link href="/register" className="text-green">
                      {t("createAccount")}
                    </Link>
                  </>
                )}
                <LocaleSwitcher currentLocale={locale as Locale} />
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
