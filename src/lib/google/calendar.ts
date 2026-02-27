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

  try {
    const res = await cal.events.list({
      calendarId,
      ...(syncToken
        ? { syncToken }
        : {
            // First sync: get events from last 30 days
            timeMin: new Date(Date.now() - 30 * 86400000).toISOString(),
            singleEvents: true,
            maxResults: 250,
          }),
      showDeleted: true,
    });

    return {
      items: res.data.items || [],
      nextSyncToken: res.data.nextSyncToken || null,
    };
  } catch (err: unknown) {
    // If syncToken is invalid (410 Gone), do full sync
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 410) {
      const res = await cal.events.list({
        calendarId,
        timeMin: new Date(Date.now() - 30 * 86400000).toISOString(),
        singleEvents: true,
        maxResults: 250,
        showDeleted: true,
      });
      return {
        items: res.data.items || [],
        nextSyncToken: res.data.nextSyncToken || null,
      };
    }
    throw err;
  }
}
