-- CreateTable
CREATE TABLE "SocioeconomicProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "careAccess" TEXT NOT NULL,
    "medicationSource" TEXT NOT NULL,
    "consultFrequency" TEXT NOT NULL,
    "hasEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "livingSituation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocioeconomicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocioeconomicProfile_userId_key" ON "SocioeconomicProfile"("userId");

-- AddForeignKey
ALTER TABLE "SocioeconomicProfile" ADD CONSTRAINT "SocioeconomicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
