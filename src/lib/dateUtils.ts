/**
 * Centralized date utilities.
 * All functions produce YYYY-MM-DD strings in America/Sao_Paulo timezone.
 *
 * The app runs on Vercel (UTC server) but serves Brazilian users.
 * Using explicit timezone ensures correct dates regardless of server TZ.
 */

const TZ = "America/Sao_Paulo";

/** Returns today's date as YYYY-MM-DD in São Paulo timezone. */
export function localToday(): string {
  return localDateStr(new Date());
}

/** Converts any Date object to YYYY-MM-DD in São Paulo timezone. */
export function localDateStr(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/**
 * Returns the start of a day (00:00:00.000) as a Date object
 * for a given YYYY-MM-DD string, interpreted in local timezone.
 */
export function startOfDay(ymd: string): Date {
  return new Date(ymd + "T00:00:00");
}

/**
 * Returns the end of a day (23:59:59.999) as a Date object
 * for a given YYYY-MM-DD string, interpreted in local timezone.
 */
export function endOfDay(ymd: string): Date {
  return new Date(ymd + "T23:59:59.999");
}

/** Returns the current month as YYYY-MM in São Paulo timezone. */
export function localYearMonth(d?: Date): string {
  const dateStr = localDateStr(d ?? new Date());
  return dateStr.slice(0, 7);
}

/**
 * Shifts a YYYY-MM month string by `delta` months.
 * Returns the result as YYYY-MM.
 */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  // Use UTC to avoid timezone issues — we only care about year/month of
  // a Date constructed with explicit year/month (no TZ ambiguity).
  const ry = d.getFullYear();
  const rm = d.getMonth() + 1;
  return `${ry}-${String(rm).padStart(2, "0")}`;
}
