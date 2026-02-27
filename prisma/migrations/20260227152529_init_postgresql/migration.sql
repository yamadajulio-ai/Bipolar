-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "sleepHours" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "energyLevel" INTEGER,
    "anxietyLevel" INTEGER,
    "irritability" INTEGER,
    "tookMedication" TEXT,
    "warningSigns" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bedtime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "quality" INTEGER NOT NULL,
    "awakenings" INTEGER NOT NULL DEFAULT 0,
    "preRoutine" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "durationSecs" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRhythm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "wakeTime" TEXT,
    "firstContact" TEXT,
    "mainActivityStart" TEXT,
    "dinnerTime" TEXT,
    "bedtime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRhythm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wakeReminder" TEXT,
    "sleepReminder" TEXT,
    "diaryReminder" TEXT,
    "breathingReminder" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrisisPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trustedContacts" TEXT,
    "professionalName" TEXT,
    "professionalPhone" TEXT,
    "medications" TEXT,
    "preferredHospital" TEXT,
    "copingStrategies" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrisisPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "lessonSlug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FLEX',
    "isRoutine" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "energyCost" INTEGER NOT NULL DEFAULT 3,
    "stimulation" INTEGER NOT NULL DEFAULT 1,
    "googleEventId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerRecurrence" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "freq" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekDays" TEXT,
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerException" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "overrideStartAt" TIMESTAMP(3),
    "overrideEndAt" TIMESTAMP(3),
    "overrideTitle" TEXT,
    "overrideNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilityRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lateEventCutoffMin" INTEGER NOT NULL DEFAULT 1260,
    "windDownMin" INTEGER NOT NULL DEFAULT 90,
    "minBufferBeforeSleep" INTEGER NOT NULL DEFAULT 60,
    "maxLateNightsPerWeek" INTEGER NOT NULL DEFAULT 2,
    "protectAnchors" BOOLEAN NOT NULL DEFAULT true,
    "targetSleepTimeMin" INTEGER,
    "targetWakeTimeMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerTemplateBlock" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "PlannerTemplateBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "syncToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "account" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_idx" ON "DiaryEntry"("userId");

-- CreateIndex
CREATE INDEX "DiaryEntry_date_idx" ON "DiaryEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_userId_date_key" ON "DiaryEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "ContentView_userId_idx" ON "ContentView"("userId");

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

-- CreateIndex
CREATE INDEX "PlannerTemplate_userId_idx" ON "PlannerTemplate"("userId");

-- CreateIndex
CREATE INDEX "PlannerTemplateBlock_templateId_idx" ON "PlannerTemplateBlock"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationKey_apiKey_key" ON "IntegrationKey"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationKey_userId_service_key" ON "IntegrationKey"("userId", "service");

-- CreateIndex
CREATE INDEX "FinancialTransaction_userId_date_idx" ON "FinancialTransaction"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_userId_date_description_amount_key" ON "FinancialTransaction"("userId", "date", "description", "amount");

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentView" ADD CONSTRAINT "ContentView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepLog" ADD CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSession" ADD CONSTRAINT "ExerciseSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRhythm" ADD CONSTRAINT "DailyRhythm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSettings" ADD CONSTRAINT "ReminderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrisisPlan" ADD CONSTRAINT "CrisisPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerBlock" ADD CONSTRAINT "PlannerBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerRecurrence" ADD CONSTRAINT "PlannerRecurrence_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlannerBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerException" ADD CONSTRAINT "PlannerException_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlannerBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilityRule" ADD CONSTRAINT "StabilityRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTemplate" ADD CONSTRAINT "PlannerTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTemplateBlock" ADD CONSTRAINT "PlannerTemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlannerTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationKey" ADD CONSTRAINT "IntegrationKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
