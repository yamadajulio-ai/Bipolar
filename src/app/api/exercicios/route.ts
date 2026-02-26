import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const exerciseSessionSchema = z.object({
  exerciseType: z.string().min(1, "Tipo de exercicio e obrigatorio"),
  durationSecs: z.number().int().min(1, "Duracao deve ser pelo menos 1 segundo"),
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

  const sessions = await prisma.exerciseSession.findMany({
    where: {
      userId: session.userId,
      completedAt: { gte: cutoff },
    },
    orderBy: { completedAt: "desc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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
    });

    return NextResponse.json(exerciseSession, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar sessao de exercicio." },
      { status: 500 },
    );
  }
}
