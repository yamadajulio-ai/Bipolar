-- DropIndex (IF EXISTS — index may not exist in all environments)
DROP INDEX IF EXISTS "MedicationLog_userId_date_idx";

-- AlterTable
ALTER TABLE "SOSEvent" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MedicationLog_userId_date_scheduleId_idx" ON "MedicationLog"("userId", "date", "scheduleId");
