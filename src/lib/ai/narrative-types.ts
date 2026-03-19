/**
 * AI Narrative V2 — Type definitions
 *
 * Evidence-based typed input/output contract for the AI narrative system.
 * Per GPT Pro audit: "reduce model responsibility. The model should verbalize facts,
 * not decide risk, infer causality, or discover clinical hypotheses."
 */

// ── Evidence system ────────────────────────────────────────────

export type EvidenceDomain =
  | "sleep"
  | "mood"
  | "social_rhythms"
  | "planner"
  | "financial"
  | "cognition"
  | "assessments"
  | "life_events"
  | "correlations"
  | "trend";

export interface Evidence {
  id: string;
  domain: EvidenceDomain;
  kind: "metric" | "comparison" | "alert" | "event";
  text: string;                        // Pre-approved safe text
  rawValue: number | string | null;
  unit: string | null;
  timeframe: "7d" | "prev_7d" | "30d" | "90d" | "weekly";
  confidence: "high" | "medium" | "low";
  priority: 1 | 2 | 3;
}

export interface DomainPacket {
  status: "ok" | "limited" | "absent";
  evidence: Evidence[];
}

// ── NarrativeInputV2 (deterministic, sent to LLM) ─────────────

export interface NarrativeInputV2 {
  riskLevel: "low" | "moderate" | "high";
  bypassLlm: boolean;
  shareWithProfessional: boolean;
  locale: "pt-BR";
  timezone: string;
  period: {
    currentLabel: string;    // e.g. "08/03 a 19/03"
    comparisonLabel: string; // e.g. "01/03 a 08/03"
  };
  sections: {
    sleep: DomainPacket;
    mood: DomainPacket;
    socialRhythms: DomainPacket;
    planner: DomainPacket;
    financial: DomainPacket;
    cognition: DomainPacket;
    assessments: DomainPacket;
    lifeEvents: DomainPacket;
    correlations: DomainPacket;
    trend: DomainPacket;
  };
}

// ── NarrativeResultV2 (output from LLM or template) ───────────

export interface NarrativeSectionOutput {
  status: "notable" | "stable" | "limited" | "absent";
  title: string;
  summary: string;
  keyPoints: string[];
  metrics: string[];
  suggestions: string[];
  evidenceIds: string[];
}

export type NarrativeSource = "llm" | "template_high_risk" | "template_insufficient" | "fallback";

export interface NarrativeResultV2 {
  schemaVersion: "narrative_v2";
  source: NarrativeSource;
  overview: {
    headline: string;
    summary: string;
    dataQualityNote: string;
    evidenceIds: string[];
  };
  sections: {
    sleep: NarrativeSectionOutput;
    mood: NarrativeSectionOutput;
    socialRhythms: NarrativeSectionOutput;
    plannerContext: NarrativeSectionOutput;
    financialContext: NarrativeSectionOutput;
    cognition: NarrativeSectionOutput;
    weeklyAssessments: NarrativeSectionOutput;
    lifeEvents: NarrativeSectionOutput;
    correlations: NarrativeSectionOutput;
    overallTrend: NarrativeSectionOutput;
  };
  actions: {
    shareWithProfessional: boolean;
    practicalSuggestions: string[];
  };
  closing: {
    text: string;
  };
  generatedAt: string;
}

// ── Additional data passed to narrative generator ──────────────

export interface AssessmentSnapshot {
  date: string;
  asrmTotal: number | null;
  phq9Total: number | null;
  phq9Item9: number | null;
  fastAvg: number | null;
}

export interface LifeEventSnapshot {
  date: string;
  eventType: string; // sanitized category only — NO raw label/notes
}

export interface CognitiveSnapshot {
  reactionTimeMs: number | null;
  digitSpan: number | null;
  createdAt: Date;
}

export interface NarrativeExtraData {
  assessments: AssessmentSnapshot[];      // last 2 (current + previous)
  lifeEvents: LifeEventSnapshot[];        // last 30d, sanitized
  cognitiveTests: CognitiveSnapshot[];    // last 30d
}

// ── Persistence metadata ───────────────────────────────────────

export interface NarrativePersistenceData {
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  sourceFingerprint: string;
  bypassLlm: boolean;
  bypassReason: string | null;
  guardrailPassed: boolean;
  guardrailViolations: string[];
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  latencyMs: number | null;
}

export interface NarrativeGenerationResult {
  narrative: NarrativeResultV2;
  persistence: NarrativePersistenceData;
}

// ── Section keys (for iteration) ───────────────────────────────

export const NARRATIVE_SECTION_KEYS = [
  "sleep",
  "mood",
  "socialRhythms",
  "plannerContext",
  "financialContext",
  "cognition",
  "weeklyAssessments",
  "lifeEvents",
  "correlations",
  "overallTrend",
] as const;

export type NarrativeSectionKey = (typeof NARRATIVE_SECTION_KEYS)[number];

// ── Section display labels ─────────────────────────────────────

export const SECTION_LABELS: Record<NarrativeSectionKey, string> = {
  sleep: "Sono",
  mood: "Humor",
  socialRhythms: "Ritmos Sociais",
  plannerContext: "Rotina Planejada",
  financialContext: "Contexto Financeiro",
  cognition: "Cognição",
  weeklyAssessments: "Avaliações Semanais",
  lifeEvents: "Eventos de Vida",
  correlations: "Correlações",
  overallTrend: "Tendência Geral",
};

// ── Section display icons (emoji for lightweight rendering) ────

export const SECTION_ICONS: Record<NarrativeSectionKey, string> = {
  sleep: "🌙",
  mood: "🎭",
  socialRhythms: "⏰",
  plannerContext: "📋",
  financialContext: "💰",
  cognition: "🧠",
  weeklyAssessments: "📊",
  lifeEvents: "📌",
  correlations: "🔗",
  overallTrend: "📈",
};
