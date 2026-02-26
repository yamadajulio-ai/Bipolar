import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import { TodayBlocks } from "@/components/planner/TodayBlocks";
import { OnboardingBanner } from "@/components/planner/OnboardingBanner";
import Link from "next/link";

export default async function HojePage() {
  const session = await getSession();
  const today = localToday();

  // Fetch today's blocks
  const dayStart = new Date(today + "T00:00:00");
  const dayEnd = new Date(today + "T23:59:59");

  const blocks = await prisma.plannerBlock.findMany({
    where: {
      userId: session.userId,
      OR: [
        // Non-recurring blocks that overlap with today (including overnight from yesterday)
        { startAt: { lte: dayEnd }, endAt: { gte: dayStart } },
        // Recurring blocks that might apply today
        { recurrence: { isNot: null }, startAt: { lte: dayEnd } },
      ],
    },
    include: { recurrence: true, exceptions: true },
    orderBy: { startAt: "asc" },
  });

  // Fetch today's diary entry
  const todayEntry = await prisma.diaryEntry.findFirst({
    where: { userId: session.userId, date: today },
  });

  // Fetch today's sleep log
  const todaySleep = await prisma.sleepLog.findFirst({
    where: { userId: session.userId, date: today },
  });

  // Fetch today's rhythm
  const todayRhythm = await prisma.dailyRhythm.findFirst({
    where: { userId: session.userId, date: today },
  });

  // Get stability rules for energy budget
  const rules = await prisma.stabilityRule.findUnique({
    where: { userId: session.userId },
  });

  // Check if first-run (no blocks and no templates)
  const totalBlocks = await prisma.plannerBlock.count({ where: { userId: session.userId } });
  const totalTemplates = await prisma.plannerTemplate.count({ where: { userId: session.userId } });
  const isFirstRun = totalBlocks === 0 && totalTemplates === 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Serialize blocks for client component
  const serializedBlocks = blocks.map((b) => ({
    ...b,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    recurrence: b.recurrence ? {
      ...b.recurrence,
      createdAt: b.recurrence.createdAt.toISOString(),
      until: b.recurrence.until?.toISOString() || null,
    } : null,
    exceptions: b.exceptions.map((ex) => ({
      ...ex,
      occurrenceDate: ex.occurrenceDate.toISOString(),
      overrideStartAt: ex.overrideStartAt?.toISOString() || null,
      overrideEndAt: ex.overrideEndAt?.toISOString() || null,
      createdAt: ex.createdAt.toISOString(),
    })),
  }));

  // Anchors from DailyRhythm
  const anchors: { label: string; time: string | null }[] = [];
  if (todayRhythm) {
    if (todayRhythm.wakeTime) anchors.push({ label: "Acordar", time: todayRhythm.wakeTime });
    if (todayRhythm.firstContact) anchors.push({ label: "Primeiro contato", time: todayRhythm.firstContact });
    if (todayRhythm.mainActivityStart) anchors.push({ label: "Atividade principal", time: todayRhythm.mainActivityStart });
    if (todayRhythm.dinnerTime) anchors.push({ label: "Jantar", time: todayRhythm.dinnerTime });
    if (todayRhythm.bedtime) anchors.push({ label: "Dormir", time: todayRhythm.bedtime });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{greeting}</h1>

      {/* Onboarding for first-run users */}
      {isFirstRun && <OnboardingBanner />}

      {/* Quick status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Check-in</p>
          <p className="text-lg font-bold">{todayEntry ? `${todayEntry.mood}/5` : "—"}</p>
          {!todayEntry && (
            <Link href="/checkin" className="text-xs text-primary hover:underline">Fazer agora</Link>
          )}
        </Card>
        <Card>
          <p className="text-xs text-muted">Sono</p>
          <p className="text-lg font-bold">{todaySleep ? `${todaySleep.totalHours}h` : "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Energia</p>
          <p className="text-lg font-bold">{todayEntry?.energyLevel ? `${todayEntry.energyLevel}/5` : "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Medicacao</p>
          <p className="text-lg font-bold">
            {todayEntry?.tookMedication === "sim" ? "Sim" : todayEntry?.tookMedication === "nao" ? "Nao" : "—"}
          </p>
        </Card>
      </div>

      {/* Anchors */}
      {anchors.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Ancoras do dia</h2>
          <div className="flex flex-wrap gap-3">
            {anchors.map((a) => (
              <div key={a.label} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-indigo-700">{a.time}</span>
                <span className="ml-1.5 text-indigo-600">{a.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's blocks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Blocos de hoje</h2>
          <Link href="/planejador" className="text-sm text-primary hover:underline">
            Ver semana
          </Link>
        </div>
        <TodayBlocks
          blocks={serializedBlocks}
          today={today}
          targetSleepTimeMin={rules?.targetSleepTimeMin ?? null}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/checkin" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors text-center">
            <p className="font-medium text-foreground">Check-in 30s</p>
          </Card>
        </Link>
        <Link href="/planejador" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors text-center">
            <p className="font-medium text-foreground">Planejador</p>
          </Card>
        </Link>
        <Link href="/exercicios" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors text-center">
            <p className="font-medium text-foreground">Respiracao</p>
          </Card>
        </Link>
        <Link href="/sos" className="block no-underline">
          <Card className="hover:border-red-300 transition-colors text-center border-red-200">
            <p className="font-medium text-red-600">SOS</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
