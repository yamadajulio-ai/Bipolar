/**
 * Centralized date utilities.
 * All functions produce YYYY-MM-DD strings in the local timezone.
 *
 * Because this is a local-first SQLite app, the server runs on the
 * same machine as the user, so using the JS engine's local timezone
 * is correct for both client and server code.
 */

/** Returns today's date as YYYY-MM-DD in the local timezone. */
export function localToday(): string {
  return localDateStr(new Date());
}

/** Converts any Date object to YYYY-MM-DD in the local timezone. */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
