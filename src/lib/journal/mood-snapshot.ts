/**
 * Captures an immutable mood snapshot from the most recent check-in.
 * Only associates if check-in is recent (< 4 hours) to avoid stale snapshots.
 */

import { prisma } from "@/lib/db";

const FRESHNESS_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface MoodSnapshot {
  maniaScore: number | null;
  depressionScore: number | null;
  energyScore: number | null;
  zoneAtCapture: string | null;
  mixedAtCapture: boolean | null;
  snapshotSource: "RECENT_CHECKIN" | "NONE";
  sourceCheckInId: string | null;
}

/**
 * Compute a quick mania/depression score from a single check-in.
 * Simplified version of computeInsights thermometer (single-entry, no EWMA).
 */
function computeQuickScores(entry: {
  mood: number;
  energyLevel: number | null;
  anxietyLevel: number | null;
  irritability: number | null;
  sleepHours: number;
}): { maniaScore: number; depressionScore: number; zone: string; mixed: boolean } {
  let M = 0;
  let D = 0;

  // Mood contribution
  if (entry.mood >= 4) M += entry.mood === 5 ? 25 : 15;
  if (entry.mood <= 2) D += entry.mood === 1 ? 25 : 15;

  // Energy contribution
  const energy = entry.energyLevel ?? 3;
  if (energy >= 4) M += energy === 5 ? 20 : 12;
  if (energy <= 2) D += energy === 1 ? 20 : 12;

  // Sleep contribution (short sleep → mania signal, long → depression)
  // Skip when sleepHours is 0 (no data available, not "slept zero hours")
  if (entry.sleepHours > 0) {
    if (entry.sleepHours <= 4) M += 15;
    else if (entry.sleepHours <= 5.5) M += 8;
    if (entry.sleepHours > 11) D += 12;
    else if (entry.sleepHours > 9.5) D += 6;
  }

  // Irritability → mania
  const irrit = entry.irritability ?? 3;
  if (irrit >= 4) M += 8;

  // Anxiety → depression (mild)
  const anxiety = entry.anxietyLevel ?? 3;
  if (anxiety >= 4) D += 5;

  // Clamp to 0-100
  M = Math.min(100, Math.max(0, M));
  D = Math.min(100, Math.max(0, D));

  // Zone from position
  const position = 50 + 0.5 * (M - D);
  let zone: string;
  if (position <= 20) zone = "depressao";
  else if (position <= 38) zone = "depressao_leve";
  else if (position <= 62) zone = "eutimia";
  else if (position <= 80) zone = "hipomania";
  else zone = "mania";

  // Simplified mixed detection
  const mixed = M >= 30 && D >= 30 && Math.abs(M - D) <= 20;

  return { maniaScore: M, depressionScore: D, zone, mixed };
}

export async function captureMoodSnapshot(userId: string): Promise<MoodSnapshot> {
  const now = new Date();
  const threshold = new Date(now.getTime() - FRESHNESS_THRESHOLD_MS);

  // Get the most recent check-in
  const recent = await prisma.diaryEntry.findFirst({
    where: {
      userId,
      createdAt: { gte: threshold },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      mood: true,
      energyLevel: true,
      anxietyLevel: true,
      irritability: true,
      sleepHours: true,
    },
  });

  if (!recent) {
    return {
      maniaScore: null,
      depressionScore: null,
      energyScore: null,
      zoneAtCapture: null,
      mixedAtCapture: null,
      snapshotSource: "NONE",
      sourceCheckInId: null,
    };
  }

  const scores = computeQuickScores(recent);

  return {
    maniaScore: scores.maniaScore,
    depressionScore: scores.depressionScore,
    energyScore: recent.energyLevel,
    zoneAtCapture: scores.zone,
    mixedAtCapture: scores.mixed,
    snapshotSource: "RECENT_CHECKIN",
    sourceCheckInId: recent.id,
  };
}
