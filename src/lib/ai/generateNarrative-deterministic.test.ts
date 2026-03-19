import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for generateNarrative V2 — deterministic paths, high-risk template,
 * insufficient data bypass, prepareNarrativeInput logic, and OpenAI
 * Responses API integration.
 *
 * Complements generateNarrative.test.ts (which tests forbidden patterns).
 */

// ─── Mock setup ─────────────────────────────────────────────────────────────

const mockResponsesCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      responses = { create: (...args: unknown[]) => mockResponsesCreate(...args) };
    },
  };
});

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// ─── Minimal InsightsResult factory ─────────────────────────────────────────

function makeInsights(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sleep: {
      recordCount: 14,
      avgDuration: 7.2,
      sleepTrend: "stable",
      sleepTrendDelta: 0.1,
      bedtimeVariance: 25,
      durationVariability: 30,
      avgQuality: 3.8,
      midpoint: "03:30",
      socialJetLag: 15,
      sleepHeadline: "Sono regular nos últimos 14 dias",
      alerts: [],
      dataConfidence: "high",
    },
    mood: {
      moodHeadline: "Humor estável",
      moodTrend: "stable",
      moodAmplitude: 20,
      moodAmplitudeLabel: "baixa",
      medicationAdherence: 0.85,
      topWarningSigns: [],
      alerts: [],
    },
    thermometer: {
      position: 50,
      zoneLabel: "estável",
      instability: 12,
      mixedFeatures: false,
      factors: [],
    },
    rhythm: {
      overallRegularity: 75,
      hasEnoughData: true,
      anchors: {
        wake: { label: "Acordar", variance: 20, regularityScore: 80, daysCount: 14 },
        sleep: { label: "Dormir", variance: 25, regularityScore: 75, daysCount: 14 },
      },
      alerts: [],
    },
    chart: {
      correlation: { rho: 0.45, strength: "moderada", direction: "positiva", confidence: "alta" },
      lagCorrelation: null,
    },
    combinedPatterns: [],
    risk: { level: "normal", score: 15, factors: [] },
    prediction: { level: "baixo", maniaSignals: [], depressionSignals: [] },
    cycling: { isRapidCycling: false, polaritySwitches: 1 },
    seasonality: { hasSeasonalPattern: false, description: "" },
    ...overrides,
  };
}

function makeExtra() {
  return { assessments: [], lifeEvents: [], cognitiveTests: [] };
}

function makeAbsentSection(title: string) {
  return { status: "absent", title, summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] };
}

