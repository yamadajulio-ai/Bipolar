/**
 * Typed telemetry event definitions.
 * All analytics/Sentry events should go through these helpers
 * to ensure consistent naming and properties.
 */

// ── Event catalog ──────────────────────────────────────────────
export type TelemetryEvent =
  | { name: "checkin_open" }
  | { name: "checkin_start"; mode: "minimal" | "complete" }
  | { name: "checkin_complete"; mode: "minimal" | "complete"; snapshotCount: number }
  | { name: "checkin_abandon"; step: string }
  | { name: "assessment_start" }
  | { name: "assessment_step"; step: "asrm" | "phq9" | "fast" | "review" }
  | { name: "assessment_complete"; asrmTotal: number; phq9Total: number }
  | { name: "assessment_dropoff"; step: "asrm" | "phq9" | "fast" | "review" }
  | { name: "sleep_log_create" }
  | { name: "sleep_log_exclude"; reason: string }
  | { name: "narrative_request" }
  | { name: "narrative_success"; model: string; durationMs: number }
  | { name: "narrative_fallback"; reason: string }
  | { name: "narrative_error"; errorType: string }
  | { name: "sos_open"; authenticated: boolean }
  | { name: "sos_action"; action: string; authenticated: boolean }
  | { name: "sos_chat_start" }
  | { name: "sos_crisis_detected"; method: "deterministic" | "llm" }
  | { name: "health_import_complete"; imported: number; skipped: number }
  | { name: "health_import_error"; errorType: string }
  | { name: "webhook_rejected"; endpoint: string; reason: string }
  | { name: "export_complete"; format: string }
  | { name: "consent_toggle"; scope: string; granted: boolean };

// ── Privacy metadata ─────────────────────────────────────────────
export type PrivacyClass = "phi" | "phi_crisis" | "operational" | "consent";

const PRIVACY_CLASS_MAP: Record<TelemetryEvent["name"], PrivacyClass> = {
  // Health data (PHI)
  checkin_open: "phi",
  checkin_start: "phi",
  checkin_complete: "phi",
  checkin_abandon: "phi",
  assessment_start: "phi",
  assessment_step: "phi",
  assessment_complete: "phi",
  assessment_dropoff: "phi",
  sleep_log_create: "phi",
  sleep_log_exclude: "phi",
  narrative_request: "phi",
  narrative_success: "phi",
  narrative_fallback: "phi",
  narrative_error: "phi",
  health_import_complete: "phi",
  health_import_error: "phi",

  // SOS / crisis (PHI elevated)
  sos_open: "phi_crisis",
  sos_action: "phi_crisis",
  sos_chat_start: "phi_crisis",
  sos_crisis_detected: "phi_crisis",

  // Navigation / operational
  webhook_rejected: "operational",
  export_complete: "operational",

  // Consent
  consent_toggle: "consent",
};

const TELEMETRY_SCHEMA_VERSION = 1 as const;

// ── Track function ─────────────────────────────────────────────
// Lightweight wrapper — currently logs to console in dev, Sentry breadcrumb in prod.
// Can be swapped for PostHog/Mixpanel/Amplitude later without changing call sites.

export function track(event: TelemetryEvent): void {
  const enriched = {
    ...event,
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    privacyClass: PRIVACY_CLASS_MAP[event.name],
  };

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.debug("[telemetry]", event.name, enriched);
    return;
  }

  // Server-side or production: Sentry breadcrumb
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.addBreadcrumb({
      category: "telemetry",
      message: event.name,
      level: "info",
      data: enriched,
    });
  } catch {
    // Sentry not available — silent
  }
}

// ── Structured error logging ───────────────────────────────────
export function trackError(event: {
  name: string;
  errorType: string;
  message?: string;
  endpoint?: string;
  extra?: Record<string, unknown>;
}): void {
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.captureMessage(event.name, {
      level: "warning",
      tags: {
        errorType: event.errorType,
        ...(event.endpoint ? { endpoint: event.endpoint } : {}),
      },
      extra: { message: event.message, ...event.extra },
    });
  } catch {
    console.error("[telemetry:error]", event);
  }
}
