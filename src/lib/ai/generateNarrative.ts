import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import type { InsightsResult } from "@/lib/insights/computeInsights";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface NarrativeResult {
  summary: string;       // 2-3 paragraph narrative in pt-BR
  highlights: string[];  // 3-5 key takeaways as bullet points
  suggestions: string[]; // 2-3 actionable suggestions
  generatedAt: string;   // ISO date
}

const narrativeSchema = z.object({
  summary: z.string().min(1).max(5000),
  highlights: z.array(z.string().max(500)).max(10),
  suggestions: z.array(z.string().max(500)).max(10),
});

/** Phrases that violate clinical guardrails — if present, fall back. */
const FORBIDDEN_PATTERNS = [
  /\bdiagn[oó]stic/i,
  /\bajust(?:e|ar|ando)\s+(?:a\s+)?medica[çc][ãa]o/i,
  /\bvoc[êe]\s+(?:tem|possui|sofre\s+de)\s+/i,
  /\bcausa(?:do|da|r)\s+(?:por|pelo|pela)\b/i,
  /\brecomend(?:o|amos)\s+(?:que\s+)?(?:par|tom|aument|diminu)/i,
];

function containsForbiddenContent(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

function getSafeFallback(): NarrativeResult {
  return {
    summary: "Não foi possível gerar o resumo neste momento. Consulte os dados numéricos nos cards acima e converse com seu profissional de saúde sobre as tendências observadas.",
    highlights: [],
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
1. NUNCA faça diagnósticos. Use linguagem como "os dados sugerem", "pode indicar", "é possível que".
2. SEMPRE reforce que a interpretação clínica deve ser feita pelo profissional de saúde.
3. Use linguagem acolhedora e não-alarmista, mesmo para dados preocupantes.
4. Seja específico: cite números e tendências dos dados fornecidos.
5. Descreva coocorrências observadas entre sono, humor, ritmo e medicação, sem inferir efeito clínico.
6. Para scores de risco elevado, incentive contato com o profissional sem causar pânico.
7. Respostas SEMPRE em pt-BR.
8. NUNCA infira causalidade clínica de uma correlação estatística.
9. NUNCA sugira ajuste de medicação ou comportamento como se fosse recomendação clínica.

Responda APENAS com JSON válido no formato:
{"summary": "string", "highlights": ["string"], "suggestions": ["string"]}`;

  const userPrompt = `Analise os seguintes dados de monitoramento dos últimos 30 dias e gere uma narrativa interpretativa para o paciente:\n\n${JSON.stringify(data, null, 2)}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Guard: reject oversized responses (>10KB)
    if (text.length > 10_000) return getSafeFallback();

    // Try parsing the response as JSON directly first
    let raw: unknown = null;
    try {
      raw = JSON.parse(text);
    } catch {
      // If direct parse fails, try extracting JSON from markdown fences
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch?.[1]) {
        try {
          raw = JSON.parse(jsonMatch[1].trim());
        } catch {
          // Last resort: find outermost braces
          const braceMatch = text.match(/\{[\s\S]*\}/);
          if (braceMatch) {
            raw = JSON.parse(braceMatch[0]);
          }
        }
      }
    }

    if (!raw) return getSafeFallback();

    // Validate with zod schema
    const parsed = narrativeSchema.safeParse(raw);
    if (!parsed.success) return getSafeFallback();

    const { summary, highlights, suggestions } = parsed.data;

    if (!summary && highlights.length === 0) return getSafeFallback();

    // Check for forbidden clinical content
    const allText = [summary, ...highlights, ...suggestions].join(" ");
    if (containsForbiddenContent(allText)) return getSafeFallback();

    return {
      summary,
      highlights,
      suggestions,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return getSafeFallback();
  }
}