function makeValidResponse(content: object) {
  return {
    status: "completed",
    output: [{ type: "message", content: [{ type: "text" }] }],
    output_text: JSON.stringify(content),
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}

function makeValidV2Narrative(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: "narrative_v2",
    overview: {
      headline: overrides.headline || "Seus dados estão estáveis.",
      summary: overrides.summary || "Seus dados dos últimos 30 dias mostram padrões estáveis.",
      dataQualityNote: overrides.dataQualityNote || "",
      evidenceIds: [],
    },
    sections: {
      sleep: { status: "stable", title: "Sono", summary: "Sono regular de 7.2h em média.", keyPoints: ["Duração adequada"], metrics: ["7.2h média"], suggestions: ["Mantenha a rotina"], evidenceIds: ["sleep_avg_30d"] },
      mood: { status: "stable", title: "Humor", summary: "Humor estável no período.", keyPoints: ["Baixa oscilação"], metrics: ["Posição 50/100"], suggestions: ["Continue registrando"], evidenceIds: ["mood_headline_30d"] },
      socialRhythms: { status: "stable", title: "Ritmos Sociais", summary: "Rotina previsível.", keyPoints: ["Boa regularidade"], metrics: ["75/100"], suggestions: [], evidenceIds: ["rhythm_regularity_30d"] },
      plannerContext: makeAbsentSection("Rotina Planejada"),
      financialContext: makeAbsentSection("Contexto Financeiro"),
      cognition: makeAbsentSection("Cognição"),
      weeklyAssessments: makeAbsentSection("Avaliações Semanais"),
      lifeEvents: makeAbsentSection("Eventos de Vida"),
      correlations: { status: "stable", title: "Correlações", summary: "Associação moderada entre sono e humor.", keyPoints: [], metrics: ["rho 0.45"], suggestions: [], evidenceIds: ["corr_sleep_mood_30d"] },
      overallTrend: { status: "stable", title: "Tendência Geral", summary: "Período estável.", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    },
    actions: {
      shareWithProfessional: false,
      practicalSuggestions: ["Continue registrando diariamente", "Mantenha a rotina de sono"],
    },
    closing: { text: "O app está aqui para acompanhar você." },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("generateNarrative — deterministic paths", () => {
  let generateNarrative: (insights: unknown, extra: unknown) => Promise<Record<string, unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_NARRATIVE_MODEL;
    vi.resetModules();
    const mod = await import("./generateNarrative");
    generateNarrative = mod.generateNarrative as unknown as (insights: unknown, extra: unknown) => Promise<Record<string, unknown>>;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_NARRATIVE_MODEL;
  });

  // ── High-risk template bypass ─────────────────────────────────────────

  describe("high-risk template (atencao_alta)", () => {
    it("bypasses LLM entirely for high-risk level", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["irregularidade_sono", "oscilacao_alta"] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.headline).toContain("atenção especial");
      expect(overview.summary).toContain("horários de sono muito irregulares");
      expect(overview.summary).toContain("oscilação de humor acima do esperado");
      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });

    it("drops unknown factors (fail-closed) and uses fallback", async () => {
      const factors = ["unknown_factor_1", "unknown_factor_2", "unknown_factor_3"];
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 90, factors },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("múltiplos indicadores elevados");
      for (const f of factors) {
        expect(overview.summary).not.toContain(f);
      }
    });

    it("uses fallback text when no factors provided", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 80, factors: [] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("múltiplos indicadores elevados");
    });

    it("always includes generatedAt ISO date", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, string>;
      expect(narrative.generatedAt).toBeDefined();
      expect(new Date(narrative.generatedAt).toISOString()).toBe(narrative.generatedAt);
    });

    it("includes professional contact suggestion", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const actions = narrative.actions as Record<string, unknown>;
      const suggestions = actions.practicalSuggestions as string[];
      expect(suggestions.some((s) => s.includes("profissional"))).toBe(true);
    });

    it("sets bypassLlm=true and bypassReason in persistence", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const persistence = result.persistence as Record<string, unknown>;
      expect(persistence.bypassLlm).toBe(true);
      expect(persistence.bypassReason).toBe("high_risk");
    });

    it("sets shareWithProfessional=true for high risk", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const actions = narrative.actions as Record<string, unknown>;
      expect(actions.shareWithProfessional).toBe(true);
    });

    it("sets source='template_high_risk' for high risk", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      expect(narrative.source).toBe("template_high_risk");
    });
  });

  // ── Insufficient data bypass ──────────────────────────────────────────

  describe("insufficient data", () => {
    it("returns template when less than 7 sleep records", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 3, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("dados suficientes");
      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });

    it("returns template when 0 sleep records", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 0, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("dados suficientes");
    });

    it("includes continuation encouragement", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 5, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("registrando");
    });

    it("sets bypassLlm=true and bypassReason=insufficient_data", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 3, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights, makeExtra());
      const persistence = result.persistence as Record<string, unknown>;
      expect(persistence.bypassLlm).toBe(true);
      expect(persistence.bypassReason).toBe("insufficient_data");
    });

    it("sets source='template_insufficient' for insufficient data", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 3, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights, makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      expect(narrative.source).toBe("template_insufficient");
    });
  });

  // ── OpenAI API call ───────────────────────────────────────────────────

  describe("OpenAI Responses API integration", () => {
    it("calls Responses API with correct parameters", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights(), makeExtra());

      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          store: false,
          max_output_tokens: 4096,
          text: expect.objectContaining({
            format: expect.objectContaining({
              type: "json_schema",
              strict: true,
            }),
          }),
        }),
      );
    });

    it("uses configurable model via env var", async () => {
      process.env.OPENAI_NARRATIVE_MODEL = "gpt-4.1-mini";
      vi.resetModules();
      const mod = await import("./generateNarrative");
      const gen = mod.generateNarrative as unknown as (insights: unknown, extra: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await gen(makeInsights(), makeExtra());
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4.1-mini" }),
      );
    });

    it("includes reasoning param for gpt-5.x models", async () => {
      process.env.OPENAI_NARRATIVE_MODEL = "gpt-5.2";
      vi.resetModules();
      const mod = await import("./generateNarrative");
      const gen = mod.generateNarrative as unknown as (insights: unknown, extra: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await gen(makeInsights(), makeExtra());
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reasoning: { effort: "medium" } }),
      );
    });

    it("includes few-shot examples before user message", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights(), makeExtra());

      const call = mockResponsesCreate.mock.calls[0][0];
      // 6 few-shot messages (3 user + 3 assistant) + 1 real user message = 7
      expect(call.input.length).toBe(7);
      expect(call.input[0].role).toBe("user");
      expect(call.input[1].role).toBe("assistant");
      expect(call.input[6].role).toBe("user");
      // Last message is the real user prompt with actual evidence
      expect(call.input[6].content).toContain("riskLevel");
    });

    it("excludes reasoning param for gpt-4.x models", async () => {
      process.env.OPENAI_NARRATIVE_MODEL = "gpt-4.1";
      vi.resetModules();
      const mod = await import("./generateNarrative");
      const gen = mod.generateNarrative as unknown as (insights: unknown, extra: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await gen(makeInsights(), makeExtra());
      const call = mockResponsesCreate.mock.calls[0][0];
      expect(call.reasoning).toBeUndefined();
    });

    it("rejects non-allowlisted model and falls back to default", async () => {
      process.env.OPENAI_NARRATIVE_MODEL = "ft:gpt-4o-mini:evil:2024";
      vi.resetModules();
      const mod = await import("./generateNarrative");
      const gen = mod.generateNarrative as unknown as (insights: unknown, extra: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await gen(makeInsights(), makeExtra());
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-5.4" }),
      );
    });
  });

  // ── Response handling ─────────────────────────────────────────────────

  describe("response handling", () => {
    it("returns safe fallback on incomplete response", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "failed",
        output: [],
        output_text: null,
      });

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on refusal", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal", refusal: "Cannot comply" }] }],
        output_text: null,
      });

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on empty output_text", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: "",
      });

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on invalid JSON", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: "not json",
      });

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns safe fallback when Zod validation fails", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        schemaVersion: "narrative_v2",
        overview: { headline: "ok", summary: "ok", dataQualityNote: "", evidenceIds: [] },
        sections: {}, // missing required sections
        actions: { shareWithProfessional: false, practicalSuggestions: [] },
        closing: { text: "ok" },
      }));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on oversized response (>20KB)", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: "x".repeat(21_000),
      });

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on API exception", async () => {
      mockResponsesCreate.mockRejectedValue(new Error("API timeout"));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("returns valid V2 result on successful response", async () => {
      const v2 = makeValidV2Narrative();
      mockResponsesCreate.mockResolvedValue(makeValidResponse(v2));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.headline).toBe(v2.overview.headline);
      expect(overview.summary).toBe(v2.overview.summary);
      expect(narrative.generatedAt).toBeDefined();
    });

    it("sets source='llm' on successful LLM response", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      expect(narrative.source).toBe("llm");
    });

    it("sets source='fallback' on API failure", async () => {
      mockResponsesCreate.mockRejectedValue(new Error("API timeout"));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      expect(narrative.source).toBe("fallback");
    });

    it("includes persistence metadata on successful response", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const persistence = result.persistence as Record<string, unknown>;
      expect(persistence.guardrailPassed).toBe(true);
      expect(persistence.bypassLlm).toBe(false);
      expect(persistence.sourceFingerprint).toBeDefined();
      expect(persistence.promptVersion).toBe("v2");
      expect(persistence.schemaVersion).toBe("narrative_v2");
    });

    it("sets guardrailPassed=false on failures", async () => {
      mockResponsesCreate.mockRejectedValue(new Error("fail"));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const persistence = result.persistence as Record<string, unknown>;
      expect(persistence.guardrailPassed).toBe(false);
      expect((persistence.guardrailViolations as string[]).length).toBeGreaterThan(0);
    });
  });

  // ── Forbidden content in LLM response ────────────────────────────────

  describe("forbidden content detection in response", () => {
    it("falls back when response contains medication name", async () => {
      const v2 = makeValidV2Narrative({ summary: "Considere conversar sobre o lítio com seu médico." });
      mockResponsesCreate.mockResolvedValue(makeValidResponse(v2));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("falls back when response contains diagnostic phrasing", async () => {
      const v2 = makeValidV2Narrative({ summary: "Seus dados sugerem um episódio depressivo." });
      mockResponsesCreate.mockResolvedValue(makeValidResponse(v2));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("falls back when section contains condition names", async () => {
      const v2 = makeValidV2Narrative();
      // Inject forbidden content into a section
      (v2 as Record<string, unknown>).sections = {
        ...(v2 as Record<string, unknown>).sections as object,
        mood: { status: "notable", title: "Humor", summary: "Possível mania identificada nos dados.", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
      };
      mockResponsesCreate.mockResolvedValue(makeValidResponse(v2));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("Não foi possível");
    });

    it("accepts safe clinical language", async () => {
      const v2 = makeValidV2Narrative({
        summary: "Seus dados mostram que o humor ficou abaixo da média nos últimos 7 dias.",
      });
      mockResponsesCreate.mockResolvedValue(makeValidResponse(v2));

      const result = await generateNarrative(makeInsights(), makeExtra());
      const narrative = result.narrative as Record<string, unknown>;
      const overview = narrative.overview as Record<string, string>;
      expect(overview.summary).toContain("humor ficou abaixo");
    });
  });

  // ── prepareNarrativeInput via integration ──────────────────────────────

  describe("data preparation (integration)", () => {
    it("sends NarrativeInputV2 structure to the model", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights(), makeExtra());

      const call = mockResponsesCreate.mock.calls[0][0];
      const userContent = call.input[call.input.length - 1].content;
      expect(userContent).toContain("riskLevel");
      expect(userContent).toContain("sections");
      expect(userContent).toContain("evidence");
    });

    it("includes sleep evidence when data available", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights(), makeExtra());

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain("7.2");
      expect(userContent).toContain("Sono");
    });

    it("includes correlation as evidence", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights({
        chart: { correlation: { rho: 0.65, strength: "forte", direction: "positiva", confidence: "alta" } },
      }), makeExtra());

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain("0.65");
      expect(userContent).toContain("correlations");
    });

    it("maps risk levels correctly", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights({
        risk: { level: "atencao", score: 50, factors: ["x"] },
      }), makeExtra());

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain('"moderate"');
    });

    it("includes cycling info when rapid cycling detected", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights({
        cycling: { isRapidCycling: true, polaritySwitches: 5 },
      }), makeExtra());

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain("polaridade");
      expect(userContent).toContain("5");
    });

    it("includes seasonality when pattern exists", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      await generateNarrative(makeInsights({
        seasonality: { hasSeasonalPattern: true, description: "Inverno: humor mais baixo" },
      }), makeExtra());

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain("Inverno");
    });

    it("includes assessment evidence when provided", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      const extra = {
        assessments: [
          { date: "2026-03-17", asrmTotal: 4, phq9Total: 6, phq9Item9: 0, fastAvg: 3.8 },
          { date: "2026-03-10", asrmTotal: 3, phq9Total: 7, phq9Item9: 0, fastAvg: 3.5 },
        ],
        lifeEvents: [],
        cognitiveTests: [],
      };

      await generateNarrative(makeInsights(), extra);

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain("assess");
      expect(userContent).toContain("6"); // phq9Total
    });

    it("includes life event evidence with sanitized phrases", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      const extra = {
        assessments: [],
        lifeEvents: [{ date: "2026-03-15", eventType: "therapy" }],
        cognitiveTests: [],
      };

      await generateNarrative(makeInsights(), extra);

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).toContain("sessão de terapia");
    });

    it("drops unknown life event types (fail-closed)", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse(makeValidV2Narrative()));

      const extra = {
        assessments: [],
        lifeEvents: [{ date: "2026-03-15", eventType: "unknown_type_xyz" }],
        cognitiveTests: [],
      };

      await generateNarrative(makeInsights(), extra);

      const userContent = mockResponsesCreate.mock.calls[0][0].input.at(-1).content;
      expect(userContent).not.toContain("unknown_type_xyz");
    });
  });
});
