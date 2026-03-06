-- CreateTable
CREATE TABLE "WeeklyAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "asrmScores" TEXT,
    "asrmTotal" INTEGER,
    "phq9Scores" TEXT,
    "phq9Total" INTEGER,
    "phq9Item9" INTEGER,
    "fastScores" TEXT,
    "fastAvg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeChartEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifeChartEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctioningAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "work" INTEGER,
    "social" INTEGER,
    "selfcare" INTEGER,
    "finances" INTEGER,
    "cognition" INTEGER,
    "leisure" INTEGER,
    "avgScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctioningAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyAssessment_userId_idx" ON "WeeklyAssessment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAssessment_userId_date_key" ON "WeeklyAssessment"("userId", "date");

-- CreateIndex
CREATE INDEX "LifeChartEvent_userId_date_idx" ON "LifeChartEvent"("userId", "date");

-- CreateIndex
CREATE INDEX "FunctioningAssessment_userId_idx" ON "FunctioningAssessment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FunctioningAssessment_userId_date_key" ON "FunctioningAssessment"("userId", "date");

-- AddForeignKey
ALTER TABLE "WeeklyAssessment" ADD CONSTRAINT "WeeklyAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifeChartEvent" ADD CONSTRAINT "LifeChartEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctioningAssessment" ADD CONSTRAINT "FunctioningAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
