-- CreateTable
CREATE TABLE "fee_withdrawals" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "note" TEXT,
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_withdrawals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fee_withdrawals" ADD CONSTRAINT "fee_withdrawals_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
