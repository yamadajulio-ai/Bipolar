import OpenAI from "openai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import type { InsightsResult } from "@/lib/insights/computeInsights";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface NarrativeResult {
  summary: string;       // 2-3 paragraph narrative in pt-BR
  highlights: string[];  // 3-5 key takeaways as bullet points
  suggestions: string[]; // 2-3 actionable suggestions
  generatedAt: string;   // ISO date
}

const narrativeSchema = z.object({
  summary: z.string().min(1).max(5000),
  highlights: z.array(z.string().max(500)).min(1).max(5),
  suggestions: z.array(z.string().max(500)).min(1).max(3),
});

/**
 * JSON Schema for OpenAI native Structured Outputs.
 * `response_format: { type: "json_schema" }` with `strict: true` guarantees
 * 100% schema conformance at the API level — no parse heuristics needed.
 */
const NARRATIVE_JSON_SCHEMA = {
  name: "narrative",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string" as const,
        description: "2-3 paragraph narrative in pt-BR interpreting the patient's monitoring data",
      },
      highlights: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "3-5 key takeaways as bullet points",
      },
      suggestions: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "2-3 actionable suggestions for the patient",
      },
    },
    required: ["summary", "highlights", "suggestions"] as const,
    additionalProperties: false as const,
  },
};

/**
 * Phrases that violate clinical guardrails — if present, fall back.
 * Strategy: ban ALL clinical condition/episode/disorder names, even in tentative
 * phrasing like "sugere depressão" or "indícios de mania". The narrative should
 * describe DATA patterns (e.g. "humor abaixo da média"), never name conditions.
 */
const FORBIDDEN_PATTERNS = [
  /\bdiagn[oó]stic/i,
  /\bajust(?:e|ar|ando)\s+(?:a\s+)?medica[çc][ãa]o/i,
  /\bvoc[êe]\s+(?:tem|possui|sofre\s+de)\s+/i,
  /\bcausa(?:do|da|r)\s+(?:por|pelo|pela)\b/i,
  /\brecomend(?:o|amos)\s+(?:que\s+)?(?:par|tom|aument|diminu)/i,
  // Indirect diagnostic phrasing
  /\bsinais?\s+compat[ií]ve(?:l|is)\s+com\b/i,
  /\bpadr[ãa]o\s+sugestivo\s+de\b/i,
  /\bquadro\s+(?:cl[ií]nico\s+)?(?:compat[ií]vel|indicativo|sugestivo)\b/i,
  /\bcaracter[ií]stic(?:o|a)s?\s+de\s+(?:um|uma)?\s*(?:epis[oó]dio|transtorno|fase)\b/i,
  /\bperfil\s+(?:cl[ií]nico|compat[ií]vel)\b/i,
  /\bconfirma(?:r|ndo|[çc][ãa]o)\s+(?:de\s+)?(?:diagn[oó]stic|transtorno|epis[oó]dio)\b/i,
  /\b(?:interromp|suspend|retir)(?:a|e|ir|er)\s+(?:a\s+)?medica[çc][ãa]o\b/i,
  // Prescriptive language disguised as observation
  /\bvoc[êe]\s+(?:deve|precisa|deveria)\s+(?:procurar|buscar|ir)\s+(?:um|ao)\s+(?:m[ée]dic|psiqui)/i,
  /\b(?:claramente|evidentemente|obviamente)\s+(?:um|uma)\s+(?:epis[oó]dio|crise|fase)\b/i,
  // Explicit medication names — generic and common brand names
  /\b(?:l[ií]tio|carbolitium|carbamazepina|tegretol|valproato|depakote|depakene|lamotrigina|lamictal|quetiapina|seroquel|olanzapina|zyprexa|risperidona|risperdal|aripiprazol|abilify|clozapina|clozaril|haloperidol|haldol|topiramato|topamax)\b/i,
  // BAN condition/episode/disorder names outright — even in tentative phrasing.
  // The narrative must describe data patterns, never name clinical conditions.
  // This catches "sugere depressão", "indícios de mania", "possível hipomania", etc.
  /\b(?:depress[ãa]o|mania|hipomania|man[ií]ac[oa]|hipoman[ií]ac[oa]|ciclotimia|distimia|psicose|psic[oó]tic[oa])\b/i,
  /\b(?:epis[oó]dio|transtorno|s[ií]ndrome)\s+(?:bipolar|depressiv[oa]|man[ií]ac[oa]|mist[oa]|afetiv[oa])\b/i,
];

