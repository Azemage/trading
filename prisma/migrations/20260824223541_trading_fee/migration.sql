-- AlterEnum
ALTER TYPE "FeeType" ADD VALUE 'TRADING';

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "tradingFeeUsd" DECIMAL(24,8);
