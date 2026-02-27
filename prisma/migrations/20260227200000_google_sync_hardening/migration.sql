-- AlterTable: Add lastSyncAt to GoogleAccount
ALTER TABLE "GoogleAccount" ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- First, clean up any duplicate (userId, googleEventId) rows before adding constraint.
-- Keep only the most recently updated row for each duplicate pair.
DELETE FROM "PlannerBlock" a
USING "PlannerBlock" b
WHERE a."userId" = b."userId"
  AND a."googleEventId" = b."googleEventId"
  AND a."googleEventId" IS NOT NULL
  AND a."updatedAt" < b."updatedAt";

-- CreateIndex: Unique constraint on (userId, googleEventId)
-- NULL googleEventId values are still allowed (app-created blocks without Google link)
CREATE UNIQUE INDEX "PlannerBlock_userId_googleEventId_key" ON "PlannerBlock"("userId", "googleEventId");
