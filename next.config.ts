import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    // Par défaut 1 Mo — augmenté pour les deux photos de pièce d'identité (KYC),
    // mais plafonné à 4 Mo pour rester sous la limite de 4,5 Mo des fonctions
    // serverless Vercel (non contournable, quelle que soit cette valeur).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
