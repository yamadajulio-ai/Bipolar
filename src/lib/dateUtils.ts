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
