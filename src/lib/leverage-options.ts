// Aucune dépendance serveur ici (pas de Decimal/Prisma) : ce fichier est
// importé à la fois côté serveur (lib/position.ts) et côté client
// (manager/trade-form.tsx). Mélanger les deux dans un même module casse le
// bundling client (le runtime Prisma n'est pas bundlable pour le navigateur).
export const ALLOWED_LEVERAGES = [1, 2, 3, 5, 10, 20] as const;
