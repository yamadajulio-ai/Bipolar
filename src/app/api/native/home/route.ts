import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNativeAuth } from "@/lib/native-auth";
import { checkRateLimit } from "@/lib/security";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { computeDisplayStreak } from "@/lib/streaks";
import { evaluateRisk, buildActions } from "@/lib/risk-v2";
import type { AlertLayer, MedicationAdherenceInput } from "@/lib/risk-v2";
import { computeInsights } from "@/lib/insights/computeInsights";
import type { PlannerBlockInput } from "@/lib/insights/computeInsights";

/** Feature flag: set to true to re-enable financeiro in v1.1 */
const SHOW_FINANCEIRO = false;
import { aggregateSleepByDay } from "@/lib/insights/stats";
import * as Sentry from "@sentry/nextjs";

const TZ = "America/Sao_Paulo";

/**
 * GET /api/native/home
 *
 * Aggregated BFF endpoint for the native /hoje screen.
 * Returns only clinically central data for first paint:
 * - Today's state (mood, sleep, meds)
 * - Risk assessment (3-rail)
 * - Mood thermometer zone
 * - Tasks ("para fazer")
 * - Streaks
 * - Quick actions
 *
 * Excludes: news, financial details, content, heavy insights charts.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getNativeAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Rate limit: 60 reads per minute per user (heavy endpoint, ~15 queries)
    const allowed = await checkRateLimit(`native-home:${auth.userId}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { userId } = auth;
    const now = new Date();
    const today = localToday();
    const dayStartUtc = new Date(today + "T00:00:00-03:00");
    const dayEnd = new Date(today + "T23:59:59.999-03:00");

    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

    const cutoff7 = new Date(now);
    cutoff7.setDate(cutoff7.getDate() - 7);
    const cutoff7Str = localDateStr(cutoff7);

    // === Fetch all data in parallel ===
    const [
      todayEntry,
      todaySleep,
      allEntries30,
      allSleepLogs30,
      rawPlannerBlocks30,
      financialTxs30,
      streakDates,
      sleepStreakDates,
      todayBlocks,
      lastWeeklyAssessment,
      latestSafetyScreen,
      openAlertEpisode,
      activeMedications,
      haeKey,
      user,
    ] = await Promise.all([
      prisma.diaryEntry.findFirst({
        where: { userId, date: today },
        select: { mood: true, sleepHours: true, energyLevel: true, tookMedication: true, warningSigns: true, snapshotCount: true, moodRange: true, lastSnapshotAt: true },
      }),
      prisma.sleepLog.findFirst({
        where: { userId, date: { in: [today, localDateStr(new Date(now.getTime() - 86400000))] } },
        select: { totalHours: true, quality: true, date: true },
        orderBy: { date: "desc" },
      }),
      prisma.diaryEntry.findMany({
        where: { userId, date: { gte: cutoff30Str } },
        select: {
          date: true, mood: true, sleepHours: true, energyLevel: true,
          anxietyLevel: true, irritability: true, tookMedication: true,
          warningSigns: true, snapshotCount: true, moodRange: true,
          moodInstability: true, anxietyPeak: true, irritabilityPeak: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.sleepLog.findMany({
        where: { userId, date: { gte: cutoff30Str } },
        select: {
          date: true, totalHours: true, bedtime: true, wakeTime: true,
          quality: true, awakenings: true, excluded: true, hrv: true, heartRate: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.plannerBlock.findMany({
        where: { userId, startAt: { gte: cutoff30 }, category: { in: ["social", "trabalho", "refeicao"] } },
        select: { startAt: true, category: true },
        orderBy: { startAt: "asc" },
      }),
      SHOW_FINANCEIRO ? prisma.financialTransaction.findMany({
        where: { userId, date: { gte: cutoff30Str } },
        select: { date: true, amount: true, category: true, description: true },
      }) : Promise.resolve([]),
      prisma.diaryEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, select: { date: true }, take: 90 }),
      prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: "desc" }, select: { date: true }, take: 90 }),
      prisma.plannerBlock.findMany({
        where: { userId, startAt: { gte: dayStartUtc, lte: dayEnd } },
        select: { title: true, startAt: true },
        orderBy: { startAt: "asc" },
      }),
      prisma.weeklyAssessment.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, asrmTotal: true, phq9Total: true, phq9Item9: true },
      }),
      prisma.safetyScreeningSession.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, sourceAssessmentId: true, asq: true, bssa: true, disposition: true, alertLayer: true, completedAt: true },
      }),
      prisma.alertEpisode.findFirst({
        where: { userId, resolvedAt: null },
        orderBy: { lastTriggeredAt: "desc" },
        select: { id: true, layer: true, startedAt: true, lastTriggeredAt: true, minHoldUntil: true, modalCooldownUntil: true, resolvedAt: true },
      }),
      prisma.medication.findMany({
        where: { userId, isActive: true, isAsNeeded: false },
        select: {
          id: true,
          name: true,
          riskRole: true,
          schedules: {
            where: { effectiveTo: null },
            select: { id: true, timeLocal: true },
          },
          logs: {
            where: { date: { gte: cutoff7Str } },
            select: { status: true, date: true, scheduleId: true },
          },
        },
      }),
      prisma.integrationKey.findFirst({ where: { userId, service: "health_auto_export", enabled: true }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, onboarded: true } }),
    ]);

    // === Medication status ===
    const todayMedExpected = activeMedications.reduce((sum, med) => sum + med.schedules.length, 0);
    const todayMedLogs = activeMedications.flatMap((med) => med.logs.filter((l) => l.date === today));
    const todayMedTaken = todayMedLogs.filter((l) => l.status === "TAKEN").length;
    const todayMedMissed = todayMedLogs.filter((l) => l.status === "MISSED").length;
    const todayMedPending = todayMedExpected - todayMedTaken - todayMedMissed;

    // === Insights (for thermometer + risk radar) ===
    const sleepLogsForInsights = aggregateSleepByDay(allSleepLogs30.filter(l => l.totalHours >= 2 && !l.excluded));
    const entries30 = allEntries30.filter(e => e.date >= cutoff30Str);
    const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks30.map(b => {
      const d = new Date(b.startAt);
      return {
        date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
        timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
        category: b.category,
      };
    });

    const insights = computeInsights(sleepLogsForInsights, entries30, [], plannerBlocks, now, TZ, allEntries30, allSleepLogs30.filter(l => !l.excluded), SHOW_FINANCEIRO ? financialTxs30 : []);
    const { risk, thermometer } = insights;

    // === Streaks ===
    const checkinDates = streakDates.map(d => d.date);
    const sleepDatesArr = sleepStreakDates.map(d => d.date);
    const checkinStreak = computeDisplayStreak(checkinDates, today);
    const sleepStreak = computeDisplayStreak(sleepDatesArr, today);

    // === Risk v2: 3-rail alert system ===
    const todayWarningSigns: string[] = (() => {
      const ws = todayEntry?.warningSigns;
      if (!ws) return [];
      try { const p = JSON.parse(ws as string); return Array.isArray(p) ? p : []; } catch { return []; }
    })();

    const medAdherence: MedicationAdherenceInput[] = activeMedications.map((med) => {
      const totalSchedules = med.schedules.length;
      if (totalSchedules === 0) return { riskRole: med.riskRole, adherence7d: 1, consecutiveMissed: 0 };
      const totalExpected = totalSchedules * 7;
      const takenCount = med.logs.filter((l) => l.status === "TAKEN").length;
      const adherence7d = totalExpected > 0 ? takenCount / totalExpected : 1;
      const sortedLogs = [...med.logs].sort((a, b) => b.date.localeCompare(a.date) || a.scheduleId.localeCompare(b.scheduleId));
      let consecutiveMissed = 0;
      for (const l of sortedLogs) {
        if (l.status === "MISSED") consecutiveMissed++;
        else break;
      }
      return { riskRole: med.riskRole, adherence7d, consecutiveMissed };
    });

    const riskV2 = evaluateRisk({
      userId,
      entries: allEntries30.map((e) => ({
        date: e.date, mood: e.mood, sleepHours: e.sleepHours, energyLevel: e.energyLevel,
        anxietyLevel: e.anxietyLevel, irritability: e.irritability,
        warningSigns: e.warningSigns as string | null, tookMedication: e.tookMedication,
      })),
      sleepLogs: allSleepLogs30.map((s) => ({
        date: s.date, totalHours: s.totalHours, bedtime: s.bedtime,
        quality: s.quality, excluded: s.excluded, hrv: s.hrv,
      })),
      financialTxs: SHOW_FINANCEIRO ? financialTxs30.map((t) => ({
        date: t.date, amount: Number(t.amount), category: t.category, description: t.description,
      })) : [],
      latestWeekly: lastWeeklyAssessment ? {
        id: lastWeeklyAssessment.id, createdAt: lastWeeklyAssessment.createdAt,
        asrmTotal: lastWeeklyAssessment.asrmTotal, phq9Total: lastWeeklyAssessment.phq9Total,
        phq9Item9: lastWeeklyAssessment.phq9Item9,
      } : null,
      medications: medAdherence,
      latestSafetyScreen: latestSafetyScreen ? {
        id: latestSafetyScreen.id, sourceAssessmentId: latestSafetyScreen.sourceAssessmentId,
        asq: latestSafetyScreen.asq, bssa: latestSafetyScreen.bssa,
        disposition: latestSafetyScreen.disposition, alertLayer: latestSafetyScreen.alertLayer,
        completedAt: latestSafetyScreen.completedAt,
      } : null,
      todayWarningSigns,
      now,
      tz: TZ,
      prevEpisode: openAlertEpisode ? {
        layer: openAlertEpisode.layer as AlertLayer, startedAt: openAlertEpisode.startedAt,
        lastTriggeredAt: openAlertEpisode.lastTriggeredAt, minHoldUntil: openAlertEpisode.minHoldUntil,
        modalCooldownUntil: openAlertEpisode.modalCooldownUntil, resolvedAt: openAlertEpisode.resolvedAt,
      } : null,
    });

    const alertLayer = riskV2.alertLayer;
    const alertActions = buildActions(alertLayer, riskV2.rails.safety, riskV2.rails.syndrome, riskV2.rails.prodrome);

    // === Tasks ("para fazer") ===
    interface Task { label: string; route: string; done: boolean }
    const tasks: Task[] = [];

    const zone = thermometer?.zone ?? "eutimia";
    if (zone === "mania" || zone === "depressao") {
      tasks.push({ label: "Revisar plano de crise", route: "/plano-de-crise", done: false });
    }

    if (todayMedExpected > 0) {
      if (todayMedTaken === todayMedExpected) {
        tasks.push({ label: "Medicação tomada", route: "/checkin", done: true });
      } else {
        tasks.push({ label: `Medicação: ${todayMedTaken} de ${todayMedExpected}`, route: "/checkin", done: false });
      }
    }

    const checkinCount = todayEntry?.snapshotCount ?? 0;
    tasks.push({
      label: checkinCount > 0 ? `Check-ins (${checkinCount})` : "Fazer check-in",
      route: "/checkin",
      done: false,
    });

    tasks.push({
      label: haeKey ? "Sono (wearable)" : "Registrar sono",
      route: haeKey ? "/sono" : "/sono/novo",
      done: !!todaySleep,
    });

    const weeklyDue = !lastWeeklyAssessment ||
      (now.getTime() - lastWeeklyAssessment.createdAt.getTime()) > 7 * 24 * 60 * 60 * 1000;
    if (weeklyDue) {
      tasks.push({ label: "Avaliação semanal", route: "/avaliacao-semanal", done: false });
    }

    // === Today's schedule ===
    const schedule = todayBlocks.map(b => ({
      title: b.title,
      time: b.startAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }),
    }));

    // === Medications list for dose tracking ===
    const medications = activeMedications.map(med => ({
      id: med.id,
      name: med.name,
      schedules: med.schedules.map(s => ({
        id: s.id,
        time: s.timeLocal,
        status: med.logs.find(l => l.date === today && l.scheduleId === s.id)?.status ?? "PENDING",
      })),
    }));

    // Guard: if user was deleted between auth check and data fetch
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // === Response ===
    return NextResponse.json({
      generatedAt: now.toISOString(),
      staleAfter: new Date(now.getTime() + 5 * 60 * 1000).toISOString(), // 5min
      schemaVersion: 1,

      user: {
        name: user.name ?? null,
        onboarded: user.onboarded,
      },

      today: {
        date: today,
        mood: todayEntry ? {
          value: todayEntry.mood,
          energy: todayEntry.energyLevel,
          snapshotCount: todayEntry.snapshotCount ?? 0,
          lastSnapshotAt: todayEntry.lastSnapshotAt?.toISOString() ?? null,
        } : null,
        sleep: todaySleep ? {
          totalHours: todaySleep.totalHours,
          quality: todaySleep.quality,
        } : null,
        medication: {
          expected: todayMedExpected,
          taken: todayMedTaken,
          missed: todayMedMissed,
          pending: todayMedPending,
        },
      },

      zone: {
        current: zone,
        factors: thermometer?.factors ?? [],
      },

      risk: {
        level: risk?.level ?? "ok",
        factors: risk?.factors ?? [],
      },

      alertLayer,
      alertActions,

      streaks: {
        checkin: checkinStreak,
        sleep: sleepStreak,
      },

      tasks,
      schedule,
      medications,
    }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-home" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
