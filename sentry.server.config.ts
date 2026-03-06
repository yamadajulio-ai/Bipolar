import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip sensitive health data from error reports
    if (event.request?.data) {
      event.request.data = "[Filtered]";
    }
    if (event.request?.query_string) {
      event.request.query_string = "[Filtered]";
    }
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    if (event.request?.headers) {
      const safe = ["content-type", "user-agent", "accept"];
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        if (safe.includes(k.toLowerCase())) filtered[k] = v;
      }
      event.request.headers = filtered;
    }
    return event;
  },
});
