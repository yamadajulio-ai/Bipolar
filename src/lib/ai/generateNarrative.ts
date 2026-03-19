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
 * JSON Schema for OpenAI Responses API Structured Outputs.
 * `text.format: { type: "json_schema" }` with `strict: true` guarantees
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
  /\bajust(?:e|ar|ando)\s+(?:(?:a|de)\s+)?medica[çc][ãa]o/i,
  /\bvoc[êe]\s+(?:tem|possui|sofre\s+de)\s+/i,
  /\bcausa(?:do|da|r)\s+(?:por|pelo|pela)\b/i,
  /\brecomend(?:o|amos)\s+(?:que\s+)?(?:par|tom|aument|diminu)/i,
  // Indirect diagnostic phrasing
  /\bsina(?:l|is)\s+compat[ií]ve(?:l|is)\s+com\b/i,
  /\bpadr[ãa]o\s+sugestivo\s+de\b/i,
  /\bquadro\s+(?:cl[ií]nico\s+)?(?:compat[ií]vel|indicativo|sugestivo)\b/i,
  /\bcaracter[ií]stic(?:o|a)s?\s+de\s+(?:um|uma)?\s*(?:epis[oó]dio|transtorno|fase)\b/i,
  /\bperfil\s+(?:cl[ií]nico|compat[ií]vel)\b/i,
  /\bconfirma(?:r|ndo|[çc][ãa]o)\s+(?:de\s+)?(?:diagn[oó]stic|transtorno|epis[oó]dio)\b/i,
  /\b(?:interromp|suspend|retir)(?:a|e|ar|ir|er)\s+(?:a\s+)?medica[çc][ãa]o\b/i,
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
 * High-risk template — bypasses LLM entirely when risk level is "atencao_alta".
 * Prevents hallucination on critical data and ensures deterministic safe output.
 */
