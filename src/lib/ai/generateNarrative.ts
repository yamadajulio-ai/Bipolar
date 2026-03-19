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
  summary: z.string().min(1).max(1800),
  highlights: z.array(z.string().min(1).max(180)).min(3).max(5),
  suggestions: z.array(z.string().min(1).max(180)).min(2).max(3),
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
 *
 * Per GPT Pro audit: patterns run against normalized text (lowercase, no accents,
 * collapsed spaces) to catch unaccented and colloquial pt-BR variations.
 */
const FORBIDDEN_PATTERNS = [
  /\bdiagnostic/,
  /\bajust(?:e|ar|ando)\s+(?:(?:a|de)\s+)?medicacao/,
  /\bvoce\s+(?:tem|possui|sofre\s+de)\s+/,
  /\bcausa(?:do|da|dos|das|r)\s+(?:por|pelo|pela)\b/,
  /\brecomend(?:o|amos)\s+(?:que\s+)?(?:par|tom|aument|diminu)/,
  // Indirect diagnostic phrasing
  /\bsina(?:l|is)\s+compative(?:l|is)\s+com\b/,
  /\bpadrao\s+sugestivo\s+de\b/,
  /\bquadro\s+(?:clinico\s+)?(?:compativel|indicativo|sugestivo)\b/,
  /\bcaracteristic(?:o|a)s?\s+de\s+(?:um|uma)?\s*(?:episodio|transtorno|fase)\b/,
  /\bperfil\s+(?:clinico|compativel)\b/,
  /\bconfirma(?:r|m|ndo|cao)\s+(?:(?:de|um|uma)\s+)?(?:diagnostic|transtorno|episodio)\b/,
  /\b(?:interromp|suspend|retir)(?:a|e|ar|ir|er)\s+(?:a\s+)?medicacao\b/,
  // Prescriptive language disguised as observation
  /\bvoce\s+(?:deve|precisa|deveria)\s+(?:procurar|buscar|ir)\s+(?:um|ao)\s+(?:medic|psiqui)/,
  /\b(?:claramente|evidentemente|obviamente)\s+(?:um|uma)\s+(?:episodio|crise|fase)\b/,
  // Explicit medication names — generic and common brand names (Brazil market)
  /\b(?:litio|carbolitium|carbamazepina|tegretol|valproato|depakote|depakene|lamotrigina|lamictal|quetiapina|seroquel|olanzapina|zyprexa|risperidona|risperdal|aripiprazol|abilify|clozapina|clozaril|haloperidol|haldol|topiramato|topamax|fluoxetina|prozac|sertralina|zoloft|escitalopram|lexapro|venlafaxina|effexor|duloxetina|cymbalta|bupropiona|wellbutrin|clonazepam|rivotril|diazepam|valium|alprazolam|frontal|lorazepam)\b/,
  // Drug classes and generic therapeutic terms
  /\b(?:estabilizador(?:es)?\s+(?:de\s+|do\s+)?humor|antipsicotico|neuroleptico|antidepressivo|ansiolitico|benzodiazepinico|anticonvulsivante|psicofarma)/,
  // BAN condition/episode/disorder names outright
  /\b(?:depressao|mania|hipomania|maniaco|hipomaniaco|ciclotimia|distimia|psicose|psicotico|eutimia|ansiedade\s+generalizada)\b/,
  /\b(?:episodio|transtorno|sindrome)\s+(?:bipolar|depressiv[oa]|maniac[oa]|mist[oa]|afetiv[oa])\b/,
  // Speculative clinical language
  /\b(?:indica[mn]?|sugere[mn]?|aponta[mn]?\s+para|compative(?:l|is)\s+com)\s+(?:um|uma)?\s*(?:episodio|transtorno|quadro|crise|fase|sindrome)\b/,
];

/**
 * Normalize text for safety check: lowercase, strip accents, collapse whitespace.
 * This catches unaccented and colloquial pt-BR variations that would bypass
 * accent-dependent regex.
 */
function normalizeForSafetyCheck(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacriticals
    .replace(/\s+/g, " ")
    .trim();
}

function containsForbiddenContent(text: string): boolean {
  const normalized = normalizeForSafetyCheck(text);
  return FORBIDDEN_PATTERNS.some((p) => p.test(normalized));
}

