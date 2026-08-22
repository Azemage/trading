-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'MANAGER');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "MovementStatus" AS ENUM ('PENDING_CONFIRMATION', 'PENDING_EXECUTION', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TradeSource" AS ENUM ('MANUAL', 'API_SYNC');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('MANAGEMENT', 'PERFORMANCE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "tier" "Tier" NOT NULL DEFAULT 'STANDARD',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "totalAssets" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "totalParts" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "cashBuffer" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "gateUsedThisPeriod" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "gatePeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "highWaterMark" DECIMAL(24,8) NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_holdings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "parts" DECIMAL(24,8) NOT NULL DEFAULT 0,

    CONSTRAINT "client_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "source" "TradeSource" NOT NULL DEFAULT 'MANUAL',
    "pnlPct" DECIMAL(12,6) NOT NULL,
    "navBefore" DECIMAL(24,8) NOT NULL,
    "navAfter" DECIMAL(24,8) NOT NULL,
    "note" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedById" TEXT NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_ledger" (
    "id" TEXT NOT NULL,
    "type" "FeeType" NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT,

    CONSTRAINT "fee_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_movements" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "grantedAmount" DECIMAL(24,8),
    "deferredAmount" DECIMAL(24,8),
    "status" "MovementStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "navAtRequest" DECIMAL(24,8) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "txHash" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "pending_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nav_snapshots" (
    "id" TEXT NOT NULL,
    "nav" DECIMAL(24,8) NOT NULL,
    "totalAssets" DECIMAL(24,8) NOT NULL,
    "totalParts" DECIMAL(24,8) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nav_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_holdings_clientId_key" ON "client_holdings"("clientId");

-- AddForeignKey
ALTER TABLE "client_holdings" ADD CONSTRAINT "client_holdings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_ledger" ADD CONSTRAINT "fee_ledger_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_movements" ADD CONSTRAINT "pending_movements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_movements" ADD CONSTRAINT "pending_movements_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
