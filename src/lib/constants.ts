import { Decimal } from "@prisma/client/runtime/library";

// Performance fee: prélevée uniquement sur les gains au-dessus du high-water mark.
export const PERFORMANCE_FEE_RATE = new Decimal("0.30");

// Gate mensuel : part maximale de l'AUM total retirable par période.
export const GATE_RATE = new Decimal("0.20");

// Délai (en heures) avant qu'un mouvement en attente devienne éligible à une
// action du gestionnaire (fenêtre anti-arbitrage, cf. brief section 2).
export const PENDING_MOVEMENT_DELAY_HOURS = Number(
  process.env.PENDING_MOVEMENT_DELAY_HOURS ?? 24
);
