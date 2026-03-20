import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const VALID_GOALS = new Set(["sleep", "detect", "consult", "routine", "learn"]);
const VALID_PROFILES = new Set(["recent", "veteran", "caregiver"]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let goal: string | undefined;
  let profile: string | undefined;
  try {
    const body = await request.json();
    if (body.goal && typeof body.goal === "string" && VALID_GOALS.has(body.goal)) {
      goal = body.goal;
    }
    if (body.profile && typeof body.profile === "string" && VALID_PROFILES.has(body.profile)) {
      profile = body.profile;
    }
  } catch {
    // No body or invalid JSON — that's fine, goal/profile are optional
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      onboarded: true,
      ...(goal ? { onboardingGoal: goal } : {}),
      ...(profile ? { onboardingGoal: `${profile}:${goal || "none"}` } : {}),
    },
  });

  session.onboarded = true;
  await session.save();

  return NextResponse.json({ success: true });
}
