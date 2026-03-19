import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { maskIp } from "@/lib/security";
import { verifyPin } from "@/lib/auth";
import * as Sentry from "@sentry/nextjs";
import { computeInsights } from "@/lib/insights/computeInsights";
import type { PlannerBlockInput } from "@/lib/insights/computeInsights";

const TZ = "America/Sao_Paulo";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private, max-age=0",
  "Pragma": "no-cache",
};

function privateJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...PRIVATE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

/** Sanitize x-forwarded-for: take only the first (client) IP, masked to /24. */
function sanitizeIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  const raw = xff ? xff.split(",")[0].trim() : request.headers.get("x-real-ip");
  return maskIp(raw ?? null);
}

// POST: Validate PIN and return patient data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Kill switch: disable professional sharing entirely
  if (process.env.KILL_PROFESSIONAL_SHARING === "true") {
    return privateJson({ error: "Funcionalidade temporariamente desabilitada" }, { status: 503 });
  }

  const { token } = await params;

  try {
    const body = await request.json();
    const pin = String(body.pin || "");

    if (!/^\d{6}$/.test(pin)) {
      return privateJson({ error: "PIN inválido" }, { status: 400 });
    }

    // Initial read (non-transactional) for early exits
    const access = await prisma.professionalAccess.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        pinHash: true,
        revokedAt: true,
        expiresAt: true,
        lockedUntil: true,
        failedPinAttempts: true,
        shareSosEvents: true,
      },
    });

    if (!access || access.revokedAt) {
      return privateJson({ error: "Acesso não encontrado ou revogado" }, { status: 404 });
    }

    if (access.expiresAt < new Date()) {
      return privateJson({ error: "Acesso expirado" }, { status: 410 });
    }

    if (access.lockedUntil && access.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (access.lockedUntil.getTime() - Date.now()) / 60000,
      );
      return privateJson(
        { error: `Acesso bloqueado. Tente novamente em ${minutesLeft} minutos.` },
        { status: 429 },
      );
    }

    // Hash comparison before transaction (CPU-bound, safe to do outside)
    const pinValid = await verifyPin(pin, access.pinHash);
    const ip = sanitizeIp(request);

    // Atomic transaction to prevent race conditions on concurrent PIN attempts
    const result = await prisma.$transaction(async (tx) => {
      // Re-read inside transaction for consistency
      const fresh = await tx.professionalAccess.findUnique({
        where: { token },
        select: {
          id: true,
          userId: true,
          pinHash: true,
          revokedAt: true,
          expiresAt: true,
          lockedUntil: true,
          failedPinAttempts: true,
          shareSosEvents: true,
        },
      });

      if (!fresh || fresh.revokedAt || fresh.expiresAt < new Date()) {
        return { status: 404, error: "Acesso não encontrado ou revogado" } as const;
      }

      if (fresh.lockedUntil && fresh.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil(
          (fresh.lockedUntil.getTime() - Date.now()) / 60000,
        );
        return { status: 429, error: `Acesso bloqueado. Tente novamente em ${minutesLeft} minutos.` } as const;
      }

      if (!pinValid) {
        // Atomic increment — prevents race condition with parallel requests
        const updated = await tx.professionalAccess.update({
          where: { id: fresh.id },
          data: { failedPinAttempts: { increment: 1 } },
          select: { failedPinAttempts: true },
        });
        const attempts = updated.failedPinAttempts;

        if (attempts >= 20) {
          await tx.professionalAccess.update({
            where: { id: fresh.id },
            data: { revokedAt: new Date() },
          });
          await tx.accessLog.create({
            data: { accessId: fresh.id, action: "revoked_too_many_attempts", ip },
          });
          return { status: 403, error: "Acesso revogado por excesso de tentativas. O paciente precisará gerar um novo link." } as const;
        } else if (attempts >= 10) {
          await tx.professionalAccess.update({
            where: { id: fresh.id },
            data: { lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          });
          await tx.accessLog.create({
            data: { accessId: fresh.id, action: "locked_24h", ip },
          });
          return { status: 429, error: "Muitas tentativas incorretas. Acesso bloqueado por 24 horas." } as const;
        } else if (attempts >= 5) {
          await tx.professionalAccess.update({
            where: { id: fresh.id },
            data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
          });
          await tx.accessLog.create({
            data: { accessId: fresh.id, action: "locked", ip },
          });
          return { status: 429, error: "Muitas tentativas incorretas. Acesso bloqueado por 15 minutos." } as const;
        } else {
          await tx.accessLog.create({
            data: { accessId: fresh.id, action: "pin_failed", ip },
          });
          return { status: 401, error: `PIN incorreto. ${5 - attempts} tentativas restantes antes do bloqueio.` } as const;
        }
      }

      // PIN correct — atomic reset
      await tx.professionalAccess.update({
        where: { id: fresh.id },
        data: { lastAccessedAt: new Date(), failedPinAttempts: 0, lockedUntil: null },
      });
      await tx.accessLog.create({
        data: { accessId: fresh.id, action: "pin_validated", ip },
      });

      return { status: 200, accessData: fresh } as const;
    });

    if (result.status !== 200) {
      return privateJson({ error: result.error }, { status: result.status });
    }

    const validAccess = result.accessData;

    // Fetch patient data (last 30 days)
    const now = new Date();
    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });
    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoff90Str = cutoff90.toLocaleDateString("sv-SE", { timeZone: TZ });

    const queries: Promise<unknown>[] = [
      prisma.user.findUnique({
        where: { id: validAccess.userId },
        select: { name: true, createdAt: true },
      }),
      prisma.sleepLog.findMany({
        where: { userId: validAccess.userId, date: { gte: cutoff90Str } },
        select: {
          date: true,
          bedtime: true,
          wakeTime: true,
          totalHours: true,
          quality: true,
          awakenings: true,
          hrv: true,
          heartRate: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.diaryEntry.findMany({
        where: { userId: validAccess.userId, date: { gte: cutoff30Str } },
        select: {
          date: true,
          mood: true,
          sleepHours: true,
          energyLevel: true,
          anxietyLevel: true,
          irritability: true,
          tookMedication: true,
          warningSigns: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.dailyRhythm.findMany({
        where: { userId: validAccess.userId, date: { gte: cutoff30Str } },
        select: {
          date: true,
          wakeTime: true,
          firstContact: true,
          mainActivityStart: true,
          dinnerTime: true,
          bedtime: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.plannerBlock.findMany({
        where: {
          userId: validAccess.userId,
          startAt: { gte: cutoff30 },
          category: { in: ["social", "trabalho", "refeicao"] },
        },
        select: { startAt: true, category: true },
        orderBy: { startAt: "asc" },
      }),
      prisma.crisisPlan.findUnique({
        where: { userId: validAccess.userId },
        select: {
          medications: true,
          professionalName: true,
        },
      }),
      // Only fetch SOS events if patient opted in
      validAccess.shareSosEvents
        ? prisma.sOSEvent.findMany({
            where: { userId: validAccess.userId, createdAt: { gte: cutoff30 } },
            orderBy: { createdAt: "desc" },
            select: { action: true, createdAt: true },
          })
        : Promise.resolve([]),
      // Weekly assessments (last 12 weeks)
      prisma.weeklyAssessment.findMany({
        where: { userId: validAccess.userId },
        select: {
          date: true,
          asrmTotal: true,
          phq9Total: true,
          phq9Item9: true,
          fastAvg: true,
          notes: true,
        },
        orderBy: { date: "desc" },
        take: 12,
      }),
      // Life chart events (last 90 days)
      prisma.lifeChartEvent.findMany({
        where: { userId: validAccess.userId, date: { gte: cutoff90Str } },
        select: {
          date: true,
          eventType: true,
          label: true,
          notes: true,
        },
        orderBy: { date: "desc" },
      }),
      // Functioning assessments (last 12 weeks)
      prisma.functioningAssessment.findMany({
        where: { userId: validAccess.userId },
        select: {
          date: true,
          work: true,
          social: true,
          selfcare: true,
          finances: true,
          cognition: true,
          leisure: true,
          avgScore: true,
        },
        orderBy: { date: "desc" },
        take: 12,
      }),
    ];

    const [user, sleepLogs, entries, rhythms, rawPlannerBlocks, crisisPlan, sosEvents, weeklyAssessments, lifeChartEvents, functioningAssessments] =
      await Promise.all(queries) as [any, any[], any[], any[], any[], any, any[], any[], any[], any[]];

    // Compute insights
    const sleepForInsights = sleepLogs.filter(
      (l) => l.date >= cutoff30Str && l.totalHours >= 1,
    );

    const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks.map((b) => {
      const d = new Date(b.startAt);
      return {
        date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
        timeHHMM: d.toLocaleTimeString("sv-SE", {
          timeZone: TZ,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        category: b.category,
      };
    });

    const insights = computeInsights(
      sleepForInsights,
      entries,
      rhythms,
      plannerBlocks,
      now,
      TZ,
    );

    // Build professional report
    const report = {
      patientName: user?.name ?? "Paciente",
      accountCreatedAt: user?.createdAt,
      generatedAt: now.toISOString(),
      period: { from: cutoff30Str, to: now.toLocaleDateString("sv-SE", { timeZone: TZ }) },
      insights: {
        sleep: insights.sleep,
        mood: insights.mood,
        rhythm: {
          overallRegularity: insights.rhythm.overallRegularity,
          hasEnoughData: insights.rhythm.hasEnoughData,
        },
        thermometer: insights.thermometer,
        risk: insights.risk,
        combinedPatterns: insights.combinedPatterns,
      },
      rawData: {
        entries: entries.map((e) => ({
          date: e.date,
          mood: e.mood,
          energy: e.energyLevel,
          anxiety: e.anxietyLevel,
          irritability: e.irritability,
          medication: e.tookMedication,
          warningSigns: e.warningSigns,
        })),
        sleepLogs: sleepLogs
          .filter((l) => l.date >= cutoff30Str)
          .map((l) => ({
            date: l.date,
            bedtime: l.bedtime,
            wakeTime: l.wakeTime,
            totalHours: l.totalHours,
            quality: l.quality,
            hrv: l.hrv,
            heartRate: l.heartRate,
          })),
      },
      medications: crisisPlan?.medications ?? null,
      sosEvents: sosEvents.map((e) => ({
        action: e.action,
        date: e.createdAt.toISOString(),
      })),
      weeklyAssessments: weeklyAssessments.map((a) => ({
        date: a.date,
        asrmTotal: a.asrmTotal,
        phq9Total: a.phq9Total,
        phq9Item9: a.phq9Item9,
        fastAvg: a.fastAvg,
        notes: a.notes,
      })),
      lifeChartEvents: lifeChartEvents.map((e) => ({
        date: e.date,
        eventType: e.eventType,
        label: e.label,
        notes: e.notes,
      })),
      functioningAssessments: functioningAssessments.map((a) => ({
        date: a.date,
        work: a.work,
        social: a.social,
        selfcare: a.selfcare,
        finances: a.finances,
        cognition: a.cognition,
        leisure: a.leisure,
        avgScore: a.avgScore,
      })),
    };

    return privateJson(report);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "acesso_profissional_token" } });
    return privateJson({ error: "Erro interno" }, { status: 500 });
  }
}
