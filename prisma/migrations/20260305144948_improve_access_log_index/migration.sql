-- DropIndex
DROP INDEX "AccessLog_accessId_idx";

-- CreateIndex
CREATE INDEX "AccessLog_accessId_createdAt_idx" ON "AccessLog"("accessId", "createdAt");
