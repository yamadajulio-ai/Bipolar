import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "asc" },
  });

  // Calculate stats
  const moods = entries.map((e) => e.mood);
  const sleeps = entries.map((e) => e.sleepHours);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0;
  const avgSleep = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : 0;

  // Detect alerts
  const alerts: string[] = [];
  if (entries.length >= 3) {
    const last3 = entries.slice(-3);

    // Sleep decreasing trend
    if (last3.length === 3 && last3[0].sleepHours > last3[1].sleepHours && last3[1].sleepHours > last3[2].sleepHours) {
      alerts.push("Seu sono está diminuindo progressivamente. Alterações no sono podem preceder episódios. Este alerta é automático e não substitui avaliação profissional.");
    }

    // Mood climbing above 4 for 3+ days
    if (last3.every((e) => e.mood >= 4)) {
      alerts.push("Humor elevado persistente detectado. Converse com seu profissional de saúde. Este alerta é automático e não substitui avaliação profissional.");
    }

    // Mood below 2 for 3+ days
    if (last3.every((e) => e.mood <= 2)) {
      alerts.push("Humor baixo persistente. Considere conversar com seu profissional de saúde. Este alerta é automático e não substitui avaliação profissional.");
    }
  }

  // Sleep deprivation
  const last2 = entries.slice(-2);
  if (last2.length >= 2 && last2.every((e) => e.sleepHours < 5)) {
    alerts.push("Privação de sono detectada. Sono insuficiente pode desencadear episódios maníacos. Priorize o descanso. Este alerta é automático e não substitui avaliação profissional.");
  }

  return NextResponse.json({
    entries,
    stats: {
      avgMood: Math.round(avgMood * 10) / 10,
      avgSleep: Math.round(avgSleep * 10) / 10,
      totalEntries: entries.length,
    },
    alerts,
  });
}
