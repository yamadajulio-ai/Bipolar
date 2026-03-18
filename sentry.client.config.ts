import * as Sentry from "@sentry/nextjs";

/** Redact dynamic segments (tokens, UUIDs, numeric IDs) from URLs */
function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url
    // Known routes with sensitive tokens
    .replace(/\/profissional\/[^/?#]+/g, "/profissional/[redacted]")
    .replace(/\/api\/acesso-profissional\/[^/?#]+/g, "/api/acesso-profissional/[redacted]")
    // UUIDs anywhere in path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/[uuid]")
    // Numeric IDs (2+ digits)
    .replace(/\/\d{2,}/g, "/[id]")
    // Long alphanumeric tokens (16+ chars, catch-all for other token patterns)
    .replace(/\/[A-Za-z0-9_-]{16,}/g, "/[token]")
    // Strip query string and hash from URL
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

function scrubEvent(event: Sentry.ErrorEvent) {
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
  // Scrub breadcrumb data — strict whitelist
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      if (b.category === "fetch" || b.category === "xhr") {
        return {
          ...b,
          data: {
            url: scrubUrl(b.data?.url),
            status_code: b.data?.status_code,
            method: b.data?.method,
          },
        };
      }
      if (b.category === "navigation") {
        return {
          ...b,
          data: {
            from: scrubUrl(b.data?.from),
            to: scrubUrl(b.data?.to),
          },
        };
      }
      return b;
    });
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction)!;
  }
  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
      return {
        ...breadcrumb,
        data: breadcrumb.data?.url
          ? { url: scrubUrl(breadcrumb.data.url), status_code: breadcrumb.data.status_code, method: breadcrumb.data.method }
          : undefined,
      };
    }
    if (breadcrumb.category === "navigation") {
      return {
        ...breadcrumb,
        data: {
          from: scrubUrl(breadcrumb.data?.from),
          to: scrubUrl(breadcrumb.data?.to),
        },
      };
    }
    // Generic: scrub any breadcrumb with data.url string
    if (typeof breadcrumb.data?.url === "string") {
      return { ...breadcrumb, data: { ...breadcrumb.data, url: scrubUrl(breadcrumb.data.url) } };
    }
    return breadcrumb;
  },
  beforeSend(event) {
    return scrubEvent(event);
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
