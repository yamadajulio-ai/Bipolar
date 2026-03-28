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

    return NextResponse.json(assessments, { headers: { "Cache-Control": "private, no-cache" } });
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

  // Consent gate: require "assessments" scope (or legacy "health_data" for existing users)
  const consent = await prisma.consent.findFirst({
    where: {
      userId: session.userId,
      scope: { in: ["assessments", "health_data"] },
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento para avaliações não concedido. Acesse Privacidade para autorizar." },
      { status: 403 },
    );
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

    // Defense-in-depth: reject sentinel -1 values that bypass Zod min(0) via type coercion
    if (asrmScores?.some((v) => v < 0)) {
      return NextResponse.json(
        { error: "Valores ASRM inválidos: todas as respostas devem ser preenchidas (>= 0)." },
        { status: 400 },
      );
    }
    if (phq9Scores?.some((v) => v < 0)) {
      return NextResponse.json(
        { error: "Valores PHQ-9 inválidos: todas as respostas devem ser preenchidas (>= 0)." },
        { status: 400 },
      );
    }
    if (fastScores && Object.values(fastScores).some((v) => v < 1)) {
      return NextResponse.json(
        { error: "Valores FAST inválidos: todos os domínios devem ser preenchidos (>= 1)." },
        { status: 400 },
      );
    }

    // Require at least one assessment section
    if (!asrmScores && !phq9Scores && !fastScores) {
      return NextResponse.json(
        { error: "Pelo menos uma seção da avaliação deve ser preenchida." },
        { status: 400 },
      );
    }

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
