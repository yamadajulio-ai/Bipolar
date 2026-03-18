import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let goal: string | undefined;
  try {
    const body = await request.json();
    if (body.goal && typeof body.goal === "string") {
      goal = body.goal;
    }
  } catch {
    // No body or invalid JSON — that's fine, goal is optional
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { onboarded: true, ...(goal ? { onboardingGoal: goal } : {}) },
  });

  session.onboarded = true;
  await session.save();

  return NextResponse.json({ success: true });
}
