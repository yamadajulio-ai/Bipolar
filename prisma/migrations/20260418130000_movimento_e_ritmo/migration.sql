-- ADR-011 Movimento e Ritmo: physical activity tracking infrastructure
-- Adds three tables for shadow-mode computation before surfacing to users,
-- plus self-report fields on MoodSnapshot for ground-truth calibration.

-- AlterTable
ALTER TABLE "MoodSnapshot" ADD COLUMN "movementRelative" TEXT;
ALTER TABLE "MoodSnapshot" ADD COLUMN "movementLate" BOOLEAN;

-- CreateTable
CREATE TABLE "PhysicalActivitySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "activityTypeRaw" TEXT NOT NULL,
    "activityTypeNorm" TEXT NOT NULL,
    "startAtUtc" TIMESTAMP(3) NOT NULL,
    "endAtUtc" TIMESTAMP(3) NOT NULL,
    "timezoneOffsetMin" INTEGER NOT NULL,
    "localDate" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "energyKcal" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION,
    "avgHr" INTEGER,
    "intensityBand" TEXT,
    "isIntentional" BOOLEAN NOT NULL DEFAULT true,
    "contextTag" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicalActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActivitySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "steps" INTEGER,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "sessionMinutesLight" INTEGER NOT NULL DEFAULT 0,
    "sessionMinutesModerate" INTEGER NOT NULL DEFAULT 0,
    "sessionMinutesVigorous" INTEGER NOT NULL DEFAULT 0,
    "lateSessionMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastSessionEndRelativeToHabitualSleepMin" INTEGER,
    "activityLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceMix" JSONB,
    "baseline28d" DOUBLE PRECISION,
    "baseline28dMad" DOUBLE PRECISION,
    "zScore" DOUBLE PRECISION,
    "weekendAdjustedBaseline" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyActivitySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAlertAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertLayer" TEXT NOT NULL,
    "alertCategory" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "localDate" TEXT NOT NULL,
    "conditionsFired" JSONB NOT NULL,
    "dataCompleteness" DOUBLE PRECISION,
    "baselineUsed" JSONB,
    "suppressorsActive" JSONB,
    "contextTags" JSONB,
    "finalLayer" TEXT NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "RiskAlertAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalActivitySession_userId_source_externalId_key" ON "PhysicalActivitySession"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "PhysicalActivitySession_userId_startAtUtc_idx" ON "PhysicalActivitySession"("userId", "startAtUtc" DESC);

-- CreateIndex
CREATE INDEX "PhysicalActivitySession_userId_localDate_idx" ON "PhysicalActivitySession"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivitySummary_userId_localDate_key" ON "DailyActivitySummary"("userId", "localDate");

-- CreateIndex
CREATE INDEX "DailyActivitySummary_userId_localDate_idx" ON "DailyActivitySummary"("userId", "localDate" DESC);

-- CreateIndex
CREATE INDEX "RiskAlertAudit_userId_triggeredAt_idx" ON "RiskAlertAudit"("userId", "triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "RiskAlertAudit_userId_localDate_idx" ON "RiskAlertAudit"("userId", "localDate");

-- AddForeignKey
ALTER TABLE "PhysicalActivitySession" ADD CONSTRAINT "PhysicalActivitySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivitySummary" ADD CONSTRAINT "DailyActivitySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAlertAudit" ADD CONSTRAINT "RiskAlertAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
