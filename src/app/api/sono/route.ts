import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
import { bedtimesOverlap, mergeManualIntoWearable } from "@/lib/sleepMerge";
import * as Sentry from "@sentry/nextjs";

const sleepLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  bedtime: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve ser HH:MM"),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve ser HH:MM"),
  totalHours: z.number().min(0).max(24),
  quality: z.number().int().min(0).max(100),
  awakenings: z.number().int().min(0).max(10).optional(),
  hrv: z.number().int().min(1).max(300).optional(),
  heartRate: z.number().int().min(20).max(250).optional(),
  preRoutine: z.string().optional(),
  notes: z.string().max(280).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 60 reads per minute per user
  if (!(await checkRateLimit(`sono_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);

  const logs = await prisma.sleepLog.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      bedtime: true,
      wakeTime: true,
      totalHours: true,
      awakeMinutes: true,
      quality: true,
      awakenings: true,
      hrv: true,
      heartRate: true,
      excluded: true,
      source: true,
      preRoutine: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 30 writes per minute per user
  if (!(await checkRateLimit(`sono_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = sleepLogSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const manualData: Record<string, unknown> = {
      bedtime: parsed.data.bedtime,
      wakeTime: parsed.data.wakeTime,
      totalHours: parsed.data.totalHours,
      quality: parsed.data.quality,
      awakenings: parsed.data.awakenings ?? 0,
      hrv: parsed.data.hrv ?? null,
      heartRate: parsed.data.heartRate ?? null,
      preRoutine: parsed.data.preRoutine || null,
      notes: parsed.data.notes || null,
      source: "manual",
    };

    // Find existing records for this date to check for wearable overlap
    const existing = await prisma.sleepLog.findMany({
      where: { userId: session.userId, date: parsed.data.date },
      select: {
        id: true,
        bedtime: true,
        source: true,
        awakeMinutes: true,
        hrv: true,
        heartRate: true,
      },
    });

    // Find overlapping records (±30min bedtime, different exact bedtime)
    const overlapping = existing.filter((e) =>
      bedtimesOverlap(parsed.data.bedtime, e.bedtime) && e.bedtime !== parsed.data.bedtime,
    );

    // If any overlapping record came from a wearable, preserve its objective data
    const wearableMatch = overlapping.find((e) => e.source !== "manual")
      ?? existing.find((e) => e.bedtime === parsed.data.bedtime && e.source !== "manual");

    let finalData = manualData;
    if (wearableMatch) {
      finalData = mergeManualIntoWearable(manualData, {
        awakeMinutes: wearableMatch.awakeMinutes,
        hrv: wearableMatch.hrv,
        heartRate: wearableMatch.heartRate,
      });
      finalData.source = "manual"; // user intentionally registered
    }

    // Delete near-duplicate records (same night, slightly different bedtime)
    if (overlapping.length > 0) {
      await prisma.sleepLog.deleteMany({
        where: { id: { in: overlapping.map((e) => e.id) } },
      });
    }

    const log = await prisma.sleepLog.upsert({
      where: {
        userId_date_bedtime: {
          userId: session.userId,
          date: parsed.data.date,
          bedtime: parsed.data.bedtime,
        },
      },
      update: finalData as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      create: { userId: session.userId, date: parsed.data.date, ...finalData } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      select: {
        id: true,
        date: true,
        bedtime: true,
        wakeTime: true,
        totalHours: true,
        awakeMinutes: true,
        quality: true,
        awakenings: true,
        hrv: true,
        heartRate: true,
        excluded: true,
        source: true,
        preRoutine: true,
        notes: true,
        createdAt: true,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "sono" } });
    return NextResponse.json(
      { error: "Erro ao salvar registro de sono." },
      { status: 500 },
    );
  }
}
