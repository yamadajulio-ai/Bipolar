import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const progressSchema = z.object({
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const progress = await prisma.courseProgress.findMany({
    where: { userId: session.userId },
    orderBy: { completedAt: "desc" },
  });

  return NextResponse.json(progress);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = progressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { courseSlug, lessonSlug } = parsed.data;

    await prisma.courseProgress.upsert({
      where: {
        userId_courseSlug_lessonSlug: {
          userId: session.userId,
          courseSlug,
          lessonSlug,
        },
      },
      create: {
        userId: session.userId,
        courseSlug,
        lessonSlug,
      },
      update: {
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar progresso" }, { status: 500 });
  }
}
