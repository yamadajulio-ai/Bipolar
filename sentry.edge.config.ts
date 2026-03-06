import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = "[Filtered]";
    }
    if (event.request?.query_string) {
      event.request.query_string = "[Filtered]";
    }
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    return event;
  },
});
