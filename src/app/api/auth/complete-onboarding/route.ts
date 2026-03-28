import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maskIp, checkRateLimit, getClientIp } from "@/lib/security";

const VALID_GOALS = new Set(["sleep", "detect", "consult", "routine", "learn"]);
const VALID_PROFILES = new Set(["recent", "veteran", "caregiver"]);
const VALID_CONSENT_SCOPES = new Set([
  "health_data", "terms_of_use", "push_notifications",
  "email_notifications", "whatsapp", "professional_sharing", "ai_narrative",
  "assessments", "crisis_plan", "sos_chatbot", "clinical_export",
]);
const CONSENT_VERSION = 1;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`onboarding:${session.userId}`, 15, 3_600_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  let goal: string | undefined;
  let profile: string | undefined;
  let ageGate = false;
  let consentScopes: string[] = [];
  try {
    const body = await request.json();
    if (body.goal && typeof body.goal === "string" && VALID_GOALS.has(body.goal)) {
      goal = body.goal;
    }
    if (body.profile && typeof body.profile === "string" && VALID_PROFILES.has(body.profile)) {
      profile = body.profile;
    }
    if (body.ageGate === true) {
      ageGate = true;
    }
    if (Array.isArray(body.consents)) {
      consentScopes = body.consents.filter(
        (s: unknown) => typeof s === "string" && VALID_CONSENT_SCOPES.has(s),
      );
    }
  } catch {
    // No body or invalid JSON — that's fine, goal/profile are optional
  }

  // Age gate is required — reject if not confirmed
  if (!ageGate) {
    return NextResponse.json({ error: "Confirmação de idade obrigatória" }, { status: 400 });
  }

  const onboardingGoal = profile
    ? `${profile}:${goal || "none"}`
    : goal || undefined;

  try {
    const rawIp = getClientIp(request);
    const maskedIp = maskIp(rawIp);

    // Use transaction to atomically update user + create consents
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.userId },
        data: {
          onboarded: true,
          ...(onboardingGoal ? { onboardingGoal } : {}),
        },
      });

      // Create consent records for each accepted scope
      if (consentScopes.length > 0) {
        await tx.consent.createMany({
          data: consentScopes.map((scope) => ({
            userId: session.userId,
            scope,
            version: CONSENT_VERSION,
            ipAddress: maskedIp,
          })),
          skipDuplicates: true,
        });
      }
    });

    session.onboarded = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "complete-onboarding" } });
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
