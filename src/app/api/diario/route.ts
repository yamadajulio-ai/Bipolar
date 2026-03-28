import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
import * as Sentry from "@sentry/nextjs";

const diarioSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  mood: z.number().int().min(1).max(5),
  sleepHours: z.number().min(0).max(24),
  note: z.string().max(280).optional(),
  energyLevel: z.number().int().min(1).max(5).optional(),
  anxietyLevel: z.number().int().min(1).max(5).optional(),
  irritability: z.number().int().min(1).max(5).optional(),
  tookMedication: z.enum(["sim", "nao", "nao_sei"]).optional(),
  warningSigns: z.string().max(2000).optional(), // JSON array
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 60 reads per minute per user
  if (!(await checkRateLimit(`diario_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      mood: true,
      sleepHours: true,
      note: true,
      energyLevel: true,
      anxietyLevel: true,
      irritability: true,
      tookMedication: true,
      warningSigns: true,
      mode: true,
      snapshotCount: true,
      firstSnapshotAt: true,
      lastSnapshotAt: true,
      moodRange: true,
      moodInstability: true,
      anxietyPeak: true,
      irritabilityPeak: true,
      createdAt: true,
    },
  });

  return NextResponse.json(entries, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 30 writes per minute per user
  if (!(await checkRateLimit(`diario_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  // Consent gate: require "health_data" scope (LGPD Art. 11)
  const consent = await prisma.consent.findFirst({
    where: { userId: session.userId, scope: "health_data", revokedAt: null },
    select: { id: true },
  });
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento para dados de saúde não concedido. Acesse Privacidade para autorizar." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = diarioSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const entry = await prisma.diaryEntry.upsert({
      where: {
        userId_date: {
          userId: session.userId,
          date: parsed.data.date,
        },
      },
      update: {
        mood: parsed.data.mood,
        sleepHours: parsed.data.sleepHours,
        note: parsed.data.note || null,
        energyLevel: parsed.data.energyLevel ?? null,
        anxietyLevel: parsed.data.anxietyLevel ?? null,
        irritability: parsed.data.irritability ?? null,
        tookMedication: parsed.data.tookMedication ?? null,
        warningSigns: parsed.data.warningSigns ?? null,
      },
      create: {
        userId: session.userId,
        date: parsed.data.date,
        mood: parsed.data.mood,
        sleepHours: parsed.data.sleepHours,
        note: parsed.data.note || null,
        energyLevel: parsed.data.energyLevel ?? null,
        anxietyLevel: parsed.data.anxietyLevel ?? null,
        irritability: parsed.data.irritability ?? null,
        tookMedication: parsed.data.tookMedication ?? null,
        warningSigns: parsed.data.warningSigns ?? null,
        mode: "LEGACY_SINGLE",
      },
      select: {
        id: true,
        date: true,
        mood: true,
        sleepHours: true,
        note: true,
        energyLevel: true,
        anxietyLevel: true,
        irritability: true,
        tookMedication: true,
        warningSigns: true,
        createdAt: true,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "diario" } });
    return NextResponse.json(
      { error: "Erro ao salvar registro." },
      { status: 500 },
    );
  }
}
