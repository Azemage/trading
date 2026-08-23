import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/auth";

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
  const session = await auth();

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between flex-wrap gap-3">
            <Link href="/" className="font-semibold text-lg tracking-tight">
              Ledger Capital
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-muted hover:text-foreground">
                Vue globale
              </Link>
              {session?.user?.role === "CLIENT" && (
                <Link href="/client" className="text-muted hover:text-foreground">
                  Espace client
                </Link>
              )}
              {session?.user?.role === "MANAGER" && (
                <Link href="/manager" className="text-muted hover:text-foreground">
                  Espace gestionnaire
                </Link>
              )}
              {session?.user && (
                <Link href="/security" className="text-muted hover:text-foreground">
                  Sécurité
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
                    Déconnexion ({session.user.name})
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login" className="text-muted hover:text-foreground">
                    Connexion
                  </Link>
                  <Link href="/register" className="text-green">
                    Créer un compte
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
