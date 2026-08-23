export type UsdcNetworkValue = "ETHEREUM" | "POLYGON" | "BASE" | "SOLANA" | "TRON" | "OTHER";

export const USDC_NETWORK_LABELS: Record<UsdcNetworkValue, string> = {
  ETHEREUM: "Ethereum (ERC-20)",
  POLYGON: "Polygon",
  BASE: "Base",
  SOLANA: "Solana (SPL)",
  TRON: "Tron (TRC-20)",
  OTHER: "Autre réseau",
};

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
// Base58, sans 0/O/I/l : approximation raisonnable pour Solana et Tron.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Valide le format d'une adresse selon le réseau choisi. Ne vérifie PAS que
 * l'adresse existe réellement on-chain — seulement que le format est
 * plausible pour ce réseau, pour attraper les erreurs de copier-coller
 * évidentes (mauvais réseau, adresse tronquée, caractères invalides).
 */
export function validateUsdcAddress(
  network: UsdcNetworkValue,
  address: string
): { valid: boolean; error?: string } {
  const trimmed = address.trim();
  if (!trimmed) return { valid: false, error: "Adresse requise" };

  switch (network) {
    case "ETHEREUM":
    case "POLYGON":
    case "BASE":
      if (!EVM_ADDRESS.test(trimmed)) {
        return { valid: false, error: "Adresse invalide : attendu 0x suivi de 40 caractères hexadécimaux" };
      }
      return { valid: true };
    case "SOLANA":
      if (trimmed.length < 32 || trimmed.length > 44 || !BASE58.test(trimmed)) {
        return { valid: false, error: "Adresse Solana invalide (base58, 32 à 44 caractères)" };
      }
      return { valid: true };
    case "TRON":
      if (trimmed.length !== 34 || !trimmed.startsWith("T") || !BASE58.test(trimmed)) {
        return { valid: false, error: "Adresse Tron invalide (34 caractères, commence par T)" };
      }
      return { valid: true };
    case "OTHER":
      if (trimmed.length < 4 || trimmed.length > 128) {
        return { valid: false, error: "Adresse invalide" };
      }
      return { valid: true };
  }
}
