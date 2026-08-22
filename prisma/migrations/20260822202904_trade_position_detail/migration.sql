-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('LONG', 'SHORT');

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "direction" "TradeDirection",
ADD COLUMN     "entryPrice" DECIMAL(24,8),
ADD COLUMN     "exitPrice" DECIMAL(24,8),
ADD COLUMN     "pair" TEXT,
ADD COLUMN     "positionSizePct" DECIMAL(7,4);
