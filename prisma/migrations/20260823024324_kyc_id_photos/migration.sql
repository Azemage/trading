-- AlterTable
ALTER TABLE "kyc_submissions" ADD COLUMN     "idBackImage" BYTEA,
ADD COLUMN     "idBackMimeType" TEXT,
ADD COLUMN     "idFrontImage" BYTEA,
ADD COLUMN     "idFrontMimeType" TEXT;
