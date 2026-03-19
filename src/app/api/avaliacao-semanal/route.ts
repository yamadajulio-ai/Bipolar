import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const assessmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  asrmScores: z.array(z.number().int().min(0).max(4)).length(5).optional(),
  phq9Scores: z.array(z.number().int().min(0).max(3)).length(9).optional(),
  fastScores: z
    .object({
      work: z.number().int().min(1).max(5),
      social: z.number().int().min(1).max(5),
      selfcare: z.number().int().min(1).max(5),
      finances: z.number().int().min(1).max(5),
      cognition: z.number().int().min(1).max(5),
      leisure: z.number().int().min(1).max(5),
    })
    .optional(),
  notes: z.string().max(280).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`avaliacao_read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 52);

    const assessments = await prisma.weeklyAssessment.findMany({
      where: { userId: session.userId },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        asrmScores: true,
        asrmTotal: true,
        phq9Scores: true,
        phq9Total: true,
        phq9Item9: true,
        fastScores: true,
        fastAvg: true,
        notes: true,
        createdAt: true,
      },
    });

    return NextResponse.json(assessments);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "avaliacao" } });
    return NextResponse.json(
      { error: "Erro ao buscar avaliações." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`avaliacao_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = assessmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { date, asrmScores, phq9Scores, fastScores, notes } = parsed.data;

    const asrmTotal = asrmScores ? asrmScores.reduce((a, b) => a + b, 0) : null;
    const phq9Total = phq9Scores ? phq9Scores.reduce((a, b) => a + b, 0) : null;
    const phq9Item9 = phq9Scores ? phq9Scores[8] : null;
    const fastAvg = fastScores
      ? Math.round(
          ((fastScores.work +
            fastScores.social +
            fastScores.selfcare +
            fastScores.finances +
            fastScores.cognition +
            fastScores.leisure) /
            6) *
            10,
        ) / 10
      : null;

    const assessment = await prisma.weeklyAssessment.upsert({
      where: { userId_date: { userId: session.userId, date } },
      create: {
        userId: session.userId,
        date,
        asrmScores: asrmScores ? JSON.stringify(asrmScores) : null,
        asrmTotal,
        phq9Scores: phq9Scores ? JSON.stringify(phq9Scores) : null,
        phq9Total,
        phq9Item9,
        fastScores: fastScores ? JSON.stringify(fastScores) : null,
        fastAvg,
        notes: notes || null,
      },
      update: {
        asrmScores: asrmScores ? JSON.stringify(asrmScores) : undefined,
        asrmTotal: asrmTotal ?? undefined,
        phq9Scores: phq9Scores ? JSON.stringify(phq9Scores) : undefined,
        phq9Total: phq9Total ?? undefined,
        phq9Item9: phq9Item9 ?? undefined,
        fastScores: fastScores ? JSON.stringify(fastScores) : undefined,
        fastAvg: fastAvg ?? undefined,
        notes: notes !== undefined ? notes || null : undefined,
      },
      select: {
        id: true,
        date: true,
        asrmScores: true,
        asrmTotal: true,
        phq9Scores: true,
        phq9Total: true,
        phq9Item9: true,
        fastScores: true,
        fastAvg: true,
        notes: true,
        createdAt: true,
      },
    });

    // Safety flow: if PHQ-9 item 9 >= 1, return safety flag
    const safetyFlag = phq9Item9 !== null && phq9Item9 >= 1;

    return NextResponse.json({ assessment, safetyFlag }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "avaliacao" } });
    return NextResponse.json(
      { error: "Erro ao salvar avaliação." },
      { status: 500 },
    );
  }
}
