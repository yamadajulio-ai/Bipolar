import type { DiaryEntryInput, SleepLogInput, HeatmapDay } from "./types";
import { dateStr } from "./stats";

/**
 * Compute heatmap data for the calendar view.
 * I4-T3 optimization: only generates slots for the range that has actual data,
 * with a minimum of the entry/sleep range and a maximum of 90 days.
 * If the user has sparse data (e.g., 10 days in 90), we still only iterate
 * from the earliest data point to today, avoiding unnecessary empty slots.
 */
export function computeHeatmapData(
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
): HeatmapDay[] {
  const ninetyAgo = new Date(today);
  ninetyAgo.setDate(ninetyAgo.getDate() - 89);

  const entryMap = new Map(entries.map((e) => [e.date, e]));
  // Filter out naps (<1h) to avoid painting noise on the heatmap
  const realSleep = sleepLogs.filter((s) => s.totalHours >= 1);
  const sleepMap = new Map(realSleep.map((s) => [s.date, s]));

  // I4-T3: Find earliest data point to short-circuit empty leading days
  const allDates: string[] = [];
  for (const e of entries) allDates.push(e.date);
  for (const s of realSleep) allDates.push(s.date);

  // If no data at all, return empty array instead of 90 empty slots
  if (allDates.length === 0) return [];

  allDates.sort();
  const earliestData = allDates[0];
  const ninetyAgoStr = dateStr(ninetyAgo, tz);

  // Start from whichever is later: 90 days ago or earliest data minus 3 days (context)
  // This avoids generating dozens of empty leading slots for new users
  const contextStart = new Date(earliestData + "T12:00:00");
  contextStart.setDate(contextStart.getDate() - 3);
  const contextStartStr = dateStr(contextStart, tz);
  const effectiveStartStr = contextStartStr > ninetyAgoStr ? contextStartStr : ninetyAgoStr;

  const effectiveStart = new Date(effectiveStartStr + "T12:00:00");

  const days: HeatmapDay[] = [];
  const d = new Date(effectiveStart);
  const todayStr = dateStr(today, tz);
  while (dateStr(d, tz) <= todayStr) {
    const ds = dateStr(d, tz);
    const entry = entryMap.get(ds);
    const sleepLog = sleepMap.get(ds);
    days.push({
      date: ds,
      mood: entry?.mood ?? null,
      sleepHours: sleepLog?.totalHours ?? null,
      energy: entry?.energyLevel ?? null,
      hasEntry: !!entry || !!sleepLog,
    });
    d.setDate(d.getDate() + 1);
  }

  return days;
}
