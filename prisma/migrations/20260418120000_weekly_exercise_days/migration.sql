-- Add self-reported weekly exercise days to WeeklyAssessment
-- Clinical rationale: physical activity is a well-documented mood regulator in bipolar.
-- WHO recommends ≥5 days of ≥30min moderate exercise per week (150min/week total).
-- Self-report captures users without wearable + gives weekly aggregate aligned with WHO cadence.
ALTER TABLE "WeeklyAssessment" ADD COLUMN "exerciseDaysPerWeek" INTEGER;
