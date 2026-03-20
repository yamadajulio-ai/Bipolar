/**
 * PublicEvidence layer — allowlist of evidence IDs safe to surface in the UI.
 *
 * Raw Evidence objects contain rawValue and technical details that should NOT
 * be shown directly to users. This layer maps evidence IDs to safe, concise
 * chip text + optional detail text for tap-to-expand.
 *
 * Only evidence IDs listed here will be rendered as chips.
 * Max 4 chips per section (enforced at render time).
 */

export interface PublicEvidence {
  chipText: string;       // Short label for the chip (max ~40 chars)
  detailText: string;     // Longer explanation for bottom sheet / tooltip
  domain: string;
  kind: string;
  confidence: string;
}

/**
 * Allowlist mapping: evidence ID pattern → chip/detail text generators.
 * Uses prefix matching so e.g. "sleep_alert_" matches all sleep alerts.
 */
interface AllowlistEntry {
  chipText: (text: string) => string;
  detailText: (text: string) => string;
}

const EVIDENCE_ALLOWLIST: Record<string, AllowlistEntry> = {
  // Sleep
  "sleep_avg_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => t,
  },
  "sleep_trend_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Tendência do sono nos últimos 30 dias: ${t}`,
  },
  "sleep_bedtime_var_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Variabilidade do horário de dormir: ${t}`,
  },
  "sleep_quality_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => t,
  },
  "sleep_jetlag_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Social jet lag (diferença semana/fim de semana): ${t}`,
  },

  // Mood
  "mood_headline_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => t,
  },
  "mood_trend_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Tendência do humor: ${t}`,
  },
  "mood_amplitude_7d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Oscilação do humor nos últimos 7 dias: ${t}`,
  },
  "mood_med_adherence_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => t,
  },
  "mood_thermo_position": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Posição no termômetro de humor: ${t}`,
  },

  // Rhythms
  "rhythm_regularity_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Regularidade geral dos ritmos sociais: ${t}`,
  },

  // Correlations
  "corr_sleep_mood_30d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Correlação entre qualidade do sono e humor: ${t}`,
  },

  // Assessments
  "assess_phq9_weekly": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => t,
  },
  "assess_asrm_weekly": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => t,
  },

  // Trends
  "trend_cycling_90d": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Análise de ciclagem dos últimos 90 dias: ${t}`,
  },

  // Cognition
  "cog_reaction_recent": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Tempo de reação comparado à sua média: ${t}`,
  },
  "cog_digit_span_recent": {
    chipText: (t) => truncate(t, 40),
    detailText: (t) => `Span de dígitos comparado à sua média: ${t}`,
  },
};

/** Prefix-based alert allowlist — alerts are dynamic but safe to show */
const ALERT_PREFIXES = [
  "sleep_alert_",
  "mood_alert_",
  "rhythm_alert_",
  "mood_thermo_mixed",
  "mood_thermo_instability",
  "trend_mania_signals",
  "trend_depression_signals",
  "mood_warning_signs_30d",
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/**
 * Filter and map raw evidence to safe public-facing chips.
 * Returns max `limit` chips per call (default 4).
 */
export function toPublicEvidence(
  evidenceMap: Record<string, { text: string; domain: string; kind: string; confidence: string }>,
  evidenceIds: string[],
  limit = 4,
): PublicEvidence[] {
  const result: PublicEvidence[] = [];

  for (const eid of evidenceIds) {
    if (result.length >= limit) break;

    const raw = evidenceMap[eid];
    if (!raw) continue;

    // Check exact match first
    const entry = EVIDENCE_ALLOWLIST[eid];
    if (entry) {
      result.push({
        chipText: entry.chipText(raw.text),
        detailText: entry.detailText(raw.text),
        domain: raw.domain,
        kind: raw.kind,
        confidence: raw.confidence,
      });
      continue;
    }

    // Check prefix match for alerts
    const isAllowedAlert = ALERT_PREFIXES.some((prefix) => eid.startsWith(prefix));
    if (isAllowedAlert) {
      result.push({
        chipText: truncate(raw.text, 40),
        detailText: raw.text,
        domain: raw.domain,
        kind: raw.kind,
        confidence: raw.confidence,
      });
    }
  }

  return result;
}

/** Max chips to show per narrative section */
export const MAX_CHIPS_PER_SECTION = 4;
