-- DropIndex
DROP INDEX "MedicationLog_userId_date_idx";

-- AlterTable
ALTER TABLE "SOSEvent" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MedicationLog_userId_date_scheduleId_idx" ON "MedicationLog"("userId", "date", "scheduleId");
