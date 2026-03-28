import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

// GET — Return current display preferences (auto-create if missing)
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`display-pref-read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const prefs = await prisma.displayPreferences.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId },
      update: {},
      select: { hideStreaks: true, hideAchievements: true },
    });

    return NextResponse.json(prefs);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "display-preferences" } });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// PUT — Update display preferences
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`display-pref-write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  let body: { hideStreaks?: boolean; hideAchievements?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: { hideStreaks?: boolean; hideAchievements?: boolean } = {};
  if (typeof body.hideStreaks === "boolean") data.hideStreaks = body.hideStreaks;
  if (typeof body.hideAchievements === "boolean") data.hideAchievements = body.hideAchievements;

  try {
    const prefs = await prisma.displayPreferences.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, ...data },
      update: data,
      select: { hideStreaks: true, hideAchievements: true },
    });

    return NextResponse.json(prefs);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "display-preferences" } });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
