import Anthropic from "@anthropic-ai/sdk";
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
5. Relacione sono, humor, ritmo e medicação entre si quando houver correlação.
6. Para scores de risco elevado, incentive contato com o profissional sem causar pânico.
7. Respostas SEMPRE em pt-BR.

FORMATO DE RESPOSTA (JSON estrito):
{
  "summary": "2-3 parágrafos narrativos conectando os principais achados",
  "highlights": ["3-5 pontos-chave como frases curtas"],
  "suggestions": ["2-3 sugestões práticas e acionáveis"]
}`;

  const userPrompt = `Analise os seguintes dados de monitoramento dos últimos 30 dias e gere uma narrativa interpretativa para o paciente:\n\n${JSON.stringify(data, null, 2)}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Extract JSON from response (may have markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      summary: parsed.summary || "",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Fallback: use the raw text as summary
    return {
      summary: text.slice(0, 2000),
      highlights: [],
      suggestions: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
