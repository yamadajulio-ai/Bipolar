-- CreateTable
CREATE TABLE "PlannerBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FLEX',
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "notes" TEXT,
    "energyCost" INTEGER NOT NULL DEFAULT 3,
    "stimulation" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannerBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannerRecurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockId" TEXT NOT NULL,
    "freq" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekDays" TEXT,
    "until" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannerRecurrence_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlannerBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannerException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockId" TEXT NOT NULL,
    "occurrenceDate" DATETIME NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "overrideStartAt" DATETIME,
    "overrideEndAt" DATETIME,
    "overrideTitle" TEXT,
    "overrideNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlannerException_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlannerBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StabilityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lateEventCutoffMin" INTEGER NOT NULL DEFAULT 1260,
    "windDownMin" INTEGER NOT NULL DEFAULT 90,
    "minBufferBeforeSleep" INTEGER NOT NULL DEFAULT 60,
    "maxLateNightsPerWeek" INTEGER NOT NULL DEFAULT 2,
    "protectAnchors" BOOLEAN NOT NULL DEFAULT true,
    "targetSleepTimeMin" INTEGER,
    "targetWakeTimeMin" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StabilityRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlannerBlock_userId_startAt_idx" ON "PlannerBlock"("userId", "startAt");

-- CreateIndex
CREATE INDEX "PlannerBlock_userId_endAt_idx" ON "PlannerBlock"("userId", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerRecurrence_blockId_key" ON "PlannerRecurrence"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerException_blockId_occurrenceDate_key" ON "PlannerException"("blockId", "occurrenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StabilityRule_userId_key" ON "StabilityRule"("userId");
