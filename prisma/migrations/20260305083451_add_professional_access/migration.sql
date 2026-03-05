-- CreateTable
CREATE TABLE "ProfessionalAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consentGivenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalAccess_token_key" ON "ProfessionalAccess"("token");

-- CreateIndex
CREATE INDEX "ProfessionalAccess_userId_idx" ON "ProfessionalAccess"("userId");

-- CreateIndex
CREATE INDEX "ProfessionalAccess_token_idx" ON "ProfessionalAccess"("token");

-- AddForeignKey
ALTER TABLE "ProfessionalAccess" ADD CONSTRAINT "ProfessionalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
