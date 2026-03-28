import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const progressSchema = z.object({
  courseSlug: z.string().min(1).max(200),
  lessonSlug: z.string().min(1).max(200),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`cursos_progresso_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const progress = await prisma.courseProgress.findMany({
      where: { userId: session.userId },
      orderBy: { completedAt: "desc" },
      select: { id: true, courseSlug: true, lessonSlug: true, completedAt: true },
    });

    return NextResponse.json(progress);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "cursos_progresso" } });
    return NextResponse.json(
      { error: "Erro ao buscar progresso." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`cursos_progresso_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
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
      select: { id: true },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "cursos_progresso" } });
    return NextResponse.json({ error: "Erro ao salvar progresso" }, { status: 500 });
  }
}
