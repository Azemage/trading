import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Par défaut 1 Mo — augmenté pour les deux photos de pièce d'identité (KYC).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
