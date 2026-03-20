import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { normalizePhone } from "@/lib/whatsapp";
import * as Sentry from "@sentry/nextjs";

const lembreteSchema = z.object({
  wakeReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  sleepReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  diaryReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  breathingReminder: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  enabled: z.boolean().optional(),
  privacyMode: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  whatsappPhone: z.string().max(20).optional().nullable(),
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

    // Fetch WhatsApp state from CommunicationPreference + User.whatsappPhone
    const [commPref, user] = await Promise.all([
      prisma.communicationPreference.findUnique({
        where: { userId: session.userId },
        select: { whatsapp: true },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { whatsappPhone: true },
      }),
    ]);

    return NextResponse.json({
      ...settings,
      whatsappEnabled: commPref?.whatsapp ?? false,
      whatsappPhone: user?.whatsappPhone ?? "",
    });
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

    // Normalize WhatsApp phone if provided
    let normalizedPhone: string | null = null;
    if (parsed.data.whatsappPhone) {
      normalizedPhone = normalizePhone(parsed.data.whatsappPhone);
      if (!normalizedPhone) {
        return NextResponse.json(
          { errors: { whatsappPhone: ["Número de telefone inválido."] } },
          { status: 400 },
        );
      }
    }

    const whatsappEnabled = parsed.data.whatsappEnabled ?? false;

    // Persist reminder settings + WhatsApp state atomically
    const [settings] = await prisma.$transaction([
      prisma.reminderSettings.upsert({
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
      }),
      // Persist WhatsApp phone on User
      prisma.user.update({
        where: { id: session.userId },
        data: { whatsappPhone: normalizedPhone },
        select: { id: true },
      }),
      // Persist WhatsApp communication preference
      prisma.communicationPreference.upsert({
        where: { userId: session.userId },
        update: { whatsapp: whatsappEnabled },
        create: { userId: session.userId, whatsapp: whatsappEnabled },
        select: { id: true },
      }),
      // Auto-manage consent: revoke on disable (grant handled below outside transaction)
      ...(!whatsappEnabled
        ? [prisma.consent.updateMany({
            where: { userId: session.userId, scope: "whatsapp", revokedAt: null },
            data: { revokedAt: new Date() },
          })]
        : []),
    ]);

    // Grant consent if enabling WhatsApp (idempotent: skip if already active)
    if (whatsappEnabled) {
      const existing = await prisma.consent.findFirst({
        where: { userId: session.userId, scope: "whatsapp", revokedAt: null },
        select: { id: true },
      });
      if (!existing) {
        await prisma.consent.create({
          data: { userId: session.userId, scope: "whatsapp" },
        });
      }
    }

    return NextResponse.json({
      ...settings,
      whatsappEnabled,
      whatsappPhone: normalizedPhone ?? "",
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "lembretes" } });
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 },
    );
  }
}
