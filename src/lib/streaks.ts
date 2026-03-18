/**
 * Streak and achievement computation for gamification.
 * All dates should be YYYY-MM-DD strings.
 */

export interface StreakData {
  checkinStreak: number;       // Consecutive days with diary entry
  sleepStreak: number;         // Consecutive days with sleep log
  bestCheckinStreak: number;   // All-time longest checkin streak
  bestSleepStreak: number;     // All-time longest sleep streak
  totalCheckins: number;       // Total diary entries ever
  totalSleepLogs: number;      // Total sleep logs ever
  achievements: Achievement[];
}

export interface Achievement {
  key: string;
  label: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;  // 0-1 for partial progress
  target?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Check if a YYYY-MM-DD string is a real calendar date (not just format-valid). */
function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  // Roundtrip check: "2025-02-31" parses to "2025-03-03", which won't match
  return d.toISOString().slice(0, 10) === s;
}

/** Filter only valid, real calendar YYYY-MM-DD strings. */
function sanitizeDates(dates: string[]): string[] {
  return dates.filter(isRealDate);
}

/** Compute current streak from a sorted (desc) list of date strings. */
export function computeCurrentStreak(dates: string[], today: string): number {
  const valid = sanitizeDates(dates);
  if (valid.length === 0 || !isRealDate(today)) return 0;

  const dateSet = new Set(valid);
  let streak = 0;
  const d = new Date(today + "T12:00:00");

  while (dateSet.has(formatDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

/** Compute longest streak from a sorted (asc) list of date strings. */
export function computeLongestStreak(dates: string[]): number {
  const valid = sanitizeDates(dates);
  if (valid.length === 0) return 0;

  const unique = [...new Set(valid)].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + "T12:00:00");
    const curr = new Date(unique[i] + "T12:00:00");
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ACHIEVEMENT_DEFS: Array<{
  key: string;
  label: string;
  description: string;
  icon: string;
  check: (data: { checkinStreak: number; sleepStreak: number; bestCheckinStreak: number; bestSleepStreak: number; totalCheckins: number; totalSleepLogs: number }) => { unlocked: boolean; progress?: number; target?: number };
}> = [
  {
    key: "first_checkin",
    label: "Primeiro passo",
    description: "Fez seu primeiro check-in",
    icon: "🌱",
    check: (d) => ({ unlocked: d.totalCheckins >= 1 }),
  },
  {
    key: "streak_3",
    label: "3 dias seguidos",
    description: "Check-in por 3 dias consecutivos",
    icon: "🔥",
    check: (d) => ({ unlocked: d.bestCheckinStreak >= 3, progress: d.bestCheckinStreak >= 3 ? 1 : Math.min(d.checkinStreak / 3, 1), target: 3 }),
  },
  {
    key: "streak_7",
    label: "Uma semana!",
    description: "Check-in por 7 dias consecutivos",
    icon: "⭐",
    check: (d) => ({ unlocked: d.bestCheckinStreak >= 7, progress: d.bestCheckinStreak >= 7 ? 1 : Math.min(d.checkinStreak / 7, 1), target: 7 }),
  },
  {
    key: "streak_14",
    label: "Duas semanas!",
    description: "Check-in por 14 dias consecutivos",
    icon: "💪",
    check: (d) => ({ unlocked: d.bestCheckinStreak >= 14, progress: d.bestCheckinStreak >= 14 ? 1 : Math.min(d.checkinStreak / 14, 1), target: 14 }),
  },
  {
    key: "streak_30",
    label: "Um mês inteiro!",
    description: "Check-in por 30 dias consecutivos",
    icon: "🏆",
    check: (d) => ({ unlocked: d.bestCheckinStreak >= 30, progress: d.bestCheckinStreak >= 30 ? 1 : Math.min(d.checkinStreak / 30, 1), target: 30 }),
  },
  {
    key: "sleep_streak_7",
    label: "Sono registrado",
    description: "Registrou sono por 7 dias seguidos",
    icon: "🌙",
    check: (d) => ({ unlocked: d.bestSleepStreak >= 7, progress: d.bestSleepStreak >= 7 ? 1 : Math.min(d.sleepStreak / 7, 1), target: 7 }),
  },
  {
    key: "total_30",
    label: "30 registros",
    description: "Completou 30 check-ins no total",
    icon: "📊",
    check: (d) => ({ unlocked: d.totalCheckins >= 30, progress: Math.min(d.totalCheckins / 30, 1), target: 30 }),
  },
  {
    key: "total_100",
    label: "Centenário",
    description: "Completou 100 check-ins no total",
    icon: "💯",
    check: (d) => ({ unlocked: d.totalCheckins >= 100, progress: Math.min(d.totalCheckins / 100, 1), target: 100 }),
  },
  {
    key: "dual_streak_7",
    label: "Dupla dedicação",
    description: "7 dias seguidos com check-in E sono",
    icon: "🎯",
    check: (d) => {
      const unlocked = d.bestCheckinStreak >= 7 && d.bestSleepStreak >= 7;
      return {
        unlocked,
        progress: unlocked ? 1 : Math.min(Math.min(d.checkinStreak, d.sleepStreak) / 7, 1),
        target: 7,
      };
    },
  },
];

export function computeAchievements(data: Omit<StreakData, "achievements">): Achievement[] {
  return ACHIEVEMENT_DEFS.map((def) => {
    const result = def.check(data);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      icon: def.icon,
      ...result,
    };
  });
}
