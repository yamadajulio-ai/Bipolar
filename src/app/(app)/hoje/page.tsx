import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { getNews } from "@/lib/news";
import { Card } from "@/components/Card";
import { Greeting } from "@/components/Greeting";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
import { computeDisplayStreak, computeLongestStreak, computeAchievements } from "@/lib/streaks";
import { GamificationWrapper } from "@/components/GamificationWrapper";
import { computeInsights } from "@/lib/insights/computeInsights";
import type { PlannerBlockInput } from "@/lib/insights/computeInsights";
import { StabilityScoreWidget } from "@/components/dashboard/StabilityScoreWidget";
import Link from "next/link";
import Image from "next/image";
import { SOSButton } from "@/components/SOSButton";
import { CoachMarks } from "@/components/dashboard/CoachMarks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SimpleMode } from "@/components/dashboard/SimpleMode";
import { evaluateRisk, buildActions } from "@/lib/risk-v2";
import type { AlertLayer, WeeklyAssessmentInput, MedicationAdherenceInput, SafetyScreeningInput } from "@/lib/risk-v2";
import { AlertCard } from "@/components/today/AlertCard";
import { SafetyModeScreen } from "@/components/today/SafetyModeScreen";
import { HojeSafetyGate } from "@/components/today/HojeSafetyGate";

const TZ = "America/Sao_Paulo";

function formatSleepDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const moodLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito deprimido", color: "text-red-600" },
  2: { text: "Deprimido", color: "text-orange-600" },
  3: { text: "Estável", color: "text-emerald-700" },
  4: { text: "Elevado", color: "text-amber-600" },
  5: { text: "Muito elevado", color: "text-red-600" },
};

const energyLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito baixa", color: "text-red-600" },
  2: { text: "Baixa", color: "text-orange-600" },
  3: { text: "Normal", color: "text-emerald-700" },
  4: { text: "Alta", color: "text-amber-600" },
  5: { text: "Muito alta", color: "text-red-600" },
};

// Zone configuration: colors, labels, CTAs
const ZONE_CONFIG = {
  depressao: {
    bg: "bg-blue-900/10 border-blue-800/30",
    chip: "bg-blue-100 text-blue-900 border border-blue-300",
    label: "Atenção — sinais de depressão",
    icon: "↓",
  },
  depressao_leve: {
    bg: "bg-blue-50 border-blue-200",
    chip: "bg-blue-100 text-blue-800 border border-blue-200",
    label: "Observe — humor mais baixo",
    icon: "↓",
  },
  eutimia: {
    bg: "bg-emerald-50/50 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    label: "Estável",
    icon: "→",
  },
  hipomania: {
    bg: "bg-amber-50 border-amber-200",
    chip: "bg-amber-100 text-amber-800 border border-amber-200",
    label: "Observe — humor elevado",
    icon: "↑",
  },
  mania: {
    bg: "bg-red-50 border-red-300",
    chip: "bg-red-100 text-red-800 border border-red-300",
    label: "Atenção — sinais de mania",
    icon: "↑",
  },
} as const;

const RISK_CONFIG = {
  ok: {
    bg: "bg-emerald-50/50 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    label: "Estável",
  },
  atencao: {
    bg: "bg-amber-50 border-amber-200",
    chip: "bg-amber-100 text-amber-800 border border-amber-200",
    label: "Observe",
  },
  atencao_alta: {
    bg: "bg-red-50 border-red-300",
    chip: "bg-red-100 text-red-800 border border-red-300",
    label: "Atenção",
  },
} as const;

