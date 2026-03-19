import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const exerciseSessionSchema = z.object({
  exerciseType: z.string().min(1, "Tipo de exercício é obrigatório"),
  durationSecs: z.number().int().min(1, "Duração deve ser pelo menos 1 segundo"),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`exercicios_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const sessions = await prisma.exerciseSession.findMany({
      where: {
        userId: session.userId,
        completedAt: { gte: cutoff },
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        exerciseType: true,
        durationSecs: true,
        completedAt: true,
      },
    });

    return NextResponse.json(sessions);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "exercicios" } });
    return NextResponse.json(
      { error: "Erro ao buscar sessões de exercício." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`exercicios_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = exerciseSessionSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const exerciseSession = await prisma.exerciseSession.create({
      data: {
        userId: session.userId,
        exerciseType: parsed.data.exerciseType,
        durationSecs: parsed.data.durationSecs,
      },
      select: {
        id: true,
        exerciseType: true,
        durationSecs: true,
        completedAt: true,
      },
    });

    return NextResponse.json(exerciseSession, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "exercicios" } });
    return NextResponse.json(
      { error: "Erro ao salvar sessão de exercício." },
      { status: 500 },
    );
  }
}
