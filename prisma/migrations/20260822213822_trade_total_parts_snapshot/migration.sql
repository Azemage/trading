/*
  Warnings:

  - Added the required column `totalPartsAtTrade` to the `trades` table without a default value. This is not possible if the table is not empty.

  Fix: colonne ajoutée nullable, puis remplie pour les trades déjà existants
  avec le total_parts actuel du pool (meilleure approximation disponible —
  ces anciens trades n'avaient pas cette donnée enregistrée), avant de la
  rendre obligatoire pour tous les trades futurs.
*/
-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "totalPartsAtTrade" DECIMAL(24,8);

-- Backfill des trades existants avec le total_parts courant du pool.
UPDATE "trades"
SET "totalPartsAtTrade" = (SELECT "totalParts" FROM "pool_state" WHERE id = 1)
WHERE "totalPartsAtTrade" IS NULL;

-- Au cas où pool_state serait vide (jamais initialisé) : filet de sécurité à 0.
UPDATE "trades" SET "totalPartsAtTrade" = 0 WHERE "totalPartsAtTrade" IS NULL;

ALTER TABLE "trades" ALTER COLUMN "totalPartsAtTrade" SET NOT NULL;
