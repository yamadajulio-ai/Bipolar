-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN "anxietyLevel" INTEGER;
ALTER TABLE "DiaryEntry" ADD COLUMN "energyLevel" INTEGER;
ALTER TABLE "DiaryEntry" ADD COLUMN "irritability" INTEGER;
ALTER TABLE "DiaryEntry" ADD COLUMN "tookMedication" TEXT;
ALTER TABLE "DiaryEntry" ADD COLUMN "warningSigns" TEXT;

-- CreateTable
CREATE TABLE "SleepLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bedtime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "totalHours" REAL NOT NULL,
    "quality" INTEGER NOT NULL,
    "awakenings" INTEGER NOT NULL DEFAULT 0,
    "preRoutine" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "durationSecs" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyRhythm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "wakeTime" TEXT,
    "firstContact" TEXT,
    "mainActivityStart" TEXT,
    "dinnerTime" TEXT,
    "bedtime" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyRhythm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wakeReminder" TEXT,
    "sleepReminder" TEXT,
    "diaryReminder" TEXT,
    "breathingReminder" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ReminderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrisisPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trustedContacts" TEXT,
    "professionalName" TEXT,
    "professionalPhone" TEXT,
    "medications" TEXT,
    "preferredHospital" TEXT,
    "copingStrategies" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrisisPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "lessonSlug" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SleepLog_userId_idx" ON "SleepLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SleepLog_userId_date_key" ON "SleepLog"("userId", "date");

-- CreateIndex
CREATE INDEX "ExerciseSession_userId_idx" ON "ExerciseSession"("userId");

-- CreateIndex
CREATE INDEX "ExerciseSession_completedAt_idx" ON "ExerciseSession"("completedAt");

-- CreateIndex
CREATE INDEX "DailyRhythm_userId_idx" ON "DailyRhythm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRhythm_userId_date_key" ON "DailyRhythm"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSettings_userId_key" ON "ReminderSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CrisisPlan_userId_key" ON "CrisisPlan"("userId");

-- CreateIndex
CREATE INDEX "CourseProgress_userId_idx" ON "CourseProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseProgress_userId_courseSlug_lessonSlug_key" ON "CourseProgress"("userId", "courseSlug", "lessonSlug");