function containsForbiddenContent(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

function getSafeFallback(): NarrativeResult {
  return {
    summary: "Não foi possível gerar o resumo neste momento. Consulte os dados numéricos nos cards acima e converse com seu profissional de saúde sobre as tendências observadas.",
    highlights: ["Consulte os cards de insights para ver seus dados detalhados"],
    suggestions: ["Revise os dados numéricos dos insights acima", "Converse com seu profissional sobre as tendências"],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Summarize InsightsResult into a structured JSON object suitable for the prompt.
 * We strip large arrays (heatmap, chart data) to stay within token budget.
 */
function prepareInsightsForPrompt(insights: InsightsResult): Record<string, unknown> {
  return {
    sleep: {
      avgDuration: insights.sleep.avgDuration,
      bedtimeVariance: insights.sleep.bedtimeVariance,
      durationVariability: insights.sleep.durationVariability,
      sleepTrend: insights.sleep.sleepTrend,
      sleepTrendDelta: insights.sleep.sleepTrendDelta,
      avgQuality: insights.sleep.avgQuality,
      midpoint: insights.sleep.midpoint,
      socialJetLag: insights.sleep.socialJetLag,
      sleepHeadline: insights.sleep.sleepHeadline,
      dataConfidence: insights.sleep.dataConfidence,
      recordCount: insights.sleep.recordCount,
      alerts: insights.sleep.alerts,
    },
    mood: {
      moodTrend: insights.mood.moodTrend,
      moodAmplitude: insights.mood.moodAmplitude,
      moodAmplitudeLabel: insights.mood.moodAmplitudeLabel,
      medicationAdherence: insights.mood.medicationAdherence,
      topWarningSigns: insights.mood.topWarningSigns,
      moodHeadline: insights.mood.moodHeadline,
      alerts: insights.mood.alerts,
    },
    thermometer: insights.thermometer ? {
      position: insights.thermometer.position,
      zone: insights.thermometer.zone,
      zoneLabel: insights.thermometer.zoneLabel,
      mixedFeatures: insights.thermometer.mixedFeatures,
      mixedStrength: insights.thermometer.mixedStrength,
      instability: insights.thermometer.instability,
      factors: insights.thermometer.factors,
    } : null,
    rhythm: {
      overallRegularity: insights.rhythm.overallRegularity,
      anchors: Object.entries(insights.rhythm.anchors).map(([key, a]) => ({
        key,
        label: a.label,
        variance: a.variance,
        regularityScore: a.regularityScore,
        color: a.color,
      })),
      alerts: insights.rhythm.alerts,
    },
    chart: {
      correlation: insights.chart.correlation,
      lagCorrelation: insights.chart.lagCorrelation,
      correlationNote: insights.chart.correlationNote,
      lagCorrelationNote: insights.chart.lagCorrelationNote,
    },
    combinedPatterns: insights.combinedPatterns,
    risk: insights.risk,
    prediction: insights.prediction ? {
      maniaRisk: insights.prediction.maniaRisk,
      depressionRisk: insights.prediction.depressionRisk,
      maniaSignals: insights.prediction.maniaSignals,
      depressionSignals: insights.prediction.depressionSignals,
      level: insights.prediction.level,
      recommendations: insights.prediction.recommendations,
    } : null,
    cycling: insights.cycling ? {
      polaritySwitches: insights.cycling.polaritySwitches,
      isRapidCycling: insights.cycling.isRapidCycling,
      avgCycleLength: insights.cycling.avgCycleLength,
    } : null,
    seasonality: insights.seasonality ? {
      hasSeasonalPattern: insights.seasonality.hasSeasonalPattern,
      description: insights.seasonality.description,
    } : null,
  };
}

export async function generateNarrative(
  insights: InsightsResult,
): Promise<NarrativeResult> {
  const data = prepareInsightsForPrompt(insights);

  const systemPrompt = `Você é um assistente de saúde mental especializado em transtorno bipolar, integrado ao app "Suporte Bipolar". Seu papel é interpretar dados de monitoramento do paciente e gerar uma narrativa empática, clara e clinicamente informada em português brasileiro.

REGRAS OBRIGATÓRIAS:
1. NUNCA faça diagnósticos, nem tentativos. NUNCA nomeie condições clínicas (depressão, mania, hipomania, ciclotimia, episódio depressivo, etc.). Descreva APENAS padrões dos dados: "humor abaixo da média", "energia elevada nos últimos dias", "variação acentuada".
2. SEMPRE reforce que a interpretação clínica deve ser feita pelo profissional de saúde.
3. Use linguagem acolhedora e não-alarmista, mesmo para dados preocupantes.
4. Seja específico: cite números e tendências dos dados fornecidos.
5. Descreva coocorrências observadas entre sono, humor, ritmo e medicação, sem inferir efeito clínico.
6. Para scores de risco elevado, incentive contato com o profissional sem causar pânico.
7. Respostas SEMPRE em pt-BR.
8. NUNCA infira causalidade clínica de uma correlação estatística.
9. NUNCA sugira ajuste de medicação ou comportamento como se fosse recomendação clínica.
10. NUNCA mencione nomes de medicamentos.
11. O público é leigo — evite siglas médicas sem explicação.
12. Termine sempre com uma frase de acolhimento e reforço de que o acompanhamento profissional é essencial.`;

  const userPrompt = `Analise os seguintes dados de monitoramento dos últimos 30 dias e gere uma narrativa interpretativa para o paciente:\n\n${JSON.stringify(data, null, 2)}`;

  try {
    // GPT-5.2 with native Structured Outputs — guarantees 100% schema conformance at API level.
    // HealthBench 63.3%, 1.6% hallucination rate on hard medical cases.
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.2",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: NARRATIVE_JSON_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return getSafeFallback();

    // Guard: reject oversized responses (>10KB)
    if (content.length > 10_000) {
      Sentry.captureMessage("AI narrative response exceeded 10KB", { level: "warning", tags: { feature: "ai-narrative", reason: "oversized" } });
      return getSafeFallback();
    }

    // Parse JSON — guaranteed valid by Structured Outputs, but defense-in-depth
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      Sentry.captureMessage("AI narrative JSON parse failed", { level: "warning", tags: { feature: "ai-narrative", reason: "json-parse" } });
      return getSafeFallback();
    }

    // Validate with Zod (defense-in-depth)
    const parsed = narrativeSchema.safeParse(raw);
    if (!parsed.success) {
      Sentry.captureMessage("AI narrative Zod validation failed", { level: "warning", tags: { feature: "ai-narrative", reason: "zod-validation" } });
      return getSafeFallback();
    }

    const { summary, highlights, suggestions } = parsed.data;

    if (!summary && highlights.length === 0) {
      Sentry.captureMessage("AI narrative returned empty content", { level: "warning", tags: { feature: "ai-narrative", reason: "empty-content" } });
      return getSafeFallback();
    }

    // Check for forbidden clinical content
    const allText = [summary, ...highlights, ...suggestions].join(" ");
    if (containsForbiddenContent(allText)) {
      Sentry.captureMessage("AI narrative contained forbidden clinical content", { level: "warning", tags: { feature: "ai-narrative", reason: "forbidden-content" } });
      return getSafeFallback();
    }

    return {
      summary,
      highlights,
      suggestions,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: "ai-narrative" },
      extra: { note: "Returned safe fallback — check if model is failing" },
    });
    return getSafeFallback();
  }
}
