import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const functioningSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  work: z.number().int().min(1).max(5).optional(),
  social: z.number().int().min(1).max(5).optional(),
  selfcare: z.number().int().min(1).max(5).optional(),
  finances: z.number().int().min(1).max(5).optional(),
  cognition: z.number().int().min(1).max(5).optional(),
  leisure: z.number().int().min(1).max(5).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 52);

  const assessments = await prisma.functioningAssessment.findMany({
    where: { userId: session.userId },
    orderBy: { date: "desc" },
    take: limit,
  });

  return NextResponse.json(assessments);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = functioningSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { date, work, social, selfcare, finances, cognition, leisure } = parsed.data;

  const scores = [work, social, selfcare, finances, cognition, leisure].filter(
    (s): s is number => s !== undefined,
  );
  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  const assessment = await prisma.functioningAssessment.upsert({
    where: { userId_date: { userId: session.userId, date } },
    create: {
      userId: session.userId,
      date,
      work: work ?? null,
      social: social ?? null,
      selfcare: selfcare ?? null,
      finances: finances ?? null,
      cognition: cognition ?? null,
      leisure: leisure ?? null,
      avgScore,
    },
    update: {
      work: work !== undefined ? work : undefined,
      social: social !== undefined ? social : undefined,
      selfcare: selfcare !== undefined ? selfcare : undefined,
      finances: finances !== undefined ? finances : undefined,
      cognition: cognition !== undefined ? cognition : undefined,
      leisure: leisure !== undefined ? leisure : undefined,
      avgScore: avgScore ?? undefined,
    },
  });

  return NextResponse.json(assessment, { status: 201 });
}
