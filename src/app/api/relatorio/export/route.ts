import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

/**
 * Clinical Export Package — structured data export for professional consultations.
 *
 * Returns a JSON bundle with:
 * - Period summary (30 or 90 days)
 * - Sleep patterns (averages, variability, trend)
 * - Mood patterns (trend, amplitude, medication adherence)
 * - Weekly assessments (ASRM, PHQ-9, FAST)
 * - Life events
 * - Cognitive tests summary
 * - Stability score snapshot
 *
 * No raw journal entries or free-text notes — LGPD data minimization.
 * Designed to be printed or shared with professionals.
 */

const TZ = "America/Sao_Paulo";

function spDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Consent gate: require "clinical_export" scope (or legacy "health_data" for existing users)
  const consent = await prisma.consent.findFirst({
    where: {
      userId: session.userId,
      scope: { in: ["clinical_export", "health_data"] },
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento para exportação não concedido. Acesse Privacidade para autorizar." },
      { status: 403 },
    );
  }

  const allowed = await checkRateLimit(`export:${session.userId}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas exportações recentes. Tente novamente em breve." },
      { status: 429 },
    );
  }

  try {
    const userId = session.userId;
    const now = new Date();
    const periodParam = request.nextUrl.searchParams.get("period");
    const days = periodParam === "90" ? 90 : 30;

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = spDate(cutoff);

    // Fetch data in parallel — minimal selects per LGPD
    const [sleepLogs, entries, assessments, lifeEvents, cognitiveTests, user] = await Promise.all([
      prisma.sleepLog.findMany({
        where: { userId, date: { gte: cutoffStr }, excluded: false },
        select: { date: true, bedtime: true, wakeTime: true, totalHours: true, quality: true, source: true },
        orderBy: { date: "asc" },
        take: 500,
      }),
      prisma.diaryEntry.findMany({
        where: { userId, date: { gte: cutoffStr } },
        select: { date: true, mood: true, energyLevel: true, anxietyLevel: true, irritability: true, tookMedication: true },
        orderBy: { date: "asc" },
        take: 500,
      }),
      prisma.weeklyAssessment.findMany({
        where: { userId, date: { gte: cutoffStr } },
        select: { date: true, asrmTotal: true, phq9Total: true, phq9Item9: true, fastAvg: true },
        orderBy: { date: "asc" },
        take: 20,
      }),
      prisma.lifeChartEvent.findMany({
        where: { userId, date: { gte: cutoffStr } },
        select: { date: true, eventType: true },
        orderBy: { date: "asc" },
        take: 100,
      }),
      prisma.cognitiveTest.findMany({
        where: { userId, createdAt: { gte: cutoff } },
        select: { reactionTimeMs: true, digitSpan: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, createdAt: true },
      }),
    ]);

    // Compute sleep summary
    const sleepHours = sleepLogs.map((s) => s.totalHours).filter((h): h is number => h != null);
    const sleepQualities = sleepLogs.map((s) => s.quality).filter((q): q is number => q != null);
    const sleepSummary = {
      totalNights: sleepLogs.length,
      avgHours: sleepHours.length > 0 ? +(sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length).toFixed(1) : null,
      avgQuality: sleepQualities.length > 0 ? +(sleepQualities.reduce((a, b) => a + b, 0) / sleepQualities.length).toFixed(1) : null,
    };

    // Compute mood summary
    const moods = entries.map((e) => e.mood).filter((m): m is number => m != null);
    const energies = entries.map((e) => e.energyLevel).filter((e): e is number => e != null);
    const medDays = entries.filter((e) => e.tookMedication === "sim").length;
    const moodSummary = {
      totalEntries: entries.length,
      avgMood: moods.length > 0 ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null,
      avgEnergy: energies.length > 0 ? +(energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1) : null,
      medicationAdherence: entries.length > 0 ? +((medDays / entries.length) * 100).toFixed(0) : null,
    };

    // Cognitive summary
    const reactionTimes = cognitiveTests.map((t) => t.reactionTimeMs).filter((v): v is number => v != null);
    const digitSpans = cognitiveTests.map((t) => t.digitSpan).filter((v): v is number => v != null);
    const cognitiveSummary = {
      totalTests: cognitiveTests.length,
      avgReactionMs: reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) : null,
      avgDigitSpan: digitSpans.length > 0 ? +(digitSpans.reduce((a, b) => a + b, 0) / digitSpans.length).toFixed(1) : null,
    };

    const exportData = {
      exportVersion: "1.0",
      generatedAt: now.toISOString(),
      period: {
        days,
        start: cutoffStr,
        end: spDate(now),
      },
      patient: {
        name: user?.name || "Não informado",
        memberSince: user?.createdAt?.toISOString().slice(0, 10) || null,
      },
      sleep: {
        summary: sleepSummary,
        dailyLog: sleepLogs.map((s) => ({
          date: s.date,
          bedtime: s.bedtime,
          wakeTime: s.wakeTime,
          hours: s.totalHours,
          quality: s.quality,
        })),
      },
      mood: {
        summary: moodSummary,
        dailyLog: entries.map((e) => ({
          date: e.date,
          mood: e.mood,
          energy: e.energyLevel,
          anxiety: e.anxietyLevel,
          irritability: e.irritability,
          medication: e.tookMedication,
        })),
      },
      assessments: assessments.map((a) => ({
        date: a.date,
        asrm: a.asrmTotal,
        phq9: a.phq9Total,
        phq9Item9: a.phq9Item9,
        fast: a.fastAvg,
      })),
      lifeEvents: lifeEvents.map((e) => ({
        date: e.date,
        type: e.eventType,
      })),
      cognitive: cognitiveSummary,
      disclaimer: "Este relatório é gerado automaticamente pelo Suporte Bipolar e não substitui avaliação profissional. Os dados refletem auto-relatos do paciente.",
    };

    return NextResponse.json(exportData, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="suporte-bipolar-export-${cutoffStr}-${spDate(now)}.json"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "clinical-export" } });
    console.error("Clinical export error:", err);
    return NextResponse.json({ error: "Erro ao gerar exportação" }, { status: 500 });
  }
}
