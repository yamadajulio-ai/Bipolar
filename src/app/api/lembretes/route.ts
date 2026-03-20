import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const lembreteSchema = z.object({
  wakeReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  sleepReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  diaryReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  breathingReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  enabled: z.boolean().optional(),
  privacyMode: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`lembretes_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const reminderSelect = {
      id: true, wakeReminder: true, sleepReminder: true,
      diaryReminder: true, breathingReminder: true,
      enabled: true, privacyMode: true,
    } as const;

    let settings = await prisma.reminderSettings.findUnique({
      where: { userId: session.userId },
      select: reminderSelect,
    });

    if (!settings) {
      settings = await prisma.reminderSettings.create({
        data: {
          userId: session.userId,
          enabled: true,
        },
        select: reminderSelect,
      });
    }

    return NextResponse.json(settings);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "lembretes" } });
    return NextResponse.json(
      { error: "Erro ao buscar configurações." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`lembretes_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
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
        privacyMode: parsed.data.privacyMode ?? false,
      },
      create: {
        userId: session.userId,
        wakeReminder: parsed.data.wakeReminder ?? null,
        sleepReminder: parsed.data.sleepReminder ?? null,
        diaryReminder: parsed.data.diaryReminder ?? null,
        breathingReminder: parsed.data.breathingReminder ?? null,
        enabled: parsed.data.enabled ?? true,
        privacyMode: parsed.data.privacyMode ?? false,
      },
      select: {
        id: true, wakeReminder: true, sleepReminder: true,
        diaryReminder: true, breathingReminder: true,
        enabled: true, privacyMode: true,
      },
    });

    return NextResponse.json(settings);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "lembretes" } });
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 },
    );
  }
}
