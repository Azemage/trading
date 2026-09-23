-- CreateTable
CREATE TABLE "client_messages" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
