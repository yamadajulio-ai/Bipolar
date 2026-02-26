import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const lembreteSchema = z.object({
  wakeReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  sleepReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  diaryReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  breathingReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let settings = await prisma.reminderSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings) {
    settings = await prisma.reminderSettings.create({
      data: {
        userId: session.userId,
        enabled: true,
      },
    });
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = lembreteSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const settings = await prisma.reminderSettings.upsert({
      where: { userId: session.userId },
      update: {
        wakeReminder: parsed.data.wakeReminder ?? null,
        sleepReminder: parsed.data.sleepReminder ?? null,
        diaryReminder: parsed.data.diaryReminder ?? null,
        breathingReminder: parsed.data.breathingReminder ?? null,
        enabled: parsed.data.enabled ?? true,
      },
      create: {
        userId: session.userId,
        wakeReminder: parsed.data.wakeReminder ?? null,
        sleepReminder: parsed.data.sleepReminder ?? null,
        diaryReminder: parsed.data.diaryReminder ?? null,
        breathingReminder: parsed.data.breathingReminder ?? null,
        enabled: parsed.data.enabled ?? true,
      },
    });

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 },
    );
  }
}
