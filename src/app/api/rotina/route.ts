import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const rhythmSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  firstContact: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  mainActivityStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dinnerTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  bedtime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(280).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const entries = await prisma.dailyRhythm.findMany({
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
    const parsed = rhythmSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const entry = await prisma.dailyRhythm.upsert({
      where: {
        userId_date: {
          userId: session.userId,
          date: parsed.data.date,
        },
      },
      update: {
        wakeTime: parsed.data.wakeTime ?? null,
        firstContact: parsed.data.firstContact ?? null,
        mainActivityStart: parsed.data.mainActivityStart ?? null,
        dinnerTime: parsed.data.dinnerTime ?? null,
        bedtime: parsed.data.bedtime ?? null,
        notes: parsed.data.notes ?? null,
      },
      create: {
        userId: session.userId,
        date: parsed.data.date,
        wakeTime: parsed.data.wakeTime ?? null,
        firstContact: parsed.data.firstContact ?? null,
        mainActivityStart: parsed.data.mainActivityStart ?? null,
        dinnerTime: parsed.data.dinnerTime ?? null,
        bedtime: parsed.data.bedtime ?? null,
        notes: parsed.data.notes ?? null,
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
