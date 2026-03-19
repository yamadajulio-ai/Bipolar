import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

/**
 * GET /api/journal/reflection — Generate a deterministic weekly reflection
 * from the user's journal entries + check-in data. No AI, no external calls.
 * Pure data-driven summary using the user's own words.
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`journal_reflect:${session.userId}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  // Fetch last 7 days of journal entries + check-ins
  const [journals, checkins] = await Promise.all([
    prisma.journalEntry.findMany({
      where: {
        userId: session.userId,
        entryDateLocal: { gte: weekAgoStr },
      },
      orderBy: { createdAt: "asc" },
      select: {
        type: true,
        content: true,
        zoneAtCapture: true,
        mixedAtCapture: true,
        snapshotSource: true,
        entryDateLocal: true,
        createdAt: true,
      },
    }),
    prisma.diaryEntry.findMany({
      where: {
        userId: session.userId,
        date: { gte: weekAgoStr },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        mood: true,
        energyLevel: true,
        tookMedication: true,
        sleepHours: true,
      },
    }),
  ]);

  if (journals.length === 0 && checkins.length === 0) {
    return NextResponse.json({
      reflection: null,
      message: "Sem dados suficientes para uma reflexão. Escreva no diário durante a semana.",
    });
  }

  // Build deterministic reflection
  const reflection = buildReflection(journals, checkins);

  return NextResponse.json(
    { reflection },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" } },
  );
}

// ── Deterministic reflection builder ─────────────────────────

interface JournalInput {
  type: string;
  content: string;
  zoneAtCapture: string | null;
  mixedAtCapture: boolean | null;
  snapshotSource: string;
  entryDateLocal: string;
  createdAt: Date;
}

interface CheckinInput {
  date: string;
  mood: number;
  energyLevel: number | null;
  tookMedication: string | null;
  sleepHours: number;
}

interface WeeklyReflection {
  periodStart: string;
  periodEnd: string;
  stats: {
    totalEntries: number;
    diaryCount: number;
    insightCount: number;
    daysWithEntries: number;
    avgMood: number | null;
    avgSleep: number | null;
    medicationAdherence: number | null;
  };
  moodJourney: {
    zone: string;
    label: string;
    count: number;
    excerpts: string[];
  }[];
  highlights: string[];
}

const ZONE_ORDER = ["depressao", "depressao_leve", "eutimia", "hipomania", "mania"];
const ZONE_DISPLAY: Record<string, string> = {
  depressao: "Humor muito baixo",
  depressao_leve: "Humor baixo",
  eutimia: "Humor estável",
  hipomania: "Humor elevado",
  mania: "Humor muito elevado",
};

function buildReflection(journals: JournalInput[], checkins: CheckinInput[]): WeeklyReflection {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Stats from check-ins
  const moods = checkins.map((c) => c.mood);
  const avgMood = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

  const sleeps = checkins.map((c) => c.sleepHours).filter((h) => h > 0);
  const avgSleep = sleeps.length > 0 ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;

  const medDays = checkins.filter((c) => c.tookMedication === "sim").length;
  const medTotal = checkins.filter((c) => c.tookMedication !== null).length;
  const medicationAdherence = medTotal > 0 ? Math.round((medDays / medTotal) * 100) : null;

  const entryDates = new Set(journals.map((j) => j.entryDateLocal));

  // Group journal entries by mood zone
  const byZone = new Map<string, JournalInput[]>();
  for (const j of journals) {
    const zone = j.zoneAtCapture && j.snapshotSource === "RECENT_CHECKIN"
      ? j.zoneAtCapture
      : "sem_registro";
    if (!byZone.has(zone)) byZone.set(zone, []);
    byZone.get(zone)!.push(j);
  }

  const moodJourney = ZONE_ORDER
    .filter((z) => byZone.has(z))
    .map((zone) => {
      const entries = byZone.get(zone)!;
      // Pick up to 2 short excerpts (first 80 chars)
      const excerpts = entries
        .slice(0, 2)
        .map((e) => {
          const trimmed = e.content.slice(0, 80).trim();
          return trimmed.length < e.content.length ? trimmed + "..." : trimmed;
        });

      return {
        zone,
        label: ZONE_DISPLAY[zone] || zone,
        count: entries.length,
        excerpts,
      };
    });

  // Add "sem registro" entries if any
  if (byZone.has("sem_registro")) {
    const entries = byZone.get("sem_registro")!;
    moodJourney.push({
      zone: "sem_registro",
      label: "Sem registro de humor",
      count: entries.length,
      excerpts: entries.slice(0, 1).map((e) => {
        const trimmed = e.content.slice(0, 80).trim();
        return trimmed.length < e.content.length ? trimmed + "..." : trimmed;
      }),
    });
  }

  // Highlights (patterns)
  const highlights: string[] = [];

  if (journals.length > 0) {
    highlights.push(`Você escreveu ${journals.length} ${journals.length === 1 ? "entrada" : "entradas"} em ${entryDates.size} ${entryDates.size === 1 ? "dia" : "dias"} diferentes.`);
  }

  if (avgMood !== null) {
    if (avgMood >= 3.8) highlights.push("Seu humor médio esteve elevado esta semana.");
    else if (avgMood <= 2.2) highlights.push("Seu humor médio esteve baixo esta semana.");
    else highlights.push("Seu humor esteve relativamente estável esta semana.");
  }

  if (medicationAdherence !== null) {
    if (medicationAdherence >= 85) highlights.push(`Boa adesão à medicação: ${medicationAdherence}%.`);
    else if (medicationAdherence < 50) highlights.push(`Adesão à medicação abaixo de 50% — converse com seu médico se tiver dificuldades.`);
  }

  if (moodJourney.length >= 3) {
    highlights.push("Você passou por diferentes estados de humor — rever o que escreveu pode ajudar a identificar padrões.");
  }

  return {
    periodStart: weekAgo.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    periodEnd: now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    stats: {
      totalEntries: journals.length,
      diaryCount: journals.filter((j) => j.type === "DIARY").length,
      insightCount: journals.filter((j) => j.type === "QUICK_INSIGHT").length,
      daysWithEntries: entryDates.size,
      avgMood: avgMood !== null ? Math.round(avgMood * 10) / 10 : null,
      avgSleep: avgSleep !== null ? Math.round(avgSleep * 10) / 10 : null,
      medicationAdherence,
    },
    moodJourney,
    highlights,
  };
}
