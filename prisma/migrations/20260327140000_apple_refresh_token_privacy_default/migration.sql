-- AlterTable: Add Apple refresh token for SIWA account deletion compliance
ALTER TABLE "User" ADD COLUMN "appleRefreshToken" TEXT;

-- AlterTable: Change privacyMode default to true (App Store compliance — lock screen safety)
ALTER TABLE "ReminderSettings" ALTER COLUMN "privacyMode" SET DEFAULT true;