export default async function HojePage({ searchParams }: { searchParams: Promise<{ full?: string }> }) {
  const params = await searchParams;
  const dismissCrisis = params.full === "1";
  const session = await getSession();
  const now = new Date();
  const today = localToday();
  const dayEnd = new Date(today + "T23:59:59");

  // Cutoffs for data fetching
  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff7Str = localDateStr(cutoff7);

  // === Fetch all data in parallel ===
  const [
    todayEntry, todaySleep,
    allEntries30, allSleepLogs30, rawPlannerBlocks30, financialTxs30,
    streakDates, sleepStreakDates,
    upcomingBlocks,
    latestMetrics, recentSleepLogs7,
    googleCal, haeKey, financialTx,
    lastWeeklyAssessment,
    displayPrefs,
    latestSafetyScreen,
    openAlertEpisode,
    activeMedications,
  ] = await Promise.all([
    // Today's data
    prisma.diaryEntry.findFirst({
      where: { userId: session.userId, date: today },
      select: { mood: true, sleepHours: true, energyLevel: true, tookMedication: true, warningSigns: true, snapshotCount: true, moodRange: true, lastSnapshotAt: true },
    }),
    prisma.sleepLog.findFirst({
      where: { userId: session.userId, date: { in: [today, localDateStr(new Date(now.getTime() - 86400000))] } },
      select: { totalHours: true, quality: true, date: true },
      orderBy: { date: "desc" },
    }),
    // 30d data for insights computation
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
      orderBy: { date: "asc" },
    }),
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
      orderBy: { date: "asc" },
    }),
    prisma.plannerBlock.findMany({
      where: { userId: session.userId, startAt: { gte: cutoff30 }, category: { in: ["social", "trabalho", "refeicao"] } },
      select: { startAt: true, category: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.financialTransaction.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
      select: { date: true, amount: true, category: true, description: true },
    }),
    // Streaks
    prisma.diaryEntry.findMany({ where: { userId: session.userId }, orderBy: { date: "desc" }, select: { date: true }, take: 90 }),
    prisma.sleepLog.findMany({ where: { userId: session.userId }, orderBy: { date: "desc" }, select: { date: true }, take: 90 }),
    // Upcoming blocks
    prisma.plannerBlock.findMany({
      where: { userId: session.userId, startAt: { gte: new Date(), lte: dayEnd } },
      select: { title: true, startAt: true },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
    // Health metrics (7d)
    prisma.healthMetric.findMany({
      where: { userId: session.userId, date: { gte: cutoff7Str } },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff7Str }, totalHours: { gte: 1 } },
      orderBy: { date: "desc" },
      take: 7,
      select: { hrv: true, heartRate: true },
    }),
    // Integration status
    prisma.googleAccount.findFirst({ where: { userId: session.userId }, select: { id: true } }),
    prisma.integrationKey.findFirst({ where: { userId: session.userId, service: "health_auto_export", enabled: true }, select: { id: true } }),
    prisma.financialTransaction.findFirst({ where: { userId: session.userId }, select: { id: true } }),
    // Last weekly assessment (for "para fazer" section + risk-v2 scales)
    prisma.weeklyAssessment.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, asrmTotal: true, phq9Total: true, phq9Item9: true },
    }),
    // Display preferences (server-side gamification visibility)
    prisma.displayPreferences.findUnique({ where: { userId: session.userId }, select: { hideStreaks: true, hideAchievements: true } }),
    // Risk v2: latest safety screening
    prisma.safetyScreeningSession.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, sourceAssessmentId: true, asq: true, bssa: true, disposition: true, alertLayer: true, completedAt: true },
    }),
    // Risk v2: open alert episode (for hysteresis)
    prisma.alertEpisode.findFirst({
      where: { userId: session.userId, resolvedAt: null },
      orderBy: { lastTriggeredAt: "desc" },
      select: { id: true, layer: true, lastTriggeredAt: true, minHoldUntil: true, modalCooldownUntil: true, resolvedAt: true },
    }),
    // Risk v2: medication adherence (last 7 days for critical meds)
    prisma.medication.findMany({
      where: { userId: session.userId, isActive: true, isAsNeeded: false },
      select: {
        id: true,
        riskRole: true,
        schedules: {
          where: { effectiveTo: null },
          select: { id: true },
        },
        logs: {
          where: { date: { gte: cutoff7Str } },
          select: { status: true, date: true, scheduleId: true },
        },
      },
    }),
  ]);

  // === Compute Insights (Risk Radar data) ===
  const sleepLogsForInsights = allSleepLogs30.filter(l => l.totalHours >= 1 && !l.excluded);
  const entries30 = allEntries30.filter(e => e.date >= cutoff30Str);

  const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks30.map(b => {
    const d = new Date(b.startAt);
    return {
      date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
      timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
      category: b.category,
    };
  });

  const insights = computeInsights(sleepLogsForInsights, entries30, [], plannerBlocks, now, TZ, allEntries30, allSleepLogs30.filter(l => !l.excluded), financialTxs30);

  const { risk, thermometer, combinedPatterns, sleep: sleepInsights } = insights;

  // === Financial signals detection ===
  const financialDrivers = risk?.factors.filter(f =>
    f.toLowerCase().includes("gasto") || f.toLowerCase().includes("financ")
  ) ?? [];
  const hasFinancialSignal = financialDrivers.length > 0;
  const hasFinancialWithContext = risk?.factors.some(f =>
    f.toLowerCase().includes("gasto atípico + sono") || f.toLowerCase().includes("gasto atípico + energia")
  ) ?? false;

  // === Streaks ===
  const checkinDates = streakDates.map(d => d.date);
  const sleepDatesArr = sleepStreakDates.map(d => d.date);
  const checkinStreak = computeDisplayStreak(checkinDates, today);
  const sleepStreak = computeDisplayStreak(sleepDatesArr, today);
  const bestCheckinStreak = computeLongestStreak([...checkinDates].reverse());
  const bestSleepStreak = computeLongestStreak([...sleepDatesArr].reverse());
  const achievements = computeAchievements({
    checkinStreak, sleepStreak, bestCheckinStreak, bestSleepStreak,
    totalCheckins: checkinDates.length, totalSleepLogs: sleepDatesArr.length,
  });

  // === Determine zone + risk for Risk Radar ===
  const hasEnoughData = (risk !== null && thermometer !== null);
  const zone = thermometer?.zone ?? "eutimia";
  const zoneConfig = ZONE_CONFIG[zone];
  const riskLevel = risk?.level ?? "ok";
  const riskConfig = RISK_CONFIG[riskLevel];

  // Use the higher severity between zone and risk for the hero card
  const severityOrder = { ok: 0, eutimia: 0, depressao_leve: 1, hipomania: 1, atencao: 1, depressao: 2, mania: 2, atencao_alta: 2 };
  const zoneSeverity = severityOrder[zone] ?? 0;
  const riskSeverity = severityOrder[riskLevel] ?? 0;
  const useZone = zoneSeverity >= riskSeverity;
  const heroBg = useZone ? zoneConfig.bg : riskConfig.bg;
  const heroChip = useZone ? zoneConfig.chip : riskConfig.chip;
  const heroLabel = useZone ? zoneConfig.label : riskConfig.label;

  // Collect drivers (max 3)
  const drivers: string[] = [];
  if (risk?.factors) {
    for (const f of risk.factors) {
      if (drivers.length >= 3) break;
      drivers.push(f);
    }
  }
  if (thermometer?.factors && drivers.length < 3) {
    for (const f of thermometer.factors) {
      if (drivers.length >= 3) break;
      if (!drivers.some(d => d.includes(f.slice(0, 15)))) drivers.push(f);
    }
  }

  // Determine primary CTA
  let primaryCta = { href: "/checkin", label: "Fazer check-in", verb: "Registrar humor e energia" };
  if (zone === "mania" || zone === "depressao") {
    primaryCta = { href: "/plano-de-crise", label: "Revisar plano de crise", verb: "Revise seu plano de segurança" };
  } else if (!todayEntry) {
    primaryCta = { href: "/checkin", label: "Fazer check-in", verb: "Registrar humor e energia" };
  } else if ((todayEntry.snapshotCount ?? 0) <= 1) {
    primaryCta = { href: "/checkin", label: "Registrar momento", verb: "Como você está agora?" };
  } else if (!todaySleep && !haeKey) {
    primaryCta = { href: "/sono/novo", label: "Registrar sono", verb: "Como foi a noite passada?" };
  } else {
    primaryCta = { href: "/insights", label: "Ver insights", verb: "Veja seus padrões recentes" };
  }

  // === "Para fazer hoje" tasks ===
  interface Task { label: string; href: string; done: boolean; priority: number }
  const tasks: Task[] = [];

  // Safety first (mania/depression zones still reach here even though atencao_alta goes to crisis mode)
  if (zone === "mania" || zone === "depressao") {
    tasks.push({ label: "Revisar plano de crise", href: "/plano-de-crise", done: false, priority: 0 });
  }

  // Medication
  if (todayEntry?.tookMedication === "nao" || todayEntry?.tookMedication === "nao_sei") {
    tasks.push({ label: "Tomar medicação", href: "/checkin", done: false, priority: 1 });
  } else if (todayEntry?.tookMedication === "sim") {
    tasks.push({ label: "Medicação tomada", href: "/checkin", done: true, priority: 1 });
  }

  // Check-in
  const checkinCount = todayEntry?.snapshotCount ?? 0;
  tasks.push({
    label: checkinCount > 0 ? `Check-ins diários (${checkinCount} feito${checkinCount > 1 ? "s" : ""})` : "Check-ins diários",
    href: "/checkin",
    done: false,
    priority: 2,
  });

  // Sleep
  if (haeKey) {
    tasks.push({ label: "Sono (wearable)", href: "/sono", done: !!todaySleep, priority: 3 });
  } else {
    tasks.push({ label: "Registrar sono", href: "/sono/novo", done: !!todaySleep, priority: 3 });
  }

  // Weekly assessment (due if >7 days since last)
  const weeklyDue = !lastWeeklyAssessment ||
    (now.getTime() - lastWeeklyAssessment.createdAt.getTime()) > 7 * 24 * 60 * 60 * 1000;
  if (weeklyDue) {
    tasks.push({ label: "Avaliação semanal", href: "/avaliacao-semanal", done: false, priority: 4 });
  }

  tasks.sort((a, b) => a.priority - b.priority);
  const visibleTasks = tasks.slice(0, 5);

  // === Health data (7d aggregates) ===
  const avgSteps = (() => {
    const steps = latestMetrics.filter(m => m.metric === "steps");
    if (steps.length === 0) return null;
    return Math.round(steps.reduce((s, m) => s + m.value, 0) / steps.length);
  })();
  const avgHrv = (() => {
    const hrvLogs = recentSleepLogs7.filter(s => s.hrv !== null);
    if (hrvLogs.length === 0) return null;
    return Math.round(hrvLogs.reduce((s, l) => s + (l.hrv || 0), 0) / hrvLogs.length);
  })();
  const avgHr = (() => {
    const hrLogs = recentSleepLogs7.filter(s => s.heartRate !== null);
    if (hrLogs.length === 0) return null;
    return Math.round(hrLogs.reduce((s, l) => s + (l.heartRate || 0), 0) / hrLogs.length);
  })();
  const hasHealthData = avgSteps !== null || avgHrv !== null || avgHr !== null;

  // === Integration checks ===
  const hasGoogleCal = !!googleCal;
  const hasHae = !!haeKey;
  const hasFinancial = !!financialTx;
  const missingIntegrations = [
    !hasHae && { label: "Wearable", href: "/integracoes", bg: "bg-red-50 hover:bg-red-100", textColor: "text-red-700" },
    !hasGoogleCal && { label: "Google Agenda", href: "/planejador", bg: "bg-blue-50 hover:bg-blue-100", textColor: "text-blue-700" },
    !hasFinancial && { label: "Mobills", href: "/financeiro", bg: "bg-green-50 hover:bg-green-100", textColor: "text-green-700" },
  ].filter(Boolean) as { label: string; href: string; bg: string; textColor: string }[];

  // === Chart data (7d) ===
  const chartEntries = allEntries30.filter(e => e.date >= cutoff7Str);
  const chartData = chartEntries.map(e => ({ date: e.date, mood: e.mood, sleepHours: e.sleepHours }));

  // === News ===
  let newsArticles: { title: string; url: string; sourceName: string | null; publishedAt: Date }[] = [];
  try {
    const allNews = await getNews();
    newsArticles = allNews.slice(0, 3);
  } catch { /* silent */ }

  const formatBlockTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

  // === Risk v2: 3-rail alert system ===
  const todayWarningSigns: string[] = (() => {
    const ws = todayEntry?.warningSigns;
    if (!ws) return [];
    try { const p = JSON.parse(ws as string); return Array.isArray(p) ? p : []; } catch { return []; }
  })();

  // Compute medication adherence for critical meds
  const medAdherence: MedicationAdherenceInput[] = activeMedications.map((med) => {
    const totalSchedules = med.schedules.length;
    if (totalSchedules === 0) return { riskRole: med.riskRole, adherence7d: 1, consecutiveMissed: 0 };
    const totalExpected = totalSchedules * 7;
    const takenCount = med.logs.filter((l) => l.status === "TAKEN").length;
    const adherence7d = totalExpected > 0 ? takenCount / totalExpected : 1;
    // Count consecutive missed from most recent
    const sortedLogs = [...med.logs].sort((a, b) => b.date.localeCompare(a.date) || a.scheduleId.localeCompare(b.scheduleId));
    let consecutiveMissed = 0;
    for (const l of sortedLogs) {
      if (l.status === "MISSED") consecutiveMissed++;
      else break;
    }
    return { riskRole: med.riskRole, adherence7d, consecutiveMissed };
  });

  const riskV2 = evaluateRisk({
    userId: session.userId,
    entries: allEntries30.map((e) => ({
      date: e.date,
      mood: e.mood,
      sleepHours: e.sleepHours,
      energyLevel: e.energyLevel,
      anxietyLevel: e.anxietyLevel,
      irritability: e.irritability,
      warningSigns: e.warningSigns as string | null,
      tookMedication: e.tookMedication,
    })),
    sleepLogs: allSleepLogs30.map((s) => ({
      date: s.date,
      totalHours: s.totalHours,
      bedtime: s.bedtime,
      quality: s.quality,
      excluded: s.excluded,
      hrv: s.hrv,
    })),
    financialTxs: financialTxs30.map((t) => ({
      date: t.date,
      amount: Number(t.amount),
      category: t.category,
      description: t.description,
    })),
    latestWeekly: lastWeeklyAssessment ? {
      id: lastWeeklyAssessment.id,
      createdAt: lastWeeklyAssessment.createdAt,
      asrmTotal: lastWeeklyAssessment.asrmTotal,
      phq9Total: lastWeeklyAssessment.phq9Total,
      phq9Item9: lastWeeklyAssessment.phq9Item9,
    } : null,
    medications: medAdherence,
    latestSafetyScreen: latestSafetyScreen ? {
      id: latestSafetyScreen.id,
      sourceAssessmentId: latestSafetyScreen.sourceAssessmentId,
      asq: latestSafetyScreen.asq,
      bssa: latestSafetyScreen.bssa,
      disposition: latestSafetyScreen.disposition,
      alertLayer: latestSafetyScreen.alertLayer,
      completedAt: latestSafetyScreen.completedAt,
    } : null,
    todayWarningSigns,
    now,
    tz: TZ,
    prevEpisode: openAlertEpisode ? {
      layer: openAlertEpisode.layer as AlertLayer,
      lastTriggeredAt: openAlertEpisode.lastTriggeredAt,
      minHoldUntil: openAlertEpisode.minHoldUntil,
      modalCooldownUntil: openAlertEpisode.modalCooldownUntil,
      resolvedAt: openAlertEpisode.resolvedAt,
    } : null,
  });

  const alertLayer = riskV2.alertLayer;
  const alertActions = buildActions(alertLayer, riskV2.rails.safety, riskV2.rails.syndrome, riskV2.rails.prodrome);

  // ── Persist risk snapshot + alert episode ──────────────────────
  try {
      // 1) Save daily snapshot
      await prisma.dailyRiskSnapshot.upsert({
        where: { userId_localDate: { userId: session.userId, localDate: today } },
        create: {
          userId: session.userId,
          localDate: today,
          alertLayer,
          uiMode: riskV2.uiMode,
          safety: JSON.stringify(riskV2.rails.safety),
          syndrome: JSON.stringify(riskV2.rails.syndrome),
          prodrome: JSON.stringify(riskV2.rails.prodrome),
          reasons: JSON.stringify(riskV2.reasons),
        },
        update: {
          alertLayer,
          uiMode: riskV2.uiMode,
          safety: JSON.stringify(riskV2.rails.safety),
          syndrome: JSON.stringify(riskV2.rails.syndrome),
          prodrome: JSON.stringify(riskV2.rails.prodrome),
          reasons: JSON.stringify(riskV2.reasons),
        },
      });

      // 2) Manage alert episode for hysteresis
      if (alertLayer !== "CLEAR") {
        const holdHours = alertLayer === "RED" ? 12 : alertLayer === "ORANGE" ? 72 : 48;
        const minHoldUntil = new Date(now.getTime() + holdHours * 3600000);
        const modalCooldownUntil = new Date(now.getTime() + 24 * 3600000);

        if (openAlertEpisode) {
          // Update existing episode
          await prisma.alertEpisode.update({
            where: { id: openAlertEpisode.id },
            data: {
              layer: alertLayer,
              lastTriggeredAt: now,
              minHoldUntil,
              modalCooldownUntil,
              reasons: JSON.stringify(riskV2.reasons),
            },
          });
        } else {
          // Create new episode
          await prisma.alertEpisode.create({
            data: {
              userId: session.userId,
              layer: alertLayer,
              startedAt: now,
              lastTriggeredAt: now,
              minHoldUntil,
              modalCooldownUntil,
              reasons: JSON.stringify(riskV2.reasons),
            },
          });
        }
      } else if (openAlertEpisode) {
        // Resolve episode when CLEAR
        await prisma.alertEpisode.update({
          where: { id: openAlertEpisode.id },
          data: { resolvedAt: now },
        });
      }
  } catch {
    // Non-blocking — don't fail page render for persistence errors
  }

  // === NEW USER MODE: simplified dashboard for users with < 3 diary entries ===
  const isNewUser = allEntries30.length < 3;

  // === RED: Safety Mode — only for acute safety risk (ASQ/BSSA positive) ===
  if (alertLayer === "RED" && !dismissCrisis) {
    return (
      <div className="space-y-4">
        <Greeting />
        <SafetyModeScreen actions={alertActions} />
      </div>
    );
  }

  // === NEW USER MODE: show simplified dashboard (unless user dismissed with ?full=1) ===
  if (isNewUser && !dismissCrisis) {
    return (
      <div className="space-y-4">
        <Greeting />
        <CoachMarks />

        {/* Welcome card */}
        <Card className="bg-primary/5 border-primary/20">
          <p className="text-lg font-semibold text-foreground mb-1">
            Seu primeiro passo
          </p>
          <p className="text-sm text-muted">
            Bem-vindo ao Suporte Bipolar! Comece registrando como você se sente.
            Com poucos dias de dados, o painel de estabilidade e os insights vão se ativar automaticamente.
          </p>
        </Card>

        {/* Tasks */}
        <Card>
          <h2 className="text-sm font-semibold text-foreground mb-3">Para fazer hoje</h2>
          <div className="space-y-2">
            {visibleTasks.map((t, i) => (
              <Link key={i} href={t.href} className="flex items-center gap-3 no-underline group">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                  t.done ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "border-border text-transparent group-hover:border-primary"
                }`}>
                  {t.done ? "✓" : ""}
                </span>
                <span className={`text-sm ${t.done ? "text-muted line-through" : "text-foreground group-hover:text-primary"}`}>
                  {t.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <SOSButton />

        <Link
          href="/hoje?full=1"
          className="block text-center text-xs text-muted hover:text-foreground transition-colors py-2 no-underline"
        >
          Ver painel completo
        </Link>
      </div>
    );
  }

  // === Simple mode status text ===
  const simpleModeStatus = (() => {
    const parts: string[] = [];
    if (todayEntry) {
      const m = moodLabels[todayEntry.mood];
      if (m) parts.push(`humor ${m.text.toLowerCase()}`);
    }
    if (todaySleep) {
      parts.push(`sono ${formatSleepDuration(todaySleep.totalHours)}`);
    }
    if (parts.length === 0) return "Sem registros ainda hoje. Comece quando quiser.";
    return `Hoje: ${parts.join(", ")}.`;
  })();

  return (
    <SimpleMode statusText={simpleModeStatus}>
    <div className="space-y-4">
      <Greeting />
      <CoachMarks />

      {/* === RISK V2: ORANGE/YELLOW Alert + Safety Interstitial === */}
      {(alertLayer === "ORANGE" || alertLayer === "YELLOW") && (
        <AlertCard
          layer={alertLayer as "ORANGE" | "YELLOW"}
          reasons={riskV2.reasons}
          actions={alertActions}
          safety={riskV2.rails.safety}
          syndrome={riskV2.rails.syndrome}
          prodrome={riskV2.rails.prodrome}
        />
      )}
      {riskV2.rails.safety.pending && (
        <HojeSafetyGate
          source={todayWarningSigns.includes("pensamentos_suicidas") ? "warning_sign" : "phq9_item9"}
          sourceAssessmentId={lastWeeklyAssessment?.id}
        />
      )}

      {/* === 1. RISK RADAR (Hero) === */}
      {hasEnoughData ? (
        <Card className={`${heroBg} border`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${heroChip}`}>
                {heroLabel}
              </span>
              {thermometer?.mixedFeatures && (
                <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Humor e energia em direções opostas
                </span>
              )}
            </div>
            <Link href="/insights" className="text-xs text-primary hover:underline">
              Detalhes
            </Link>
          </div>

          {/* Drivers */}
          {drivers.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {drivers.map((d, i) => {
                const isProtective = d.toLowerCase().includes("protetor") || d.toLowerCase().includes("boa adesão");
                return (
                  <li key={i} className="text-xs flex items-start gap-1.5 text-foreground/80">
                    <span className="mt-0.5 shrink-0">{isProtective ? "✓" : "•"}</span>
                    {d}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Combined patterns */}
          {combinedPatterns.length > 0 && (
            <div className="mb-3 space-y-1">
              {combinedPatterns.slice(0, 2).map((p, i) => (
                <div key={i} className={`text-xs rounded px-2 py-1 ${p.variant === "danger" ? "bg-red-100/60 text-red-800" : p.variant === "warning" ? "bg-amber-100/60 text-amber-800" : "bg-blue-100/60 text-blue-800"}`}>
                  <span className="font-medium">{p.title}:</span> {p.message}
                </div>
              ))}
            </div>
          )}

          {/* Primary CTA */}
          <Link
            href={primaryCta.href}
            className="block w-full text-center rounded-lg py-2.5 text-sm font-semibold no-underline transition-colors bg-primary text-white hover:bg-primary/90"
          >
            {primaryCta.label}
          </Link>
          <p className="mt-1.5 text-[10px] text-center text-muted italic">
            Indicador educacional · Não substitui avaliação profissional
          </p>
        </Card>
      ) : (
        /* Onboarding state: no enough data yet */
        <Card className="bg-primary/5 border-primary/20">
          <p className="text-sm font-semibold text-foreground mb-1">Bem-vindo ao Suporte Bipolar</p>
          <p className="text-xs text-muted mb-3">
            Faça check-ins e registre o sono por 7 dias para ativar seu painel de estabilidade.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, ((entries30.length + sleepLogsForInsights.length) / 14) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted">{entries30.length + sleepLogsForInsights.length}/14</span>
          </div>
        </Card>
      )}

      {/* === SINAIS DE GASTOS (when financial anomaly detected) === */}
      {hasFinancialSignal && hasFinancial && (
        <Card className={`border ${hasFinancialWithContext ? "border-amber-300 bg-amber-50/50" : "border-border bg-surface-alt/50"}`}>
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Sinais de gastos</h2>
            <Link href="/financeiro" className="text-xs text-primary hover:underline">Detalhes</Link>
          </div>
          <div className="space-y-1.5">
            {financialDrivers.map((d, i) => (
              <p key={i} className="text-xs text-foreground/80">
                <span className="mr-1">{hasFinancialWithContext ? "⚠" : "•"}</span>
                {d}
              </p>
            ))}
          </div>
          {hasFinancialWithContext && (
            <p className="mt-2 text-xs text-amber-700">
              Mudanças nos gastos junto com alterações de sono ou energia podem ser um sinal comportamental. Observe e converse com seu profissional se persistir.
            </p>
          )}
          <p className="mt-1.5 text-[10px] text-muted italic">
            Sinal complementar · Não é diagnóstico e pode ter várias explicações
          </p>
        </Card>
      )}

      {/* === 1.5 SCORE DE ESTABILIDADE === */}
      {insights.stability && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Score de Estabilidade</h2>
            <Link href="/insights" className="text-xs text-primary hover:underline">Detalhes</Link>
          </div>
          <ErrorBoundary name="StabilityScoreWidget">
            <StabilityScoreWidget stability={insights.stability} />
          </ErrorBoundary>
          <p className="mt-2 text-[10px] text-muted italic">
            Baseado nos seus últimos 30 dias · Não é diagnóstico
          </p>
        </Card>
      )}

      {/* === 2. PARA FAZER HOJE === */}
      <Card>
        <h2 className="text-sm font-semibold text-foreground mb-3">Para fazer hoje</h2>
        <div className="space-y-2">
          {visibleTasks.map((t, i) => (
            <Link key={i} href={t.href} className="flex items-center gap-3 no-underline group">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                t.done ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "border-border text-transparent group-hover:border-primary"
              }`}>
                {t.done ? "✓" : ""}
              </span>
              <span className={`text-sm ${t.done ? "text-muted line-through" : "text-foreground group-hover:text-primary"}`}>
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      {/* === 3. SEU ESTADO HOJE === */}
      {todayEntry && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground mb-3">Seu estado hoje</h2>
          <div className="grid grid-cols-2 gap-2">
            {/* Humor */}
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide">Humor</p>
              <p className={`text-sm font-semibold mt-0.5 ${moodLabels[todayEntry.mood]?.color || "text-foreground"}`}>
                {moodLabels[todayEntry.mood]?.text || `${todayEntry.mood}/5`}
              </p>
            </div>
            {/* Energia */}
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide">Energia</p>
              <p className={`text-sm font-semibold mt-0.5 ${todayEntry.energyLevel ? (energyLabels[todayEntry.energyLevel]?.color || "text-foreground") : "text-muted"}`}>
                {todayEntry.energyLevel ? energyLabels[todayEntry.energyLevel]?.text || `${todayEntry.energyLevel}/5` : "—"}
              </p>
            </div>
            {/* Sono */}
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide">Sono</p>
              <p className="text-sm font-semibold mt-0.5 text-foreground">
                {todaySleep ? formatSleepDuration(todaySleep.totalHours) : "—"}
              </p>
              {todaySleep && sleepInsights.avgDuration !== null && (
                <p className="text-[10px] text-muted">
                  {todaySleep.totalHours >= sleepInsights.avgDuration
                    ? `+${formatSleepDuration(todaySleep.totalHours - sleepInsights.avgDuration)} vs padrão`
                    : `−${formatSleepDuration(sleepInsights.avgDuration - todaySleep.totalHours)} vs padrão`}
                </p>
              )}
            </div>
            {/* Medicação */}
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[10px] text-muted uppercase tracking-wide">Medicação</p>
              <p className={`text-sm font-semibold mt-0.5 ${
                todayEntry.tookMedication === "sim" ? "text-emerald-700" :
                todayEntry.tookMedication === "nao" ? "text-red-600" : "text-amber-600"
              }`}>
                {todayEntry.tookMedication === "sim" ? "Já tomou" :
                 todayEntry.tookMedication === "nao" ? "Não tomou" : "Ainda não"}
              </p>
            </div>
          </div>
          {/* Snapshot info + register again */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            <p className="text-[10px] text-muted">
              {(todayEntry.snapshotCount ?? 0) > 1
                ? `${todayEntry.snapshotCount} registros hoje${todayEntry.moodRange ? ` (variação: ${todayEntry.moodRange})` : ""}`
                : todayEntry.lastSnapshotAt
                  ? `Registrado às ${new Date(todayEntry.lastSnapshotAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`
                  : "1 registro hoje"}
            </p>
            <a href="/checkin" className="text-[10px] text-primary hover:underline">
              Registrar novamente
            </a>
          </div>
          {/* Streaks + Achievements (server-side preferences) */}
          <GamificationWrapper
            checkinStreak={checkinStreak}
            sleepStreak={sleepStreak}
            bestCheckinStreak={bestCheckinStreak}
            achievements={achievements}
            initialHideStreaks={displayPrefs?.hideStreaks ?? false}
            initialHideAchievements={displayPrefs?.hideAchievements ?? false}
          />
        </Card>
      )}

      {/* === 3.5 DIÁRIO RÁPIDO === */}
      <Link href="/meu-diario" className="block no-underline">
        <Card className="hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
              ✏️
            </span>
            <div>
              <p className="font-medium text-foreground">Meu Diário</p>
              <p className="text-xs text-muted mt-0.5">
                Registre um pensamento ou sentimento
              </p>
            </div>
          </div>
        </Card>
      </Link>

      {/* === 4. PRÓXIMAS ATIVIDADES === */}
      {upcomingBlocks.length > 0 && (
        <Card>
          {upcomingBlocks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-foreground">Próximas atividades</h2>
                <Link href="/planejador" className="text-xs text-primary hover:underline">Agenda</Link>
              </div>
              <div className="space-y-1.5">
                {upcomingBlocks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-medium text-muted w-12">{formatBlockTime(b.startAt)}</span>
                    <span className="text-foreground">{b.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* === 5. DADOS DO CORPO (compact) === */}
      {hasHealthData && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Corpo (7 dias)</h2>
            <Link href="/integracoes" className="text-xs text-primary hover:underline">Config</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {avgSteps !== null && (
              <div className="rounded-lg bg-blue-50/70 p-2">
                <p className="text-base font-semibold text-blue-700">{avgSteps.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-blue-600">Passos/dia</p>
              </div>
            )}
            {avgHrv !== null && (
              <div className="rounded-lg bg-purple-50/70 p-2">
                <p className="text-base font-semibold text-purple-700">{avgHrv} ms</p>
                <p className="text-[10px] text-purple-600">HRV</p>
              </div>
            )}
            {avgHr !== null && (
              <div className="rounded-lg bg-red-50/70 p-2">
                <p className="text-base font-semibold text-red-700">{avgHr} bpm</p>
                <p className="text-[10px] text-red-600">FC repouso</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* === 6. GRÁFICO 7 DIAS === */}
      {chartData.length >= 2 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Últimos 7 dias</h2>
            <Link href="/insights" className="text-xs text-primary hover:underline">Insights</Link>
          </div>
          <ErrorBoundary name="DashboardChartWrapper">
            <DashboardChartWrapper data={chartData} />
          </ErrorBoundary>
        </Card>
      )}

      {/* === 7. INTEGRAÇÕES PENDENTES (below fold) === */}
      {missingIntegrations.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground mb-2">Ativar integrações</h2>
          <p className="text-xs text-muted mb-2">Dados automáticos melhoram seus insights.</p>
          <div className="flex gap-2">
            {missingIntegrations.map(ig => (
              <Link key={ig.label} href={ig.href} className={`flex-1 flex flex-col items-center gap-1 rounded-lg ${ig.bg} p-2.5 no-underline transition-colors`}>
                {ig.label === "Wearable" && (
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.18 0-.36-.02-.53-.06.018-.18.04-.36.04-.55 0-1.12.535-2.22 1.235-3.02C13.666 1.66 14.98 1 16.12 1c.18 0 .36.01.53.02-.01.14-.01.28-.01.41h-.274zm3.44 5.89c-.16.09-2.61 1.53-2.585 4.56.03 3.6 3.14 4.8 3.17 4.81-.02.08-.5 1.7-1.63 3.36-.98 1.45-2 2.9-3.6 2.93-1.57.03-2.08-.94-3.88-.94s-2.39.91-3.87.97c-1.55.06-2.73-1.57-3.72-3.01C1.6 17.18.27 12.84 2.44 9.73c1.07-1.54 2.99-2.52 5.07-2.55 1.52-.03 2.95 1.03 3.88 1.03.93 0 2.67-1.27 4.5-1.08.77.03 2.92.31 4.3 2.33-.11.07-2.56 1.51-2.54 4.49l-.36-.18z" /></svg>
                )}
                {ig.label === "Google Agenda" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                )}
                {ig.label === "Mobills" && (
                  <Image src="/mobills-logo.png" alt="Mobills" width={20} height={20} className="object-contain" />
                )}
                <span className={`text-[10px] font-medium ${ig.textColor}`}>{ig.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* === 8. NOTÍCIAS (bottom) === */}
      {newsArticles.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Notícias</h2>
            <Link href="/noticias" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {newsArticles.map(article => (
              <a key={article.url} href={article.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg bg-surface-alt p-2.5 no-underline hover:bg-primary/5 transition-colors">
                <p className="text-xs font-medium text-foreground line-clamp-2">{article.title}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {article.sourceName || "PubMed"} · {article.publishedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </a>
            ))}
          </div>
        </Card>
      )}

      <SOSButton />
    </div>
    </SimpleMode>
  );
}
