-- CreateTable
CREATE TABLE "PlannerTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannerTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannerTemplateBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FLEX',
    "startTimeMin" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "energyCost" INTEGER NOT NULL DEFAULT 3,
    "stimulation" INTEGER NOT NULL DEFAULT 1,
    "weekDay" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "PlannerTemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlannerTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlannerBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FLEX',
    "isRoutine" BOOLEAN NOT NULL DEFAULT false,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "notes" TEXT,
    "energyCost" INTEGER NOT NULL DEFAULT 3,
    "stimulation" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannerBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlannerBlock" ("category", "createdAt", "endAt", "energyCost", "id", "kind", "notes", "startAt", "stimulation", "title", "updatedAt", "userId") SELECT "category", "createdAt", "endAt", "energyCost", "id", "kind", "notes", "startAt", "stimulation", "title", "updatedAt", "userId" FROM "PlannerBlock";
DROP TABLE "PlannerBlock";
ALTER TABLE "new_PlannerBlock" RENAME TO "PlannerBlock";
CREATE INDEX "PlannerBlock_userId_startAt_idx" ON "PlannerBlock"("userId", "startAt");
CREATE INDEX "PlannerBlock_userId_endAt_idx" ON "PlannerBlock"("userId", "endAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlannerTemplate_userId_idx" ON "PlannerTemplate"("userId");

-- CreateIndex
CREATE INDEX "PlannerTemplateBlock_templateId_idx" ON "PlannerTemplateBlock"("templateId");