function getSafeFallback(): NarrativeResult {
  return {
    summary: "Não foi possível gerar o resumo neste momento. Consulte os dados numéricos nos cards acima e converse com seu profissional de saúde sobre as tendências observadas.\n\nSeus registros continuam sendo salvos normalmente — tente gerar o resumo novamente mais tarde.",
    highlights: [
      "O resumo não pôde ser gerado neste momento",
      "Seus dados estão seguros e disponíveis nos cards acima",
      "Tente novamente em alguns minutos",
    ],
    suggestions: ["Revise os dados numéricos dos insights acima", "Converse com seu profissional sobre as tendências"],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Phrase bank for risk factors — maps upstream factor keys to pre-approved
 * patient-safe descriptions. Any factor not in the bank is dropped (fail-closed).
 * This prevents clinical language from leaking through risk.factors.
 */
const RISK_FACTOR_PHRASES: Record<string, string> = {
  // Sleep
  "sono_insuficiente": "duração do sono abaixo do esperado",
  "sono_excessivo": "duração do sono acima do esperado",
  "irregularidade_sono": "horários de sono muito irregulares",
  "privacao_sono": "poucos registros de sono nos últimos dias",
  "variabilidade_alta": "grande variação na duração do sono",
  // Mood
  "humor_baixo": "humor abaixo da média nos últimos dias",
  "humor_elevado": "humor acima da média nos últimos dias",
  "oscilacao_alta": "oscilação de humor acima do esperado",
  "amplitude_extrema": "variações amplas de humor registradas",
  // Medication
  "adesao_baixa": "adesão ao tratamento abaixo do esperado",
  // Risk
  "risco_elevado": "indicadores gerais de atenção elevados",
  "item9_positivo": "respostas que merecem atenção especial",
  // Generic
  "multiplos_indicadores": "múltiplos indicadores elevados",
};

/**
 * Sanitize risk factors through phrase bank — only pre-approved text reaches the patient.
 * Unknown factors are silently dropped (fail-closed, not fail-open).
 */
function sanitizeRiskFactors(factors: string[]): string {
  const safe = factors
    .map((f) => RISK_FACTOR_PHRASES[f])
    .filter(Boolean);
  return safe.length > 0 ? safe.join("; ") : "múltiplos indicadores elevados";
}

/**
 * High-risk template — bypasses LLM entirely when risk level is "atencao_alta".
 * Prevents hallucination on critical data and ensures deterministic safe output.
 * All factor text passes through phrase bank — no raw upstream strings reach the patient.
 */
function getHighRiskTemplate(data: Record<string, unknown>): NarrativeResult {
  const risk = data.risk as { score: number; factors: string[] } | null;
  const factorsText = sanitizeRiskFactors(risk?.factors || []);

  return {
    summary: `Seus dados dos últimos 30 dias apresentam indicadores que merecem atenção especial. Os fatores identificados incluem: ${factorsText}. Pode ser interessante compartilhar esses dados com seu profissional de referência.\n\nLembre-se: esses dados são ferramentas de acompanhamento e não substituem a avaliação clínica. Seu profissional poderá interpretar esses padrões dentro do contexto completo da sua saúde.`,
    highlights: [
      "Seus indicadores merecem atenção — converse com seu profissional",
      `Fatores identificados: ${factorsText}`,
      "Os dados numéricos nos cards acima trazem mais detalhes",
    ],
    suggestions: [
      "Compartilhe esses dados com seu profissional de saúde na próxima consulta",
      "Continue registrando seus dados diariamente — isso ajuda no acompanhamento",
    ],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic narrative input — the model's job is ONLY to verbalize these facts.
 * No raw numbers for the model to "interpret" — all interpretation is done in code.
 *
 * Per GPT Pro audit: "reduce model responsibility. The model should verbalize facts,
 * not decide risk, infer causality, or discover clinical hypotheses."
 */
interface NarrativeInput {
  riskLevel: "low" | "moderate" | "high";
  dataQuality: "ok" | "insufficient";
  facts: string[];
  cooccurrences: string[];
  alerts: string[];
}

function prepareInsightsForPrompt(insights: InsightsResult): NarrativeInput {
  const facts: string[] = [];
  const cooccurrences: string[] = [];
  const alerts: string[] = [];

  // ── Helpers for pt-BR labels ──
  const trendLabel = (t: string | null) =>
    t === "rising" ? "subindo" : t === "falling" ? "caindo" : t === "stable" ? "estável" : t;
  const confidenceLabel = (c: string) =>
    c === "high" ? "alta" : c === "medium" ? "média" : c === "low" ? "baixa" : c;

  // ── Sleep facts ──
  const s = insights.sleep;
  if (s.recordCount > 0) {
    if (s.avgDuration != null) facts.push(`Sono médio: ${s.avgDuration.toFixed(1)} horas (${s.recordCount} registros, confiança ${confidenceLabel(s.dataConfidence)})`);
    if (s.sleepTrend) facts.push(`Tendência do sono: ${trendLabel(s.sleepTrend)}${s.sleepTrendDelta ? ` (variação de ${s.sleepTrendDelta.toFixed(1)}h)` : ""}`);
    if (s.bedtimeVariance != null) facts.push(`Variação do horário de dormir: ${s.bedtimeVariance} minutos`);
    if (s.durationVariability != null) facts.push(`Variabilidade da duração do sono: ${s.durationVariability} minutos`);
    if (s.avgQuality != null) facts.push(`Qualidade média do sono: ${s.avgQuality.toFixed(1)}/5`);
    if (s.midpoint) facts.push(`Ponto médio do sono: ${s.midpoint}`);
    if (s.socialJetLag != null && s.socialJetLag > 30) facts.push(`Jet lag social: ${s.socialJetLag} minutos`);
    if (s.sleepHeadline) facts.push(`Resumo do sono: ${s.sleepHeadline}`);
    for (const a of s.alerts || []) alerts.push(`${a.title}: ${a.message}`);
  }

  // ── Mood facts ──
  const m = insights.mood;
  if (m.moodHeadline) facts.push(`Resumo do humor: ${m.moodHeadline}`);
  if (m.moodTrend) facts.push(`Tendência do humor: ${trendLabel(m.moodTrend)}`);
  if (m.moodAmplitude != null) facts.push(`Oscilação do humor: ${m.moodAmplitude} (${m.moodAmplitudeLabel || ""})`);
  if (m.medicationAdherence != null) facts.push(`Adesão à medicação: ${Math.round(m.medicationAdherence * 100)}%`);
  if (m.topWarningSigns?.length) facts.push(`Sinais de atenção mais frequentes: ${m.topWarningSigns.join(", ")}`);
  for (const a of m.alerts || []) alerts.push(`${a.title}: ${a.message}`);

  // ── Thermometer facts ──
  const t = insights.thermometer;
  if (t) {
    facts.push(`Posição no termômetro: ${t.position}/100 (zona: ${t.zoneLabel})`);
    if (t.instability != null) facts.push(`Instabilidade: ${t.instability}`);
    if (t.mixedFeatures) facts.push("Características mistas identificadas nos dados");
    if (t.factors?.length) facts.push(`Fatores do termômetro: ${t.factors.join(", ")}`);
  }

  // ── Rhythm facts ──
  const r = insights.rhythm;
  facts.push(`Regularidade geral da rotina: ${r.overallRegularity}/100`);
  for (const [, anchor] of Object.entries(r.anchors)) {
    if (anchor.variance != null) {
      facts.push(`${anchor.label}: variação de ${anchor.variance} min, regularidade ${anchor.regularityScore}/100`);
    }
  }
  for (const a of r.alerts || []) alerts.push(`${a.title}: ${a.message}`);

  // ── Correlations (as cooccurrences, never causal) ──
  const ch = insights.chart;
  if (ch.correlation) {
    cooccurrences.push(`Associação entre sono e humor: ${ch.correlation.rho.toFixed(2)} (${ch.correlation.strength} ${ch.correlation.direction})`);
  }
  if (ch.lagCorrelation) {
    cooccurrences.push(`Associação sono da noite anterior → humor do dia seguinte: ${ch.lagCorrelation.rho.toFixed(2)} (${ch.lagCorrelation.strength} ${ch.lagCorrelation.direction})`);
  }
  for (const pattern of insights.combinedPatterns || []) {
    cooccurrences.push(`${pattern.title}: ${pattern.message}`);
  }

  // ── Risk level (deterministic, not for model to decide) ──
  const riskLevel = insights.risk?.level === "atencao_alta" ? "high" as const
    : insights.risk?.level === "atencao" ? "moderate" as const
    : "low" as const;

  // ── Prediction summary ──
  const p = insights.prediction;
  if (p && p.level !== "baixo") {
    if (p.maniaSignals?.length) alerts.push(`Sinais de elevação: ${p.maniaSignals.join(", ")}`);
    if (p.depressionSignals?.length) alerts.push(`Sinais de queda: ${p.depressionSignals.join(", ")}`);
  }

  // ── Cycling ──
  if (insights.cycling?.isRapidCycling) {
    facts.push(`Mudanças de polaridade: ${insights.cycling.polaritySwitches} nos últimos 90 dias`);
  }

  // ── Seasonality ──
  if (insights.seasonality?.hasSeasonalPattern) {
    facts.push(`Padrão sazonal: ${insights.seasonality.description}`);
  }

  // ── Data quality ──
  const dataQuality = s.recordCount < 7 ? "insufficient" as const : "ok" as const;

  return { riskLevel, dataQuality, facts, cooccurrences, alerts };
}

/**
 * Operational instructions prompt — hierarchical rules with output contract.
 * Designed for Responses API `instructions` field.
 */
const INSTRUCTIONS = `Você recebe fatos numéricos já calculados sobre monitoramento de saúde e gera um resumo em pt-BR para o paciente.

# Papel
Verbalizar fatos fornecidos no payload. Você NÃO interpreta, NÃO decide risco, NÃO descobre hipóteses.

# PROIBIÇÕES ABSOLUTAS (violar = falha)
- NUNCA nomear condições clínicas (depressão, mania, hipomania, ciclotimia, etc.).
- NUNCA fazer diagnósticos, nem tentativos ou indiretos.
- NUNCA mencionar medicamentos por nome, classe ou tipo.
- NUNCA sugerir iniciar, parar, aumentar, reduzir ou trocar tratamento.
- NUNCA inferir causalidade clínica de correlações — use "coincidiu com", "esteve associado a".
- NUNCA usar linguagem prescritiva ou imperativa para buscar profissional.
- NUNCA inventar números, datas ou tendências que não estejam no payload.
- NUNCA adicionar interpretação clínica além do que está nos fatos.

# OBRIGATÓRIO
- Use APENAS os fatos, coocorrências e alertas do payload.
- Cite os números exatamente como fornecidos.
- Linguagem acolhedora, não-alarmista, em pt-BR coloquial (público leigo).
- Se houver alertas, usar EXATAMENTE: "pode ser interessante compartilhar esses dados com seu profissional de referência".
- Finalizar com frase de acolhimento + reforço de que o app é ferramenta de acompanhamento.
- Texto curto, adequado para leitura em iPhone.

# FORMATO
- summary: exatamente 2 parágrafos curtos (separados por \\n\\n)
- highlights: 3-5 pontos-chave como frases curtas
- suggestions: 2-3 sugestões práticas do dia a dia (sem caráter clínico)`;

export async function generateNarrative(
  insights: InsightsResult,
): Promise<NarrativeResult> {
  const input = prepareInsightsForPrompt(insights);

  // High-risk: bypass LLM entirely for deterministic safe output
  if (input.riskLevel === "high") {
    Sentry.addBreadcrumb({
      message: "AI narrative: high-risk template used (bypassed LLM)",
      level: "info",
      data: { riskScore: insights.risk?.score },
    });
    return getHighRiskTemplate({ risk: insights.risk });
  }

  // Insufficient data: bypass LLM
  if (input.dataQuality === "insufficient") {
    return {
      summary: "Ainda não há dados suficientes para gerar um resumo completo. Continue registrando sono, humor e rotina nos próximos dias.\n\nQuanto mais registros você fizer, mais detalhada será a análise. O app está aqui para te acompanhar.",
      highlights: ["Menos de 7 registros de sono nos últimos 30 dias", "Continue registrando para gerar insights mais completos", "Os dados disponíveis estão nos cards acima"],
      suggestions: ["Registre seu sono e humor todos os dias por pelo menos uma semana", "Use os lembretes do app para criar o hábito"],
      generatedAt: new Date().toISOString(),
    };
  }

  const userPrompt = `Verbalize os seguintes fatos de monitoramento dos últimos 30 dias em uma narrativa para o paciente. Use APENAS os dados listados abaixo — não interprete, não infira, apenas descreva:\n\n${JSON.stringify(input, null, 2)}`;

  try {
    const model = process.env.OPENAI_NARRATIVE_MODEL || "gpt-5.4";

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
