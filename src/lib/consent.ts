import { prisma } from "@/lib/db";

/**
 * Essential consent scopes — cannot be revoked by the user.
 * If a record is missing (pre-onboarding legacy account), auto-create it.
 */
const ESSENTIAL_SCOPES = new Set(["health_data", "journal_data", "terms_of_use"]);

/**
 * Check if a user has an active consent for the given scope.
 * For essential scopes, auto-creates the record if missing (migration path
 * for accounts created before the consent system).
 *
 * Returns true if consent is active, false if revoked or non-essential & missing.
 */
export async function hasConsent(userId: string, scope: string): Promise<boolean> {
  const consent = await prisma.consent.findFirst({
    where: { userId, scope, revokedAt: null },
    select: { id: true },
  });

  if (consent) return true;

  // For essential scopes, check if there's a revoked record first
  if (ESSENTIAL_SCOPES.has(scope)) {
    const revoked = await prisma.consent.findFirst({
      where: { userId, scope },
      select: { id: true, revokedAt: true },
      orderBy: { grantedAt: "desc" },
    });

    if (revoked?.revokedAt) {
      // Essential scope was somehow revoked — should not happen, but respect it
      return false;
    }

    // No record at all — legacy account, auto-create
    // Use try/catch for race condition: concurrent requests may both try to create
    try {
      await prisma.consent.create({
        data: { userId, scope, version: 1, ipAddress: "auto-migration" },
      });
    } catch {
      // Unique constraint violation — another request already created it, that's fine
    }
    return true;
  }

  return false;
}
