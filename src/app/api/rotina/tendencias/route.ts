import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { localDateStr } from "@/lib/dateUtils";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function computeStats(values: number[]): { avg: string; stdDev: number; regularity: number } {
  if (values.length === 0) {
    return { avg: "--:--", stdDev: 0, regularity: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const variance =
    values.length > 1
      ? values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      : 0;
  const stdDev = Math.sqrt(variance);

  // Regularity: 100% if stdDev <= 30min, 0% if stdDev >= 180min (3h)
  const minStd = 30;
  const maxStd = 180;
  let regularity: number;
  if (stdDev <= minStd) {
    regularity = 100;
  } else if (stdDev >= maxStd) {
    regularity = 0;
  } else {
    regularity = Math.round(100 * (1 - (stdDev - minStd) / (maxStd - minStd)));
  }

  return {
    avg: minutesToTime(mean),
    stdDev: Math.round(stdDev),
    regularity,
  };
}

const anchorKeys = [
  "wakeTime",
  "firstContact",
  "mainActivityStart",
  "dinnerTime",
  "bedtime",
] as const;

type AnchorKey = (typeof anchorKeys)[number];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const limited = await checkRateLimit(`rotina_tendencias_read:${session.userId}`, 60, 60_000);
  if (limited) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);

  const entries = await prisma.dailyRhythm.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      wakeTime: true,
      firstContact: true,
      mainActivityStart: true,
      dinnerTime: true,
      bedtime: true,
    },
  });

  const anchors: Record<string, { avg: string; stdDev: number; regularity: number }> = {};
  const regularities: number[] = [];

  for (const key of anchorKeys) {
    const values: number[] = [];
    for (const entry of entries) {
      const val = entry[key as AnchorKey];
      if (val) {
        values.push(timeToMinutes(val));
      }
    }
    const stats = computeStats(values);
    anchors[key] = stats;
    if (values.length > 0) {
      regularities.push(stats.regularity);
    }
  }

  const overallRegularity =
    regularities.length > 0
      ? Math.round(regularities.reduce((a, b) => a + b, 0) / regularities.length)
      : 0;

  return NextResponse.json({
    anchors,
    overallRegularity,
    entries,
  });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "rotina_tendencias" } });
    return NextResponse.json({ error: "Erro ao buscar tendências" }, { status: 500 });
  }
}
