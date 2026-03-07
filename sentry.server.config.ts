import * as Sentry from "@sentry/nextjs";

/** Redact dynamic segments (tokens, UUIDs, numeric IDs) from URLs */
function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url
    .replace(/\/profissional\/[^/?#]+/g, "/profissional/[redacted]")
    .replace(/\/api\/acesso-profissional\/[^/?#]+/g, "/api/acesso-profissional/[redacted]")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/[uuid]")
    .replace(/\/\d{2,}/g, "/[id]")
    .replace(/\/[A-Za-z0-9_-]{16,}/g, "/[token]")
    .replace(/[?#].*$/, "");
}

/** Scrub URL-like values from span data object */
function scrubSpanData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data;
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && (k === "url" || k === "http.url" || k.endsWith(".url"))) {
      scrubbed[k] = scrubUrl(v);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "http" || breadcrumb.category === "fetch") {
      return {
        ...breadcrumb,
        data: breadcrumb.data?.url
          ? { url: scrubUrl(breadcrumb.data.url), status_code: breadcrumb.data.status_code, method: breadcrumb.data.method }
          : undefined,
      };
    }
    if (typeof breadcrumb.data?.url === "string") {
      return { ...breadcrumb, data: { ...breadcrumb.data, url: scrubUrl(breadcrumb.data.url) } };
    }
    return breadcrumb;
  },
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
    if (event.request?.headers) {
      const safe = ["content-type", "user-agent", "accept"];
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        if (safe.includes(k.toLowerCase())) filtered[k] = v;
      }
      event.request.headers = filtered;
    }
    if (event.transaction) {
      event.transaction = scrubUrl(event.transaction)!;
    }
    return event;
  },
  beforeSendTransaction(event) {
    if (event.transaction) {
      event.transaction = scrubUrl(event.transaction)!;
    }
    if (event.request?.url) {
      event.request.url = scrubUrl(event.request.url)!;
    }
    if (event.spans) {
      event.spans = event.spans.map((span) => ({
        ...span,
        description: span.description ? scrubUrl(span.description) : span.description,
        ...(span.data ? { data: scrubSpanData(span.data) as typeof span.data } : {}),
      }));
    }
    return event;
  },
});
