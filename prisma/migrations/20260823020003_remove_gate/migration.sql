/*
  Warnings:

  - You are about to drop the column `deferredAmount` on the `pending_movements` table. All the data in the column will be lost.
  - You are about to drop the column `gatePeriodStart` on the `pool_state` table. All the data in the column will be lost.
  - You are about to drop the column `gateUsedThisPeriod` on the `pool_state` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pending_movements" DROP COLUMN "deferredAmount";

-- AlterTable
ALTER TABLE "pool_state" DROP COLUMN "gatePeriodStart",
DROP COLUMN "gateUsedThisPeriod";
