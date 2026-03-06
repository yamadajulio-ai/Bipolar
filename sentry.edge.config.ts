import * as Sentry from "@sentry/nextjs";

/** Redact dynamic segments (tokens, UUIDs, numeric IDs) from URLs */
function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url
    .replace(/\/profissional\/[^/]+/g, "/profissional/[redacted]")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/[uuid]")
    .replace(/\/\d{2,}/g, "/[id]");
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = scrubUrl(event.request.url)!;
    }
    if (event.request?.data) {
      event.request.data = "[Filtered]";
    }
    if (event.request?.query_string) {
      event.request.query_string = "[Filtered]";
    }
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    if (event.transaction) {
      event.transaction = scrubUrl(event.transaction)!;
    }
    return event;
  },
});
