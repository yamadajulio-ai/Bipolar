-- Remove old app-created planner blocks (only Google Calendar blocks remain)
DELETE FROM "PlannerBlock" WHERE "sourceType" = 'app';

-- Drop template tables (feature removed)
DROP TABLE IF EXISTS "PlannerTemplateBlock";
DROP TABLE IF EXISTS "PlannerTemplate";
