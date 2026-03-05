import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { computeInsights } from "@/lib/insights/computeInsights";
import type { PlannerBlockInput } from "@/lib/insights/computeInsights";

const TZ = "America/Sao_Paulo";

// POST: Validate PIN and return patient data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const body = await request.json();
    const pin = String(body.pin || "");

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
    }

    const access = await prisma.professionalAccess.findUnique({
      where: { token },
    });

    if (!access || access.revokedAt) {
      return NextResponse.json({ error: "Acesso não encontrado ou revogado" }, { status: 404 });
    }

    if (access.expiresAt < new Date()) {
      return NextResponse.json({ error: "Acesso expirado" }, { status: 410 });
    }

    // Rate limiting: check if locked
    if (access.lockedUntil && access.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (access.lockedUntil.getTime() - Date.now()) / 60000,
      );
      return NextResponse.json(
        { error: `Acesso bloqueado. Tente novamente em ${minutesLeft} minutos.` },
        { status: 429 },
      );
    }

    const pinValid = await bcrypt.compare(pin, access.pinHash);
    if (!pinValid) {
      const newAttempts = access.failedPinAttempts + 1;
      const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;

      if (newAttempts >= 20) {
        // 20+ failures → revoke access entirely
        await prisma.professionalAccess.update({
          where: { id: access.id },
          data: { failedPinAttempts: newAttempts, revokedAt: new Date() },
        });
        await prisma.accessLog.create({
          data: { accessId: access.id, action: "revoked_too_many_attempts", ip },
        });
        return NextResponse.json(
          { error: "Acesso revogado por excesso de tentativas. O paciente precisará gerar um novo link." },
          { status: 403 },
        );
      } else if (newAttempts >= 10) {
        // 10-19 failures → lock for 24 hours
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.professionalAccess.update({
          where: { id: access.id },
          data: { failedPinAttempts: newAttempts, lockedUntil: lockUntil },
        });
        await prisma.accessLog.create({
          data: { accessId: access.id, action: "locked_24h", ip },
        });
        return NextResponse.json(
          { error: "Muitas tentativas incorretas. Acesso bloqueado por 24 horas." },
          { status: 429 },
        );
      } else if (newAttempts >= 5) {
        // 5-9 failures → lock for 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await prisma.professionalAccess.update({
          where: { id: access.id },
          data: { failedPinAttempts: newAttempts, lockedUntil: lockUntil },
        });
        await prisma.accessLog.create({
          data: { accessId: access.id, action: "locked", ip },
        });
        return NextResponse.json(
          { error: "Muitas tentativas incorretas. Acesso bloqueado por 15 minutos." },
          { status: 429 },
        );
      } else {
        await prisma.professionalAccess.update({
          where: { id: access.id },
          data: { failedPinAttempts: newAttempts },
        });
        await prisma.accessLog.create({
          data: { accessId: access.id, action: "pin_failed", ip },
        });
        return NextResponse.json(
          { error: `PIN incorreto. ${5 - newAttempts} tentativas restantes antes do bloqueio.` },
          { status: 401 },
        );
      }
    }

    // PIN correct — reset failed attempts and log access
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
    await Promise.all([
      prisma.professionalAccess.update({
        where: { id: access.id },
        data: { lastAccessedAt: new Date(), failedPinAttempts: 0, lockedUntil: null },
      }),
      prisma.accessLog.create({
        data: { accessId: access.id, action: "pin_validated", ip },
      }),
    ]);

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
        where: { id: access.userId },
        select: { name: true, createdAt: true },
      }),
      prisma.sleepLog.findMany({
        where: { userId: access.userId, date: { gte: cutoff90Str } },
        orderBy: { date: "asc" },
      }),
      prisma.diaryEntry.findMany({
        where: { userId: access.userId, date: { gte: cutoff30Str } },
        orderBy: { date: "asc" },
      }),
      prisma.dailyRhythm.findMany({
        where: { userId: access.userId, date: { gte: cutoff30Str } },
        orderBy: { date: "asc" },
      }),
      prisma.plannerBlock.findMany({
        where: {
          userId: access.userId,
          startAt: { gte: cutoff30 },
          category: { in: ["social", "trabalho", "refeicao"] },
        },
        select: { startAt: true, category: true },
        orderBy: { startAt: "asc" },
      }),
      prisma.crisisPlan.findUnique({
        where: { userId: access.userId },
        select: {
          medications: true,
          professionalName: true,
        },
      }),
      // Only fetch SOS events if patient opted in
      access.shareSosEvents
        ? prisma.sOSEvent.findMany({
            where: { userId: access.userId, createdAt: { gte: cutoff30 } },
            orderBy: { createdAt: "desc" },
            select: { action: true, createdAt: true },
          })
        : Promise.resolve([]),
    ];

    const [user, sleepLogs, entries, rhythms, rawPlannerBlocks, crisisPlan, sosEvents] =
      await Promise.all(queries) as [any, any[], any[], any[], any[], any, any[]];

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
    };

    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
