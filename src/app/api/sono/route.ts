import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
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

    const data = {
      bedtime: parsed.data.bedtime,
      wakeTime: parsed.data.wakeTime,
      totalHours: parsed.data.totalHours,
      quality: parsed.data.quality,
      awakenings: parsed.data.awakenings ?? 0,
      hrv: parsed.data.hrv ?? null,
      heartRate: parsed.data.heartRate ?? null,
      preRoutine: parsed.data.preRoutine || null,
      notes: parsed.data.notes || null,
    };

    const log = await prisma.sleepLog.upsert({
      where: {
        userId_date: {
          userId: session.userId,
          date: parsed.data.date,
        },
      },
      update: data,
      create: { userId: session.userId, date: parsed.data.date, ...data },
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
