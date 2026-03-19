import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for generateNarrative — deterministic paths, high-risk template,
 * insufficient data bypass, prepareInsightsForPrompt logic, and OpenAI
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
      anchors: {
        wake: { label: "Acordar", variance: 20, regularityScore: 80 },
        sleep: { label: "Dormir", variance: 25, regularityScore: 75 },
      },
      alerts: [],
    },
    chart: {
      correlation: { rho: 0.45, strength: "moderada", direction: "positiva" },
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

function makeValidResponse(content: object) {
  return {
    status: "completed",
    output: [{ type: "message", content: [{ type: "text" }] }],
    output_text: JSON.stringify(content),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("generateNarrative — deterministic paths", () => {
  let generateNarrative: (insights: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_NARRATIVE_MODEL;
    vi.resetModules();
    const mod = await import("./generateNarrative");
    generateNarrative = mod.generateNarrative as (insights: unknown) => Promise<unknown>;
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

      const result = await generateNarrative(insights) as Record<string, unknown>;
      expect(result.summary).toContain("atenção especial");
      // Phrase bank maps keys to safe descriptions
      expect(result.summary).toContain("horários de sono muito irregulares");
      expect(result.summary).toContain("oscilação de humor acima do esperado");
      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });

    it("drops unknown factors (fail-closed) and uses fallback", async () => {
      const factors = ["unknown_factor_1", "unknown_factor_2", "unknown_factor_3"];
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 90, factors },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      // Unknown keys are silently dropped — fallback text used
      expect(result.summary).toContain("múltiplos indicadores elevados");
      // Raw factor text should NOT appear in output (phrase bank is fail-closed)
      for (const f of factors) {
        expect(result.summary).not.toContain(f);
      }
    });

    it("uses fallback text when no factors provided", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 80, factors: [] },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      expect(result.summary).toContain("múltiplos indicadores elevados");
    });

    it("always includes generatedAt ISO date", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt as string).toISOString()).toBe(result.generatedAt);
    });

    it("includes professional contact suggestion", async () => {
      const insights = makeInsights({
        risk: { level: "atencao_alta", score: 85, factors: ["x"] },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      const suggestions = result.suggestions as string[];
      expect(suggestions.some((s) => s.includes("profissional"))).toBe(true);
    });
  });

  // ── Insufficient data bypass ──────────────────────────────────────────

  describe("insufficient data", () => {
    it("returns template when less than 7 sleep records", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 3, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      expect(result.summary).toContain("dados suficientes");
      expect(mockResponsesCreate).not.toHaveBeenCalled();
    });

    it("returns template when 0 sleep records", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 0, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      expect(result.summary).toContain("dados suficientes");
    });

    it("includes continuation encouragement", async () => {
      const insights = makeInsights({
        sleep: { recordCount: 5, alerts: [], dataConfidence: "low" },
      });

      const result = await generateNarrative(insights) as Record<string, unknown>;
      expect(result.summary).toContain("registrando");
    });
  });

  // ── OpenAI API call ───────────────────────────────────────────────────

  describe("OpenAI Responses API integration", () => {
    it("calls Responses API with correct parameters", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Seus dados estão estáveis.",
        highlights: ["Sono regular", "Humor estável", "Boa adesão"],
        suggestions: ["Continue o registro diário", "Mantenha a rotina"],
      }));

      await generateNarrative(makeInsights());

      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          store: false, // LGPD
          max_output_tokens: 2048,
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
      const gen = mod.generateNarrative as (insights: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Test", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await gen(makeInsights());
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4.1-mini" }),
      );
    });

    it("includes reasoning param for gpt-5.x models", async () => {
      process.env.OPENAI_NARRATIVE_MODEL = "gpt-5.2";
      vi.resetModules();
      const mod = await import("./generateNarrative");
      const gen = mod.generateNarrative as (insights: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Test", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await gen(makeInsights());
      expect(mockResponsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reasoning: { effort: "low" } }),
      );
    });

    it("excludes reasoning param for gpt-4.x models", async () => {
      process.env.OPENAI_NARRATIVE_MODEL = "gpt-4.1";
      vi.resetModules();
      const mod = await import("./generateNarrative");
      const gen = mod.generateNarrative as (insights: unknown) => Promise<unknown>;

      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Test", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await gen(makeInsights());
      const call = mockResponsesCreate.mock.calls[0][0];
      expect(call.reasoning).toBeUndefined();
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

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on refusal", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal", refusal: "Cannot comply" }] }],
        output_text: null,
      });

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on empty output_text", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: "",
      });

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on invalid JSON", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: "not json",
      });

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns safe fallback when Zod validation fails", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "ok",
        highlights: [], // min 3 required
        suggestions: ["x", "y"],
      }));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on oversized response (>10KB)", async () => {
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: "x".repeat(11_000),
      });

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns safe fallback on API exception", async () => {
      mockResponsesCreate.mockRejectedValue(new Error("API timeout"));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("returns valid result on successful response", async () => {
      const narrative = {
        summary: "Seus dados dos últimos 30 dias mostram padrões estáveis.",
        highlights: ["Sono regular de 7.2h", "Humor estável", "Boa adesão à medicação"],
        suggestions: ["Continue registrando diariamente", "Mantenha a rotina de sono"],
      };
      mockResponsesCreate.mockResolvedValue(makeValidResponse(narrative));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toBe(narrative.summary);
      expect(result.highlights).toEqual(narrative.highlights);
      expect(result.suggestions).toEqual(narrative.suggestions);
      expect(result.generatedAt).toBeDefined();
    });
  });

  // ── Forbidden content in LLM response ────────────────────────────────

  describe("forbidden content detection in response", () => {
    it("falls back when response contains medication name", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Considere conversar sobre o lítio com seu médico.",
        highlights: ["Sono ok", "Humor ok", "Adesão ok"],
        suggestions: ["Registre diariamente", "Mantenha rotina"],
      }));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("falls back when response contains diagnostic phrasing", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Seus dados sugerem um episódio depressivo.",
        highlights: ["Indicador x", "Indicador y", "Indicador z"],
        suggestions: ["Ação 1", "Ação 2"],
      }));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("falls back when highlights contain condition names", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Dados estáveis.",
        highlights: ["Possível mania identificada", "Sono ok", "Humor ok"],
        suggestions: ["Registre", "Mantenha"],
      }));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("Não foi possível");
    });

    it("accepts safe clinical language", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Seus dados mostram que o humor ficou abaixo da média nos últimos 7 dias. Pode ser interessante compartilhar esses dados com seu profissional de referência.",
        highlights: ["Sono médio de 7.2h", "Humor abaixo da média", "Rotina regular"],
        suggestions: ["Continue registrando", "Mantenha horários regulares"],
      }));

      const result = await generateNarrative(makeInsights()) as Record<string, unknown>;
      expect(result.summary).toContain("humor ficou abaixo");
    });
  });

  // ── prepareInsightsForPrompt via integration ──────────────────────────

  describe("data preparation (integration)", () => {
    it("sends NarrativeInput structure to the model", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Ok.", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await generateNarrative(makeInsights());

      const call = mockResponsesCreate.mock.calls[0][0];
      const userContent = call.input[0].content;
      // Should contain structured facts, not raw InsightsResult
      expect(userContent).toContain("riskLevel");
      expect(userContent).toContain("facts");
      expect(userContent).toContain("cooccurrences");
    });

    it("includes sleep facts when data available", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Ok.", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await generateNarrative(makeInsights());

      const userContent = mockResponsesCreate.mock.calls[0][0].input[0].content;
      expect(userContent).toContain("7.2");
      expect(userContent).toContain("Sono");
    });

    it("includes correlation as cooccurrence", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Ok.", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await generateNarrative(makeInsights({
        chart: { correlation: { rho: 0.65, strength: "forte", direction: "positiva" } },
      }));

      const userContent = mockResponsesCreate.mock.calls[0][0].input[0].content;
      expect(userContent).toContain("0.65");
      expect(userContent).toContain("cooccurrences");
    });

    it("maps risk levels correctly", async () => {
      // atencao → moderate (but atencao_alta is handled before this)
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Ok.", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await generateNarrative(makeInsights({
        risk: { level: "atencao", score: 50, factors: ["x"] },
      }));

      const userContent = mockResponsesCreate.mock.calls[0][0].input[0].content;
      expect(userContent).toContain('"moderate"');
    });

    it("includes cycling info when rapid cycling detected", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Ok.", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await generateNarrative(makeInsights({
        cycling: { isRapidCycling: true, polaritySwitches: 5 },
      }));

      const userContent = mockResponsesCreate.mock.calls[0][0].input[0].content;
      expect(userContent).toContain("polaridade");
      expect(userContent).toContain("5");
    });

    it("includes seasonality when pattern exists", async () => {
      mockResponsesCreate.mockResolvedValue(makeValidResponse({
        summary: "Ok.", highlights: ["a", "b", "c"], suggestions: ["x", "y"],
      }));

      await generateNarrative(makeInsights({
        seasonality: { hasSeasonalPattern: true, description: "Inverno: humor mais baixo" },
      }));

      const userContent = mockResponsesCreate.mock.calls[0][0].input[0].content;
      expect(userContent).toContain("Inverno");
    });
  });
});
