-- CreateTable
CREATE TABLE "SOSEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOSEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SOSEvent_userId_createdAt_idx" ON "SOSEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SOSEvent" ADD CONSTRAINT "SOSEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
