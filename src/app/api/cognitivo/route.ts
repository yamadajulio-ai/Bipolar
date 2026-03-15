import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const cognitiveTestSchema = z.object({
  reactionTimeMs: z.number().int().min(50).max(5000).nullable(),
  digitSpan: z.number().int().min(0).max(20).nullable(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "90", 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const tests = await prisma.cognitiveTest.findMany({
    where: {
      userId: session.userId,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json(tests);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = cognitiveTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    if (parsed.data.reactionTimeMs === null && parsed.data.digitSpan === null) {
      return NextResponse.json({ error: "Pelo menos um teste deve ser preenchido" }, { status: 400 });
    }

    const test = await prisma.cognitiveTest.create({
      data: {
        userId: session.userId,
        reactionTimeMs: parsed.data.reactionTimeMs,
        digitSpan: parsed.data.digitSpan,
      },
    });

    return NextResponse.json(test, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar teste cognitivo." },
      { status: 500 },
    );
  }
}
