import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { localDateStr } from "@/lib/dateUtils";

const diarioSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  mood: z.number().int().min(1).max(5),
  sleepHours: z.number().min(0).max(24),
  note: z.string().max(280).optional(),
  energyLevel: z.number().int().min(1).max(5).optional(),
  anxietyLevel: z.number().int().min(1).max(5).optional(),
  irritability: z.number().int().min(1).max(5).optional(),
  tookMedication: z.enum(["sim", "nao", "nao_sei"]).optional(),
  warningSigns: z.string().optional(), // JSON array
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar registro." },
      { status: 500 },
    );
  }
}
