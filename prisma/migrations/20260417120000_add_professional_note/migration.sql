-- CreateTable
CREATE TABLE "ProfessionalNote" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalNote_accessId_createdAt_idx" ON "ProfessionalNote"("accessId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProfessionalNote" ADD CONSTRAINT "ProfessionalNote_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ProfessionalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
