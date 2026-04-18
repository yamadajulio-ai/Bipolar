import { google, type calendar_v3 } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: "v3", auth });
}

/** Returns true if the event is an all-day event (uses date instead of dateTime). */
export function isAllDayEvent(event: calendar_v3.Schema$Event): boolean {
  return !!(event.start?.date && !event.start?.dateTime);
}

/** Returns true if the event duration exceeds the given hours threshold. */
export function isLongEvent(event: calendar_v3.Schema$Event, maxHours = 18): boolean {
  const startDt = event.start?.dateTime || event.start?.date;
  const endDt = event.end?.dateTime || event.end?.date;
  if (!startDt || !endDt) return false;
  const durationMs = new Date(endDt).getTime() - new Date(startDt).getTime();
  return durationMs > maxHours * 3600000;
}

/** Convert a Google Calendar event into partial PlannerBlock data. */
export function googleEventToBlockData(event: calendar_v3.Schema$Event, defaultColorId?: string | null) {
  const extProps = event.extendedProperties?.private || {};
  const startDt = event.start?.dateTime || event.start?.date;
  const endDt = event.end?.dateTime || event.end?.date;

  return {
    title: event.summary || "Sem título",
    category: extProps.category || "outro",
    kind: extProps.kind || "FLEX",
    startAt: startDt ? new Date(startDt) : new Date(),
    endAt: endDt ? new Date(endDt) : new Date(),
    notes: event.description || null,
    energyCost: extProps.energyCost ? Number(extProps.energyCost) : 3,
    stimulation: extProps.stimulation ? Number(extProps.stimulation) : 1,
    // event.colorId = custom per-event color; fallback to calendar default
    googleColor: event.colorId || defaultColorId || null,
  };
}

/** Fetch the calendar's default colorId from calendarList. */
export async function getCalendarColorId(auth: OAuth2Client, calendarId: string): Promise<string | null> {
  try {
    const cal = getCalendarClient(auth);
    const res = await cal.calendarList.get({ calendarId });
    return res.data.colorId || null;
  } catch {
    return null;
  }
}

export interface ListEventsResult {
  items: calendar_v3.Schema$Event[];
  nextSyncToken: string | null;
  /**
   * True when the returned items represent a full list (no syncToken was
   * passed, or 410 GONE invalidated the cursor and we fell back to full).
   * Callers MUST treat the local DB state as stale and reconcile against the
   * full list — incremental delete semantics don't apply.
   */
  didFullList: boolean;
}

async function paginateFullList(
  cal: calendar_v3.Calendar,
  calendarId: string,
): Promise<{ items: calendar_v3.Schema$Event[]; nextSyncToken: string | null }> {
  const fullSyncParams = {
    calendarId,
    timeMin: new Date(Date.now() - 7 * 86400000).toISOString(),
    timeMax: new Date(Date.now() + 14 * 86400000).toISOString(),
    singleEvents: true,
    maxResults: 500,
    showDeleted: true,
  };
  const allItems: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  do {
    const res = await cal.events.list({
      ...fullSyncParams,
      ...(pageToken ? { pageToken } : {}),
    });
    allItems.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken || undefined;
    // nextSyncToken is only set on the final page — overwrite each loop so the
    // last non-null value wins.
    if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
  } while (pageToken);
  return { items: allItems, nextSyncToken };
}

async function paginateIncremental(
  cal: calendar_v3.Calendar,
  calendarId: string,
  syncToken: string,
): Promise<{ items: calendar_v3.Schema$Event[]; nextSyncToken: string | null }> {
  // Per Google Calendar docs: incremental also paginates. Only the LAST page
  // carries the new nextSyncToken; middle pages carry nextPageToken. The first
  // request uses `syncToken`; follow-up requests use `pageToken` (and NOT
  // syncToken again). Never combine syncToken with timeMin/timeMax.
  const allItems: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let firstCall = true;
  do {
    const res = await cal.events.list({
      calendarId,
      showDeleted: true,
      singleEvents: true,
      ...(firstCall ? { syncToken } : { pageToken }),
    });
    firstCall = false;
    allItems.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken || undefined;
    if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;
  } while (pageToken);
  return { items: allItems, nextSyncToken };
}

export async function listEvents(
  auth: OAuth2Client,
  calendarId: string,
  syncToken?: string,
): Promise<ListEventsResult> {
  const cal = getCalendarClient(auth);

  if (!syncToken) {
    const result = await paginateFullList(cal, calendarId);
    return { ...result, didFullList: true };
  }

  try {
    const result = await paginateIncremental(cal, calendarId, syncToken);
    return { ...result, didFullList: false };
  } catch (err: unknown) {
    // 410 GONE → syncToken is invalid/expired. Per Google's contract, caller
    // must discard local state and do a full list. We signal that via didFullList
    // so sync.ts runs full-sync delete semantics, not incremental.
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 410) {
      const result = await paginateFullList(cal, calendarId);
      return { ...result, didFullList: true };
    }
    throw err;
  }
}
