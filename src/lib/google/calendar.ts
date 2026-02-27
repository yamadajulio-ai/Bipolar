import { google, type calendar_v3 } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: "v3", auth });
}

/** Convert a PlannerBlock into a Google Calendar event body. */
export function blockToGoogleEvent(block: {
  id: string;
  title: string;
  category: string;
  kind: string;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  energyCost: number;
  stimulation: number;
}): calendar_v3.Schema$Event {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    summary: block.title,
    description: block.notes || undefined,
    start: {
      dateTime: block.startAt.toISOString(),
      timeZone: tz,
    },
    end: {
      dateTime: block.endAt.toISOString(),
      timeZone: tz,
    },
    extendedProperties: {
      private: {
        empresaBipolarId: block.id,
        category: block.category,
        kind: block.kind,
        energyCost: String(block.energyCost),
        stimulation: String(block.stimulation),
      },
    },
  };
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
export function googleEventToBlockData(event: calendar_v3.Schema$Event) {
  const extProps = event.extendedProperties?.private || {};
  const startDt = event.start?.dateTime || event.start?.date;
  const endDt = event.end?.dateTime || event.end?.date;

  return {
    title: event.summary || "Sem titulo",
    category: extProps.category || "outro",
    kind: extProps.kind || "FLEX",
    startAt: startDt ? new Date(startDt) : new Date(),
    endAt: endDt ? new Date(endDt) : new Date(),
    notes: event.description || null,
    energyCost: extProps.energyCost ? Number(extProps.energyCost) : 3,
    stimulation: extProps.stimulation ? Number(extProps.stimulation) : 1,
  };
}

export async function createGoogleEvent(
  auth: OAuth2Client,
  calendarId: string,
  event: calendar_v3.Schema$Event,
) {
  const cal = getCalendarClient(auth);
  const res = await cal.events.insert({ calendarId, requestBody: event });
  return res.data;
}

export async function updateGoogleEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
  event: calendar_v3.Schema$Event,
) {
  const cal = getCalendarClient(auth);
  const res = await cal.events.update({
    calendarId,
    eventId,
    requestBody: event,
  });
  return res.data;
}

export async function deleteGoogleEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
) {
  const cal = getCalendarClient(auth);
  await cal.events.delete({ calendarId, eventId });
}

export async function listEvents(
  auth: OAuth2Client,
  calendarId: string,
  syncToken?: string,
) {
  const cal = getCalendarClient(auth);

  const fullSyncParams = {
    calendarId,
    timeMin: new Date(Date.now() - 30 * 86400000).toISOString(),
    timeMax: new Date(Date.now() + 30 * 86400000).toISOString(),
    singleEvents: true,
    maxResults: 2500,
    showDeleted: true,
  };

  try {
    const allItems: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    if (syncToken) {
      // Incremental sync — keep singleEvents=true for consistency with full sync
      const res = await cal.events.list({
        calendarId,
        syncToken,
        showDeleted: true,
        singleEvents: true,
      });
      return {
        items: res.data.items || [],
        nextSyncToken: res.data.nextSyncToken || null,
      };
    }

    // Full sync with pagination
    do {
      const res = await cal.events.list({
        ...fullSyncParams,
        ...(pageToken ? { pageToken } : {}),
      });
      allItems.push(...(res.data.items || []));
      pageToken = res.data.nextPageToken || undefined;
      nextSyncToken = res.data.nextSyncToken || null;
    } while (pageToken);

    return { items: allItems, nextSyncToken };
  } catch (err: unknown) {
    // If syncToken is invalid (410 Gone), do full sync
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 410) {
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
        nextSyncToken = res.data.nextSyncToken || null;
      } while (pageToken);

      return { items: allItems, nextSyncToken };
    }
    throw err;
  }
}
