-- AlterTable
ALTER TABLE "ProfessionalAccess" ADD COLUMN     "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "shareSosEvents" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_accessId_idx" ON "AccessLog"("accessId");

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ProfessionalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
