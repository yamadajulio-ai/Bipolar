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

    const pinValid = await bcrypt.compare(pin, access.pinHash);
    if (!pinValid) {
      return NextResponse.json({ error: "PIN incorreto" }, { status: 401 });
    }

    // Update lastAccessedAt
    await prisma.professionalAccess.update({
      where: { id: access.id },
      data: { lastAccessedAt: new Date() },
    });

    // Fetch patient data (last 30 days)
    const now = new Date();
    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });
    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoff90Str = cutoff90.toLocaleDateString("sv-SE", { timeZone: TZ });

    const [user, sleepLogs, entries, rhythms, rawPlannerBlocks, crisisPlan, sosEvents] =
      await Promise.all([
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
        prisma.sOSEvent.findMany({
          where: { userId: access.userId, createdAt: { gte: cutoff30 } },
          orderBy: { createdAt: "desc" },
          select: { action: true, createdAt: true },
        }),
      ]);

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