function getHighRiskTemplate(data: Record<string, unknown>): NarrativeResult {
  const risk = data.risk as { score: number; factors: string[] } | null;
  const factorsText = risk?.factors?.length
    ? risk.factors.join("; ")
    : "múltiplos indicadores elevados";

  return {
    summary: `Seus dados dos últimos 30 dias apresentam indicadores que merecem atenção especial. Os fatores identificados incluem: ${factorsText}. É importante que você converse com seu profissional de saúde sobre essas tendências o mais breve possível.\n\nLembre-se: esses dados são ferramentas de acompanhamento e não substituem a avaliação clínica. Seu profissional poderá interpretar esses padrões dentro do contexto completo da sua saúde.`,
    highlights: [
      "Seus indicadores merecem atenção — converse com seu profissional",
      `Fatores identificados: ${factorsText}`,
      "Os dados numéricos nos cards acima trazem mais detalhes",
    ],
    suggestions: [
      "Entre em contato com seu profissional de saúde para discutir essas tendências",
      "Continue registrando seus dados diariamente — isso ajuda no acompanhamento",
    ],
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

/**
 * Operational instructions prompt — hierarchical rules with output contract.
 * Designed for Responses API `instructions` field.
 */
const INSTRUCTIONS = `Você é o módulo de narrativa do app "Suporte Bipolar". Recebe JSON com dados de monitoramento de 30 dias e retorna um resumo estruturado em pt-BR.

# PROIBIÇÕES ABSOLUTAS (violar = falha)
- NUNCA nomear condições clínicas: depressão, mania, hipomania, ciclotimia, episódio depressivo, transtorno bipolar, etc.
- NUNCA fazer diagnósticos, nem tentativos ou indiretos ("sinais compatíveis com", "quadro sugestivo de", "perfil clínico de").
- NUNCA mencionar medicamentos por nome.
- NUNCA sugerir ajuste de medicação.
- NUNCA inferir causalidade clínica de correlações estatísticas.
- NUNCA usar linguagem prescritiva ("você deve procurar um psiquiatra", "recomendo que pare").

# OBRIGATÓRIO
- Descrever APENAS padrões observados nos dados: "humor abaixo da média", "sono mais curto que o habitual", "variação acentuada de energia".
- Citar números específicos dos dados fornecidos.
- Linguagem acolhedora, não-alarmista, em pt-BR coloquial (público leigo).
- Para risco elevado: incentivar contato com profissional sem causar pânico.
- Finalizar com frase de acolhimento + reforço de acompanhamento profissional.

# FORMATO DE SAÍDA
- summary: 2-3 parágrafos narrativos interpretando os dados (separados por \\n\\n)
- highlights: 3-5 pontos-chave como frases curtas
- suggestions: 2-3 sugestões acionáveis para o paciente (sem caráter clínico)`;

export async function generateNarrative(
  insights: InsightsResult,
): Promise<NarrativeResult> {
  const data = prepareInsightsForPrompt(insights);

  // High-risk template routing — bypass LLM for deterministic safe output
  const riskLevel = insights.risk?.level;
  if (riskLevel === "atencao_alta") {
    Sentry.addBreadcrumb({
      message: "AI narrative: high-risk template used (bypassed LLM)",
      level: "info",
      data: { riskScore: insights.risk?.score },
    });
    return getHighRiskTemplate(data);
  }

  const userPrompt = `Analise os seguintes dados de monitoramento dos últimos 30 dias e gere uma narrativa interpretativa para o paciente:\n\n${JSON.stringify(data, null, 2)}`;

  try {
    const model = process.env.OPENAI_NARRATIVE_MODEL || "gpt-4.1";

    // Only pass reasoning param for models that support it (gpt-5.x+)
    const supportsReasoning = model.startsWith("gpt-5") || model.startsWith("o");

    const response = await getOpenAI().responses.create({
      model,
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content: userPrompt }],
      text: {
        format: {
          type: "json_schema",
          ...NARRATIVE_JSON_SCHEMA,
        },
      },
      store: false, // LGPD: don't persist patient data on OpenAI
      ...(supportsReasoning ? { reasoning: { effort: "low" } } : {}),
      max_output_tokens: 2048,
    });

    // Handle incomplete or failed responses
    if (response.status !== "completed") {
      Sentry.captureMessage(`AI narrative response status: ${response.status}`, {
        level: "warning",
        tags: { feature: "ai-narrative", reason: response.status, model },
      });
      return getSafeFallback();
    }

    // Handle refusal (model declined to answer)
    const refusal = response.output.find(
      (item) => item.type === "message" && item.content?.some((c: { type: string }) => c.type === "refusal"),
    );
    if (refusal) {
      Sentry.captureMessage("AI narrative refused by model", {
        level: "warning",
        tags: { feature: "ai-narrative", reason: "refusal", model },
      });
      return getSafeFallback();
    }

    const content = response.output_text;
    if (!content) return getSafeFallback();

    // Guard: reject oversized responses (>10KB)
    if (content.length > 10_000) {
      Sentry.captureMessage("AI narrative response exceeded 10KB", { level: "warning", tags: { feature: "ai-narrative", reason: "oversized", model } });
      return getSafeFallback();
    }

    // Parse JSON — guaranteed valid by Structured Outputs, but defense-in-depth
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      Sentry.captureMessage("AI narrative JSON parse failed", { level: "warning", tags: { feature: "ai-narrative", reason: "json-parse", model } });
      return getSafeFallback();
    }

    // Validate with Zod (defense-in-depth)
    const parsed = narrativeSchema.safeParse(raw);
    if (!parsed.success) {
      Sentry.captureMessage("AI narrative Zod validation failed", { level: "warning", tags: { feature: "ai-narrative", reason: "zod-validation", model } });
      return getSafeFallback();
    }

    const { summary, highlights, suggestions } = parsed.data;

    if (!summary && highlights.length === 0) {
      Sentry.captureMessage("AI narrative returned empty content", { level: "warning", tags: { feature: "ai-narrative", reason: "empty-content", model } });
      return getSafeFallback();
    }

    // Check for forbidden clinical content
    const allText = [summary, ...highlights, ...suggestions].join(" ");
    if (containsForbiddenContent(allText)) {
      Sentry.captureMessage("AI narrative contained forbidden clinical content", { level: "warning", tags: { feature: "ai-narrative", reason: "forbidden-content", model } });
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
