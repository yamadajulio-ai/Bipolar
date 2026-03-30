import OpenAI from "openai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { createHash } from "crypto";
import { trackError } from "@/lib/telemetry";
import type { InsightsResult } from "@/lib/insights/computeInsights";
import type {
  NarrativeInputV2,
  NarrativeResultV2,
  NarrativeSectionOutput,
  NarrativeExtraData,
  NarrativeGenerationResult,
  NarrativePersistenceData,
  Evidence,
} from "./narrative-types";

export type { NarrativeResultV2, NarrativeGenerationResult, NarrativePersistenceData };

export const PROMPT_VERSION = "v2.1";
export const SCHEMA_VERSION = "narrative_v2";
export const ANALYTICS_VERSION = "insights_v1";
export const GUARDRAIL_VERSION = "forbidden_v1";

// Model allowlist — only approved models can be used for clinical narratives
const ALLOWED_MODELS = new Set([
  "gpt-5.4", "gpt-5.2", "gpt-5",
  "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "o4-mini", "o3", "o3-mini",
]);

const DEFAULT_MODEL = "gpt-5.4";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 90_000, // 90s — fail gracefully before Vercel's 120s maxDuration
    });
  }
  return _openai;
}

// ── Safety mechanisms (UNCHANGED from V1) ──────────────────────

export const FORBIDDEN_PATTERNS = [
  /\bdiagnostic/,
  /\bajust(?:e|ar|ando)\s+(?:(?:a|de)\s+)?medicacao/,
  /\bvoce\s+(?:tem|possui|sofre\s+de)\s+/,
  /\bcausa(?:do|da|dos|das|r)\s+(?:por|pelo|pela)\b/,
  /\brecomend(?:o|amos)\s+(?:que\s+)?(?:par|tom|aument|diminu)/,
  /\bsina(?:l|is)\s+compative(?:l|is)\s+com\b/,
  /\bpadrao\s+sugestivo\s+de\b/,
  /\bquadro\s+(?:clinico\s+)?(?:compativel|indicativo|sugestivo)\b/,
  /\bcaracteristic(?:o|a)s?\s+de\s+(?:um|uma)?\s*(?:episodio|transtorno|fase)\b/,
  /\bperfil\s+(?:clinico|compativel)\b/,
  /\bconfirma(?:r|m|ndo|cao)\s+(?:(?:de|um|uma)\s+)?(?:diagnostic|transtorno|episodio)\b/,
  /\b(?:interromp|suspend|retir)(?:a|e|ar|ir|er)\s+(?:a\s+)?medicacao\b/,
  /\bvoce\s+(?:deve|precisa|deveria)\s+(?:procurar|buscar|ir)\s+(?:um|ao)\s+(?:medic|psiqui)/,
  /\b(?:claramente|evidentemente|obviamente)\s+(?:um|uma)\s+(?:episodio|crise|fase)\b/,
  /\b(?:litio|carbolitium|carbamazepina|tegretol|valproato|depakote|depakene|lamotrigina|lamictal|quetiapina|seroquel|olanzapina|zyprexa|risperidona|risperdal|aripiprazol|abilify|clozapina|clozaril|haloperidol|haldol|topiramato|topamax|fluoxetina|prozac|sertralina|zoloft|escitalopram|lexapro|venlafaxina|effexor|duloxetina|cymbalta|bupropiona|wellbutrin|clonazepam|rivotril|diazepam|valium|alprazolam|frontal|lorazepam)\b/,
  /\b(?:estabilizador(?:es)?\s+(?:de\s+|do\s+)?humor|antipsicotico|neuroleptico|antidepressivo|ansiolitico|benzodiazepinico|anticonvulsivante|psicofarma)/,
  /\b(?:depressao|mania|hipomania|maniaco|hipomaniaco|ciclotimia|distimia|psicose|psicotico|eutimia|ansiedade\s+generalizada)\b/,
  /\b(?:episodio|transtorno|sindrome)\s+(?:bipolar|depressiv[oa]|maniac[oa]|mist[oa]|afetiv[oa])\b/,
  /\b(?:indica[mn]?|sugere[mn]?|aponta[mn]?\s+para|compative(?:l|is)\s+com)\s+(?:um|uma)?\s*(?:episodio|transtorno|quadro|crise|fase|sindrome)\b/,
  // ── Semantic false-negative patches (GPT Pro R4 audit) ──────
  /\b(?:seria\s+(?:bom|importante|necessario|ideal|prudente|hora\s+de)|considere|(?:vale|convem)\s+a?\s*pena|talvez\s+(?:fosse|seja)\s+(?:bom|importante|hora\s+de)|importante)\s+(?:conversar|falar|consultar|ir|procurar|buscar|marcar|ver)\s+(?:com\s+)?(?:um|o|ao|seu)\s*(?:medic|psiqui)/,
  /\bpolo\s+(?:depressiv[oa]|maniac[oa]|mist[oa])\b/,
  /\bciclagem\s+(?:rapida|lenta|de\s+humor)\b/,
  /\bestado\s+(?:mist[oa]|depressiv[oa]|hipomaniac[oa])\b/,
  /\bfase\s+(?:de\s+)?(?:baixa|alta|depressiv[oa]|maniac[oa]|mist[oa]|hipomaniac[oa])\b/,
  /\b(?:caracteristic[oa]s?|sintomas?|crise|quadro)\s+(?:mist[oa]s?|depressiv[oa]s?|maniac[oa]s?|hipomaniac[oa]s?|psicoticos?)\b/,
];

export function normalizeForSafetyCheck(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

export function containsForbiddenContent(text: string): boolean {
  const normalized = normalizeForSafetyCheck(text);
  return FORBIDDEN_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Post-generation quality checks (non-blocking — logs to Sentry).
 * Catches common LLM failure modes: repetition, generic suggestions, empty sections with ok input.
 */
export function runNarrativeQA(result: NarrativeResultV2, input: NarrativeInputV2): string[] {
  const warnings: string[] = [];

  // Check 1: headline/summary repetition
  const headlineNorm = normalizeForSafetyCheck(result.overview.headline);
  const summaryNorm = normalizeForSafetyCheck(result.overview.summary);
  if (headlineNorm.length >= 30 && summaryNorm.includes(headlineNorm.slice(0, 30))) {
    warnings.push("qa:headline_repeated_in_summary");
  }

  // Check 2: generic suggestions
  const genericPhrases = ["continue registrando", "registre seus dados", "mantenha o habito"];
  for (const s of result.actions.practicalSuggestions) {
    const norm = normalizeForSafetyCheck(s);
    if (genericPhrases.some(g => norm.includes(g))) {
      warnings.push("qa:generic_suggestion");
      break;
    }
  }

  // Check 3: "merecem atencao" repetition
  const allText = [result.overview.headline, result.overview.summary,
    ...Object.values(result.sections).map(s => s.summary),
    ...result.actions.practicalSuggestions, result.closing.text].join(" ");
  const atencaoCount = (normalizeForSafetyCheck(allText).match(/merece[mn]?\s+atencao/g) || []).length;
  if (atencaoCount > 1) {
    warnings.push("qa:repeated_atencao");
  }

  // Check 4: sections with ok input but absent output (potential data loss)
  const inputKeys: [string, keyof typeof input.sections][] = [
    ["sleep", "sleep"], ["mood", "mood"], ["socialRhythms", "socialRhythms"],
    ["weeklyAssessments", "assessments"], ["correlations", "correlations"], ["overallTrend", "trend"],
  ];
  for (const [outKey, inKey] of inputKeys) {
    const inSection = input.sections[inKey];
    const outSection = result.sections[outKey as keyof typeof result.sections];
    if (inSection?.status === "ok" && inSection.evidence.length >= 2 && outSection?.status === "absent") {
      warnings.push(`qa:data_loss:${outKey}`);
    }
  }

  // Check 5: closing too long (>1 sentence)
  const closingSentences = result.closing.text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (closingSentences.length > 2) {
    warnings.push("qa:closing_too_long");
  }

  // Check 6: suggestion not tied to evidence (all suggestions should reference a domain concept)
  const domainTerms = ["sono", "humor", "rotina", "horario", "avaliac", "gasto", "registro"];
  for (const s of result.actions.practicalSuggestions) {
    const norm = normalizeForSafetyCheck(s);
    if (!domainTerms.some(t => norm.includes(t)) && !norm.includes("profissional") && !norm.includes("cvv") && !norm.includes("samu")) {
      warnings.push("qa:untied_suggestion");
      break;
    }
  }

  return warnings;
}

type SectionRaw = { title: string; summary: string; keyPoints: string[]; metrics: string[]; suggestions: string[] };
type RawOutput = {
  overview: { headline: string; summary: string; dataQualityNote: string };
  sections: Record<string, SectionRaw>;
  actions: { practicalSuggestions: string[] };
  closing: { text: string };
};

function extractAllText(result: RawOutput): string {
  const texts: string[] = [result.overview.headline, result.overview.summary, result.overview.dataQualityNote];
  for (const section of Object.values(result.sections)) {
    texts.push(section.title, section.summary, ...section.keyPoints, ...section.metrics, ...section.suggestions);
  }
  texts.push(...result.actions.practicalSuggestions, result.closing.text);
  return texts.join(" ");
}

// ── Risk factor phrase bank ────────────────────────────────────

const RISK_FACTOR_PHRASES: Record<string, string> = {
  sono_insuficiente: "duração do sono abaixo do esperado",
  sono_excessivo: "duração do sono acima do esperado",
  irregularidade_sono: "horários de sono muito irregulares",
  privacao_sono: "poucos registros de sono nos últimos dias",
  variabilidade_alta: "grande variação na duração do sono",
  humor_baixo: "humor abaixo da média nos últimos dias",
  humor_elevado: "humor acima da média nos últimos dias",
  oscilacao_alta: "oscilação de humor acima do esperado",
  amplitude_extrema: "variações amplas de humor registradas",
  adesao_baixa: "adesão ao tratamento abaixo do esperado",
  risco_elevado: "indicadores gerais de atenção elevados",
  item9_positivo: "respostas que merecem atenção especial",
  multiplos_indicadores: "múltiplos indicadores elevados",
};

function sanitizeRiskFactors(factors: string[]): string {
  const safe = factors.map((f) => RISK_FACTOR_PHRASES[f]).filter(Boolean);
  return safe.length > 0 ? safe.join("; ") : "múltiplos indicadores elevados";
}

const LIFE_EVENT_PHRASES: Record<string, string> = {
  med_change: "mudança de tratamento", stressor: "evento estressante",
  travel: "viagem", hospitalization: "internação",
  therapy: "sessão de terapia", menstrual: "ciclo menstrual",
  other: "outro evento registrado",
};

// ── Zod schema V2 (defense-in-depth) ───────────────────────────

const sectionZod = z.object({
  status: z.enum(["notable", "stable", "limited", "absent"]),
  title: z.string().max(100), summary: z.string().max(600),
  keyPoints: z.array(z.string().max(200)).max(4),
  metrics: z.array(z.string().max(200)).max(5),
  suggestions: z.array(z.string().max(200)).max(3),
  evidenceIds: z.array(z.string().max(60)).max(10),
});

const narrativeV2Schema = z.object({
  schemaVersion: z.literal("narrative_v2"),
  overview: z.object({
    headline: z.string().min(1).max(200), summary: z.string().min(1).max(1200),
    dataQualityNote: z.string().max(300), evidenceIds: z.array(z.string().max(60)).max(15),
  }),
  sections: z.object({
    sleep: sectionZod, mood: sectionZod, socialRhythms: sectionZod,
    plannerContext: sectionZod, financialContext: sectionZod, cognition: sectionZod,
    weeklyAssessments: sectionZod, lifeEvents: sectionZod,
    correlations: sectionZod, overallTrend: sectionZod,
  }),
  actions: z.object({
    shareWithProfessional: z.boolean(),
    practicalSuggestions: z.array(z.string().max(200)).min(2).max(3),
  }),
  closing: z.object({ text: z.string().min(1).max(300) }),
});

// ── OpenAI JSON Schema V2 ──────────────────────────────────────

function makeSectionSchema(desc: string) {
  return {
    type: "object" as const, additionalProperties: false as const,
    required: ["status", "title", "summary", "keyPoints", "metrics", "suggestions", "evidenceIds"] as const,
    properties: {
      status: { type: "string" as const, enum: ["notable", "stable", "limited", "absent"] as const },
      title: { type: "string" as const }, summary: { type: "string" as const, description: desc },
      keyPoints: { type: "array" as const, items: { type: "string" as const } },
      metrics: { type: "array" as const, items: { type: "string" as const } },
      suggestions: { type: "array" as const, items: { type: "string" as const } },
      evidenceIds: { type: "array" as const, items: { type: "string" as const } },
    },
  };
}

const NARRATIVE_V2_JSON_SCHEMA = {
  name: "narrative_v2", strict: true,
  schema: {
    type: "object" as const, additionalProperties: false as const,
    required: ["schemaVersion", "overview", "sections", "actions", "closing"] as const,
    properties: {
      schemaVersion: { type: "string" as const, enum: ["narrative_v2"] as const },
      overview: {
        type: "object" as const, additionalProperties: false as const,
        required: ["headline", "summary", "dataQualityNote", "evidenceIds"] as const,
        properties: {
          headline: { type: "string" as const }, summary: { type: "string" as const },
          dataQualityNote: { type: "string" as const },
          evidenceIds: { type: "array" as const, items: { type: "string" as const } },
        },
      },
      sections: {
        type: "object" as const, additionalProperties: false as const,
        required: ["sleep", "mood", "socialRhythms", "plannerContext", "financialContext", "cognition", "weeklyAssessments", "lifeEvents", "correlations", "overallTrend"] as const,
        properties: {
          sleep: makeSectionSchema("Sono"), mood: makeSectionSchema("Humor"),
          socialRhythms: makeSectionSchema("Ritmos sociais"), plannerContext: makeSectionSchema("Rotina planejada"),
          financialContext: makeSectionSchema("Financeiro"), cognition: makeSectionSchema("Cognição"),
          weeklyAssessments: makeSectionSchema("Avaliações semanais"), lifeEvents: makeSectionSchema("Eventos de vida"),
          correlations: makeSectionSchema("Correlações"), overallTrend: makeSectionSchema("Tendência geral"),
        },
      },
      actions: {
        type: "object" as const, additionalProperties: false as const,
        required: ["shareWithProfessional", "practicalSuggestions"] as const,
        properties: {
          shareWithProfessional: { type: "boolean" as const },
          practicalSuggestions: { type: "array" as const, items: { type: "string" as const } },
        },
      },
      closing: {
        type: "object" as const, additionalProperties: false as const,
        required: ["text"] as const,
        properties: { text: { type: "string" as const } },
      },
    },
  },
};

// ── Instructions V2 ────────────────────────────────────────────

const INSTRUCTIONS_V2 = `Você recebe evidências estruturadas por domínio sobre monitoramento de saúde e gera uma narrativa em pt-BR para o paciente.

# PAPEL
Priorizador fiel e tradutor leigo. Sua função é ajudar a pessoa a entender o que mudou nos próprios registros, o que mais pesa neste período e qual próximo passo simples pode fazer sentido — sem diagnosticar, sem prever, sem usar causalidade clínica e sem extrapolar além das evidências.

# PROIBIÇÕES ABSOLUTAS (violar qualquer uma = falha total)
- NUNCA nomear condições clínicas (depressão, mania, hipomania, ciclotimia, distimia, psicose, eutimia, ansiedade generalizada, etc.)
- NUNCA nomear episódios ou fases clínicas (episódio depressivo, fase maníaca, estado misto, etc.)
- NUNCA fazer diagnósticos, nem tentativos, indiretos ou especulativos
- NUNCA mencionar medicamentos por nome genérico, comercial ou classe terapêutica
- NUNCA sugerir iniciar, parar, aumentar, reduzir ou trocar qualquer tratamento
- NUNCA inferir causalidade de correlações — use "coincidiu com", "esteve associado a", "aconteceu junto com"
- NUNCA usar linguagem prescritiva ou imperativa para buscar profissional (o código injeta essa frase quando necessário)
- NUNCA inventar números, datas, tendências ou fatos que não estejam no payload de evidências
- NUNCA adicionar interpretação clínica além do que está explícito nas evidências

# REGRAS DE GROUNDING
- Use APENAS as evidências fornecidas no payload, respeitando os evidence IDs de cada seção
- Cada seção do output só pode referenciar evidências do domínio correspondente
- Se uma seção tem status "absent" no input, retorne status "absent" com arrays vazios e summary vazio
- Se uma seção tem status "limited", diga explicitamente que os dados ainda são poucos para essa área
- Cite números exatamente como fornecidos (não arredonde, não interprete)

# REGRAS POR SEÇÃO
- sleep: descreva duração, variação, tendência, qualidade. Nunca diga "insônia" ou "hipersonia"
- mood: descreva movimento e amplitude. Nunca rotule zonas como nomes clínicos
- socialRhythms: descreva regularidade das âncoras. Use "rotina mais/menos previsível"
- plannerContext: só apareça se houver evidência relevante
- financialContext: só apareça se houver evidência relevante. NUNCA seja moralizante sobre gastos
- cognition: descreva apenas dentro da própria pessoa ("mais lento que seu padrão"), nunca entre pessoas
- weeklyAssessments: descreva movimentos nos escores ("subiu X pontos", "ficou estável"). NUNCA cite faixas clínicas ou cutoffs
- lifeEvents: mencione apenas as categorias (viagem, evento estressante), nunca detalhes pessoais
- correlations: sempre usar "associação", "coincidiu", nunca "causa"
- overallTrend: compare o período atual com o anterior usando as evidências de comparação

# LINGUAGEM
- pt-BR coloquial, acolhedor, não-alarmista
- Público leigo (pacientes, não médicos)
- Texto compacto, adequado para leitura em iPhone
- Sem jargão técnico sem explicação

# PRIORIZAÇÃO
- Abra com uma única mensagem principal no headline
- Priorize 2 a 4 mudanças mais salientes no summary — não dê espaço igual a todos os domínios
- Prefira omissão a filler — seções sem mudança relevante devem ser "stable" com summary curto ou "absent"
- Não repita a mesma ideia em headline, summary, seções e closing
- Transforme números em linguagem leiga (ex: "variação de 125 minutos" → "mais de 2 horas de variação")
- Toda sugestão prática deve estar ligada a um achado específico do período
- Máximo de 1 frase de acolhimento no closing — sem floreio
- Use "apareceu", "mudou", "coincidiu", "vale observar"; evite "indica", "sugere", "aponta para"

# FRASES FIXAS (externalizadas)
- NÃO escreva a frase de encaminhamento ao profissional — apenas retorne shareWithProfessional: true/false
- NÃO escreva disclaimer sobre o app ser ferramenta de acompanhamento — o código injeta isso
- Seu texto no closing deve ser apenas uma frase de acolhimento curta

# SUGESTÕES
- Apenas hábitos cotidianos práticos (horários, rotina, registro)
- NUNCA sugira buscar profissional, mudar tratamento, ou ações clínicas
- Máximo 3 sugestões

# CONTRATO DE SAÍDA
- JSON only, sem markdown, sem texto fora do schema
- schemaVersion deve ser exatamente "narrative_v2"
- Seções ausentes: status="absent", title com nome da área, summary="" (vazio), arrays vazios
- evidenceIds devem listar os IDs das evidências que você usou`;

// ── Few-shot examples (versioned, extracted to narrativeExamples.ts) ────────
import { FEW_SHOT_MESSAGES } from "./narrativeExamples";

// ── Anti-example: what the model should NOT produce ──────────
// BAD OUTPUT (DO NOT GENERATE):
// - headline: "Seus dados desta semana merecem atenção especial e cuidado." (generic, says nothing)
// - summary repeating "merecem atenção" 3 times
// - All 10 sections filled with similar filler text
// - Suggestion: "Continue registrando seus dados" (helps product, not user)
// - Closing: 3 sentences of disclaimer and acolhimento
//
// CORRECT OUTPUT for the same input:
// - headline: "Seu sono caiu para 5h e os check-ins oscilaram mais." (specific)
// - summary: 2-3 sentences with real numbers from evidence
// - Only 3 sections with real content, rest absent
// - Suggestion: "Tente manter o horário de dormir mais parecido nos próximos dias" (tied to finding)
// - Closing: 1 sentence

// ── Evidence preparation helpers ───────────────────────────────

function trendLabel(t: string | null): string {
  return t === "up" ? "subindo" : t === "down" ? "caindo" : t === "stable" ? "estável" : t || "indefinida";
}

function confidenceLabel(c: string): string {
  return c === "alta" ? "alta" : c === "media" ? "média" : c === "baixa" ? "baixa" : c;
}

function domainStatus(count: number, threshold = 5): "ok" | "limited" | "absent" {
  if (count === 0) return "absent";
  if (count < threshold) return "limited";
  return "ok";
}

// ── Build NarrativeInputV2 from InsightsResult + extras ────────

export function prepareNarrativeInput(insights: InsightsResult, extra: NarrativeExtraData, now: Date, tz: string): NarrativeInputV2 {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" });
  const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
  const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);

  const sleepEv: Evidence[] = [];
  const s = insights.sleep;
  if (s.recordCount > 0) {
    if (s.avgDuration != null) sleepEv.push({ id: "sleep_avg_30d", domain: "sleep", kind: "metric", text: `Sono médio: ${s.avgDuration.toFixed(1)} horas (${s.recordCount} registros, confiança ${confidenceLabel(s.dataConfidence)})`, rawValue: s.avgDuration, unit: "hours", timeframe: "30d", confidence: s.dataConfidence === "alta" ? "high" : s.dataConfidence === "media" ? "medium" : "low", priority: 1 });
    if (s.sleepTrend) sleepEv.push({ id: "sleep_trend_30d", domain: "sleep", kind: "comparison", text: `Tendência do sono: ${trendLabel(s.sleepTrend)}${s.sleepTrendDelta ? ` (variação de ${s.sleepTrendDelta.toFixed(1)}h)` : ""}`, rawValue: s.sleepTrendDelta, unit: "hours", timeframe: "30d", confidence: "medium", priority: 1 });
    if (s.bedtimeVariance != null) sleepEv.push({ id: "sleep_bedtime_var_30d", domain: "sleep", kind: "metric", text: `Variação do horário de dormir: ${s.bedtimeVariance} minutos`, rawValue: s.bedtimeVariance, unit: "minutes", timeframe: "30d", confidence: "high", priority: 2 });
    if (s.durationVariability != null) sleepEv.push({ id: "sleep_dur_var_30d", domain: "sleep", kind: "metric", text: `Variabilidade da duração: ${s.durationVariability} minutos`, rawValue: s.durationVariability, unit: "minutes", timeframe: "30d", confidence: "high", priority: 2 });
    if (s.avgQuality != null) sleepEv.push({ id: "sleep_quality_30d", domain: "sleep", kind: "metric", text: `Qualidade média: ${s.avgQuality.toFixed(1)}/5`, rawValue: s.avgQuality, unit: "score", timeframe: "30d", confidence: "medium", priority: 2 });
    if (s.midpoint) sleepEv.push({ id: "sleep_midpoint_30d", domain: "sleep", kind: "metric", text: `Ponto médio do sono: ${s.midpoint}`, rawValue: s.midpoint, unit: "time", timeframe: "30d", confidence: "medium", priority: 3 });
    if (s.socialJetLag != null && s.socialJetLag > 30) sleepEv.push({ id: "sleep_jetlag_30d", domain: "sleep", kind: "metric", text: `Jet lag social: ${s.socialJetLag} minutos`, rawValue: s.socialJetLag, unit: "minutes", timeframe: "30d", confidence: "medium", priority: 2 });
    for (const a of s.alerts) sleepEv.push({ id: `sleep_alert_${a.variant}`, domain: "sleep", kind: "alert", text: `${a.title}: ${a.message}`, rawValue: null, unit: null, timeframe: "30d", confidence: "high", priority: 1 });
  }

  const moodEv: Evidence[] = [];
  const mo = insights.mood;
  if (mo.moodHeadline) moodEv.push({ id: "mood_headline_30d", domain: "mood", kind: "metric", text: `Resumo do humor: ${mo.moodHeadline}`, rawValue: null, unit: null, timeframe: "30d", confidence: "medium", priority: 1 });
  if (mo.moodTrend) moodEv.push({ id: "mood_trend_30d", domain: "mood", kind: "comparison", text: `Tendência do humor: ${trendLabel(mo.moodTrend)}`, rawValue: mo.moodTrend, unit: null, timeframe: "30d", confidence: "medium", priority: 1 });
  if (mo.moodAmplitude != null) moodEv.push({ id: "mood_amplitude_7d", domain: "mood", kind: "metric", text: `Oscilação do humor: ${mo.moodAmplitude} (${mo.moodAmplitudeLabel || ""})`, rawValue: mo.moodAmplitude, unit: "points", timeframe: "7d", confidence: "high", priority: 1 });
  if (mo.medicationAdherence != null) moodEv.push({ id: "mood_med_adherence_30d", domain: "mood", kind: "metric", text: `Adesão ao tratamento: ${Math.round(mo.medicationAdherence * 100)}%`, rawValue: mo.medicationAdherence, unit: "percent", timeframe: "30d", confidence: "medium", priority: 2 });
  if (mo.topWarningSigns?.length) moodEv.push({ id: "mood_warning_signs_30d", domain: "mood", kind: "alert", text: `Sinais de atenção mais frequentes: ${mo.topWarningSigns.map((w) => w.label).join(", ")}`, rawValue: null, unit: null, timeframe: "30d", confidence: "high", priority: 1 });
  for (const a of mo.alerts) moodEv.push({ id: `mood_alert_${a.variant}`, domain: "mood", kind: "alert", text: `${a.title}: ${a.message}`, rawValue: null, unit: null, timeframe: "30d", confidence: "high", priority: 1 });

  const th = insights.thermometer;
  if (th) {
    moodEv.push({ id: "mood_thermo_position", domain: "mood", kind: "metric", text: `Posição no termômetro: ${th.position}/100 (zona: ${th.zoneLabel})`, rawValue: th.position, unit: "score", timeframe: "30d", confidence: "high", priority: 1 });
    if (th.instability) moodEv.push({ id: "mood_thermo_instability", domain: "mood", kind: "metric", text: `Instabilidade: ${th.instability}`, rawValue: th.instability, unit: null, timeframe: "30d", confidence: "high", priority: 2 });
    if (th.mixedFeatures) moodEv.push({ id: "mood_thermo_mixed", domain: "mood", kind: "alert", text: "Características mistas identificadas nos dados", rawValue: null, unit: null, timeframe: "30d", confidence: "medium", priority: 1 });
  }

  const rhythmEv: Evidence[] = [];
  const rh = insights.rhythm;
  if (rh.overallRegularity != null) rhythmEv.push({ id: "rhythm_regularity_30d", domain: "social_rhythms", kind: "metric", text: `Regularidade geral da rotina: ${rh.overallRegularity}/100`, rawValue: rh.overallRegularity, unit: "score", timeframe: "30d", confidence: rh.hasEnoughData ? "high" : "low", priority: 1 });
  for (const [key, anchor] of Object.entries(rh.anchors)) {
    if (anchor.variance != null) rhythmEv.push({ id: `rhythm_${key}_30d`, domain: "social_rhythms", kind: "metric", text: `${anchor.label}: variação de ${anchor.variance} min, regularidade ${anchor.regularityScore}/100`, rawValue: anchor.variance, unit: "minutes", timeframe: "30d", confidence: anchor.daysCount >= 7 ? "high" : "low", priority: 2 });
  }
  for (const a of rh.alerts) rhythmEv.push({ id: `rhythm_alert_${a.variant}`, domain: "social_rhythms", kind: "alert", text: `${a.title}: ${a.message}`, rawValue: null, unit: null, timeframe: "30d", confidence: "high", priority: 1 });

  const corrEv: Evidence[] = [];
  const ch = insights.chart;
  if (ch.correlation) corrEv.push({ id: "corr_sleep_mood_30d", domain: "correlations", kind: "metric", text: `Associação entre sono e humor: ${ch.correlation.rho.toFixed(2)} (${ch.correlation.strength} ${ch.correlation.direction})`, rawValue: ch.correlation.rho, unit: "rho", timeframe: "30d", confidence: ch.correlation.confidence === "alta" ? "high" : "medium", priority: 1 });
  if (ch.lagCorrelation) corrEv.push({ id: "corr_sleep_mood_lag_30d", domain: "correlations", kind: "metric", text: `Associação sono da noite anterior → humor do dia seguinte: ${ch.lagCorrelation.rho.toFixed(2)} (${ch.lagCorrelation.strength} ${ch.lagCorrelation.direction})`, rawValue: ch.lagCorrelation.rho, unit: "rho", timeframe: "30d", confidence: ch.lagCorrelation.confidence === "alta" ? "high" : "medium", priority: 1 });
  for (const pattern of insights.combinedPatterns || []) corrEv.push({ id: `corr_pattern_${corrEv.length}`, domain: "correlations", kind: "metric", text: `${pattern.title}: ${pattern.message}`, rawValue: null, unit: null, timeframe: "30d", confidence: "medium", priority: 2 });

  const trendEv: Evidence[] = [];
  const pr = insights.prediction;
  if (pr && pr.level !== "baixo") {
    if (pr.maniaSignals?.length) trendEv.push({ id: "trend_mania_signals", domain: "trend", kind: "alert", text: `Sinais de elevação: ${pr.maniaSignals.join(", ")}`, rawValue: pr.maniaRisk, unit: "percent", timeframe: "30d", confidence: "medium", priority: 1 });
    if (pr.depressionSignals?.length) trendEv.push({ id: "trend_depression_signals", domain: "trend", kind: "alert", text: `Sinais de queda: ${pr.depressionSignals.join(", ")}`, rawValue: pr.depressionRisk, unit: "percent", timeframe: "30d", confidence: "medium", priority: 1 });
  }
  if (insights.cycling?.isRapidCycling) trendEv.push({ id: "trend_cycling_90d", domain: "trend", kind: "metric", text: `Mudanças de polaridade: ${insights.cycling.polaritySwitches} nos últimos 90 dias`, rawValue: insights.cycling.polaritySwitches, unit: "count", timeframe: "90d", confidence: "medium", priority: 1 });
  if (insights.seasonality?.hasSeasonalPattern && insights.seasonality.description) trendEv.push({ id: "trend_seasonality", domain: "trend", kind: "metric", text: `Padrão sazonal: ${insights.seasonality.description}`, rawValue: null, unit: null, timeframe: "90d", confidence: "low", priority: 3 });

  const assessEv: Evidence[] = [];
  const [cur, prev] = extra.assessments;
  if (cur) {
    if (cur.phq9Total != null) { const d = prev?.phq9Total != null ? cur.phq9Total - prev.phq9Total : null; assessEv.push({ id: "assess_phq9_weekly", domain: "assessments", kind: d != null ? "comparison" : "metric", text: `Questionário semanal de humor: escore ${cur.phq9Total}${d != null ? ` (${d > 0 ? "+" : ""}${d} vs semana anterior)` : ""}`, rawValue: cur.phq9Total, unit: "score", timeframe: "weekly", confidence: "high", priority: 1 }); }
    if (cur.asrmTotal != null) { const d = prev?.asrmTotal != null ? cur.asrmTotal - prev.asrmTotal : null; assessEv.push({ id: "assess_asrm_weekly", domain: "assessments", kind: d != null ? "comparison" : "metric", text: `Questionário semanal de energia e ritmo: escore ${cur.asrmTotal}${d != null ? ` (${d > 0 ? "+" : ""}${d} vs semana anterior)` : ""}`, rawValue: cur.asrmTotal, unit: "score", timeframe: "weekly", confidence: "high", priority: 1 }); }
    if (cur.fastAvg != null) { const d = prev?.fastAvg != null ? Number((cur.fastAvg - prev.fastAvg).toFixed(1)) : null; assessEv.push({ id: "assess_fast_weekly", domain: "assessments", kind: d != null ? "comparison" : "metric", text: `Questionário de funcionamento: média ${cur.fastAvg.toFixed(1)}${d != null ? ` (${d > 0 ? "+" : ""}${d} vs semana anterior)` : ""}`, rawValue: cur.fastAvg, unit: "score", timeframe: "weekly", confidence: "high", priority: 2 }); }
  }

  const lifeEv: Evidence[] = [];
  for (const evt of extra.lifeEvents) {
    const phrase = LIFE_EVENT_PHRASES[evt.eventType];
    if (!phrase) continue;
    lifeEv.push({ id: `life_${evt.eventType}_${evt.date}`, domain: "life_events", kind: "event", text: `${phrase} em ${evt.date}`, rawValue: null, unit: null, timeframe: "30d", confidence: "high", priority: 2 });
  }

  const cogEv: Evidence[] = [];
  if (extra.cognitiveTests.length >= 2) {
    const latest = extra.cognitiveTests[extra.cognitiveTests.length - 1];
    const rts = extra.cognitiveTests.filter((t) => t.reactionTimeMs != null);
    if (latest.reactionTimeMs != null && rts.length >= 2) {
      const avg = rts.reduce((s, t) => s + t.reactionTimeMs!, 0) / rts.length;
      const diff = latest.reactionTimeMs - Math.round(avg);
      cogEv.push({ id: "cog_reaction_recent", domain: "cognition", kind: "comparison", text: `Tempo de reação recente: ${latest.reactionTimeMs}ms (${diff > 0 ? "+" : ""}${diff}ms vs sua média)`, rawValue: latest.reactionTimeMs, unit: "ms", timeframe: "30d", confidence: rts.length >= 5 ? "medium" : "low", priority: 3 });
    }
    const spans = extra.cognitiveTests.filter((t) => t.digitSpan != null);
    if (latest.digitSpan != null && spans.length >= 2) {
      const avg = spans.reduce((s, t) => s + t.digitSpan!, 0) / spans.length;
      const diff = latest.digitSpan - Math.round(avg);
      cogEv.push({ id: "cog_digit_span_recent", domain: "cognition", kind: "comparison", text: `Span de dígitos recente: ${latest.digitSpan} (${diff > 0 ? "+" : ""}${diff} vs sua média)`, rawValue: latest.digitSpan, unit: "count", timeframe: "30d", confidence: spans.length >= 5 ? "medium" : "low", priority: 3 });
    }
  }

  const riskLevel = insights.risk?.level === "atencao_alta" ? "high" as const : insights.risk?.level === "atencao" ? "moderate" as const : "low" as const;
  const hasAlerts = sleepEv.some((e) => e.kind === "alert") || moodEv.some((e) => e.kind === "alert") || trendEv.some((e) => e.kind === "alert");

  return {
    riskLevel, bypassLlm: s.recordCount < 7,
    shareWithProfessional: riskLevel !== "low" || hasAlerts,
    locale: "pt-BR", timezone: tz,
    period: { currentLabel: `${fmt(d30)} a ${fmt(now)}`, comparisonLabel: `${fmt(d14)} a ${fmt(d7)} vs ${fmt(d7)} a ${fmt(now)}` },
    sections: {
      sleep: { status: domainStatus(s.recordCount, 7), evidence: sleepEv },
      mood: { status: domainStatus(moodEv.length, 2), evidence: moodEv },
      socialRhythms: { status: rh.hasEnoughData ? "ok" : domainStatus(rhythmEv.length), evidence: rhythmEv },
      planner: { status: "absent", evidence: [] },
      financial: { status: "absent", evidence: [] },
      cognition: { status: domainStatus(cogEv.length, 2), evidence: cogEv },
      assessments: { status: domainStatus(assessEv.length, 1), evidence: assessEv },
      lifeEvents: { status: domainStatus(lifeEv.length, 1), evidence: lifeEv },
      correlations: { status: domainStatus(corrEv.length, 1), evidence: corrEv },
      trend: { status: domainStatus(trendEv.length, 1), evidence: trendEv },
    },
  };
}

// ── Source fingerprint ─────────────────────────────────────────

export function computeSourceFingerprint(input: NarrativeInputV2): string {
  // Include ALL version keys + model config so cache invalidates when ANY generation logic changes.
  // Missing a key here means stale cache could serve narratives that would be
  // blocked by a newer guardrail or generated differently by a different model.
  const model = process.env.OPENAI_NARRATIVE_MODEL || DEFAULT_MODEL;
  const payload = {
    v: `${PROMPT_VERSION}:${SCHEMA_VERSION}:${ANALYTICS_VERSION}:${GUARDRAIL_VERSION}`,
    model,
    reasoningEffort: "medium",
    input,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

// ── Deterministic templates ────────────────────────────────────

function absentSection(title: string): NarrativeSectionOutput {
  return { status: "absent", title, summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] };
}

// ── High-risk compositor helpers ──────────────────────────────

function buildHighRiskHeadline(input: NarrativeInputV2): string {
  const signals: string[] = [];
  // Check sleep
  const sleepAlerts = input.sections.sleep.evidence.filter(e => e.kind === "alert");
  const sleepTrend = input.sections.sleep.evidence.find(e => e.id === "sleep_trend_30d");
  if (sleepAlerts.length > 0 || (sleepTrend && typeof sleepTrend.rawValue === "number" && sleepTrend.rawValue < 0)) {
    signals.push("seu sono ficou mais curto");
  }
  // Check mood
  const moodAlerts = input.sections.mood.evidence.filter(e => e.kind === "alert");
  const moodAmplitude = input.sections.mood.evidence.find(e => e.id === "mood_amplitude_7d");
  if (moodAlerts.length > 0 || (moodAmplitude && typeof moodAmplitude.rawValue === "number" && moodAmplitude.rawValue >= 30)) {
    signals.push("seu humor oscilou mais");
  }
  // Check rhythms
  const rhythmAlerts = input.sections.socialRhythms.evidence.filter(e => e.kind === "alert");
  if (rhythmAlerts.length > 0) {
    signals.push("sua rotina ficou menos estável");
  }
  // Check assessments
  const assessAlerts = input.sections.assessments.evidence.filter(e => e.kind === "comparison" && typeof e.rawValue === "number");
  if (assessAlerts.length > 0) {
    signals.push("suas avaliações semanais mudaram");
  }

  if (signals.length === 0) return "Seus registros recentes merecem atenção.";
  if (signals.length === 1) return `Nos últimos dias, ${signals[0]}.`;
  const last = signals.pop();
  return `Nos últimos dias, ${signals.join(", ")} e ${last}.`;
}

function buildSectionFromEvidence(
  title: string,
  evidence: Evidence[],
  domainStatus: "ok" | "limited" | "absent",
): NarrativeSectionOutput {
  if (domainStatus === "absent" || evidence.length === 0) {
    return absentSection(title);
  }

  const hasAlerts = evidence.some(e => e.kind === "alert");
  const status = hasAlerts ? "notable" as const : domainStatus === "limited" ? "limited" as const : "stable" as const;

  // Build summary from priority 1 evidence
  const priority1 = evidence.filter(e => e.priority === 1);
  const summaryParts = priority1.length > 0 ? priority1 : evidence.slice(0, 2);
  const summary = summaryParts.map(e => e.text).join(". ") + ".";

  // Key points from all evidence (max 3)
  const keyPoints = evidence.slice(0, 3).map(e => e.text);

  // Metrics from metric-type evidence
  const metrics = evidence.filter(e => e.kind === "metric").slice(0, 3).map(e => e.text);

  // Evidence IDs
  const evidenceIds = evidence.map(e => e.id);

  return { status, title, summary, keyPoints, metrics, suggestions: [], evidenceIds };
}

// ── High-risk deterministic compositor ───────────────────────

function getHighRiskTemplateV2(insights: InsightsResult, input: NarrativeInputV2): NarrativeResultV2 {
  // 1. Build headline from actual evidence signals
  const headline = buildHighRiskHeadline(input);

  // 2. Build top signals for overview summary — pick priority 1 alerts first, then priority 1 metrics
  const allEvidence: Evidence[] = [];
  for (const section of Object.values(input.sections)) {
    allEvidence.push(...section.evidence);
  }
  const topSignals = [
    ...allEvidence.filter(e => e.kind === "alert" && e.priority === 1),
    ...allEvidence.filter(e => e.kind !== "alert" && e.priority === 1),
  ].slice(0, 4);

  const summaryText = topSignals.length > 0
    ? topSignals.map(e => e.text).join(". ") + "."
    : `Os fatores identificados incluem: ${sanitizeRiskFactors(insights.risk?.factors || [])}.`;
  const overviewEvidenceIds = topSignals.map(e => e.id);

  // 3. Build sections from actual evidence
  const sleepSection = buildSectionFromEvidence("Sono", input.sections.sleep.evidence, input.sections.sleep.status);
  const moodSection = buildSectionFromEvidence("Humor", input.sections.mood.evidence, input.sections.mood.status);
  const rhythmSection = buildSectionFromEvidence("Ritmos Sociais", input.sections.socialRhythms.evidence, input.sections.socialRhythms.status);
  const plannerSection = buildSectionFromEvidence("Rotina Planejada", input.sections.planner.evidence, input.sections.planner.status);
  const financialSection = buildSectionFromEvidence("Contexto Financeiro", input.sections.financial.evidence, input.sections.financial.status);
  const cognitionSection = buildSectionFromEvidence("Cognição", input.sections.cognition.evidence, input.sections.cognition.status);
  const assessSection = buildSectionFromEvidence("Avaliações Semanais", input.sections.assessments.evidence, input.sections.assessments.status);
  const lifeSection = buildSectionFromEvidence("Eventos de Vida", input.sections.lifeEvents.evidence, input.sections.lifeEvents.status);
  const corrSection = buildSectionFromEvidence("Correlações", input.sections.correlations.evidence, input.sections.correlations.status);
  const trendSection = buildSectionFromEvidence("Tendência Geral", input.sections.trend.evidence, input.sections.trend.status);
  // Mark overallTrend as notable for high-risk if it has any evidence
  if (trendSection.status !== "absent") {
    trendSection.status = "notable";
  }

  // 4. Build practical suggestions from notable domains
  const suggestions: string[] = [];
  if (sleepSection.status === "notable") {
    suggestions.push("Nos próximos dias, tente proteger seus horários de dormir e acordar");
  }
  if (moodSection.status === "notable") {
    suggestions.push("Compartilhe este resumo com seu profissional ou alguém de confiança");
  }
  if (rhythmSection.status === "notable") {
    suggestions.push("Tente manter pelo menos dois horários-âncora fixos: acordar e dormir");
  }
  // Always include crisis line
  suggestions.push("Se perceber piora rápida, procure ajuda — CVV 188, SAMU 192");
  // Ensure at least 2 suggestions (Zod min is 2)
  if (suggestions.length < 2) {
    suggestions.unshift("Compartilhe este resumo com seu profissional ou alguém de confiança");
  }
  // Cap at 3
  const practicalSuggestions = suggestions.slice(0, 3);

  return {
    schemaVersion: "narrative_v2",
    source: "template_high_risk",
    overview: { headline, summary: summaryText, dataQualityNote: "Análise baseada nos registros disponíveis.", evidenceIds: overviewEvidenceIds },
    sections: {
      sleep: sleepSection, mood: moodSection, socialRhythms: rhythmSection,
      plannerContext: plannerSection, financialContext: financialSection,
      cognition: cognitionSection, weeklyAssessments: assessSection,
      lifeEvents: lifeSection, correlations: corrSection,
      overallTrend: trendSection,
    },
    actions: { shareWithProfessional: true, practicalSuggestions },
    closing: { text: "Você não precisa interpretar esses dados sozinho(a). O app organiza esses sinais para facilitar a conversa com quem te acompanha." },
    generatedAt: new Date().toISOString(),
  };
}

function getInsufficientDataTemplateV2(): NarrativeResultV2 {
  return {
    schemaVersion: "narrative_v2",
    source: "template_insufficient",
    overview: { headline: "Ainda há poucos registros para uma leitura completa.", summary: "Ainda não há dados suficientes para gerar um resumo completo. Continue registrando sono, humor e rotina nos próximos dias.\n\nQuanto mais registros você fizer, mais detalhada será a análise.", dataQualityNote: "Menos de 7 registros de sono nos últimos 30 dias.", evidenceIds: ["sleep_count_low"] },
    sections: {
      sleep: { status: "limited", title: "Sono", summary: "Poucos registros de sono disponíveis.", keyPoints: ["Continue registrando para gerar insights mais completos"], metrics: [], suggestions: ["Registre seu sono todos os dias por pelo menos uma semana"], evidenceIds: ["sleep_count_low"] },
      mood: absentSection("Humor"), socialRhythms: absentSection("Ritmos Sociais"),
      plannerContext: absentSection("Rotina Planejada"), financialContext: absentSection("Contexto Financeiro"),
      cognition: absentSection("Cognição"), weeklyAssessments: absentSection("Avaliações Semanais"),
      lifeEvents: absentSection("Eventos de Vida"), correlations: absentSection("Correlações"),
      overallTrend: { status: "limited", title: "Tendência Geral", summary: "Dados insuficientes para identificar tendências.", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    },
    actions: { shareWithProfessional: false, practicalSuggestions: ["Registre seu sono e humor todos os dias por pelo menos uma semana", "Use os lembretes do app para criar o hábito"] },
    closing: { text: "Cada registro ajuda a montar um retrato mais útil do seu dia a dia. O app está aqui para acompanhar esse processo com você." },
    generatedAt: new Date().toISOString(),
  };
}

function getSafeFallbackV2(): NarrativeResultV2 {
  return {
    schemaVersion: "narrative_v2",
    source: "fallback",
    overview: { headline: "Não foi possível gerar o resumo neste momento.", summary: "Não foi possível gerar o resumo neste momento. Consulte os dados numéricos nos cards acima.\n\nSeus registros continuam sendo salvos normalmente — tente gerar o resumo novamente mais tarde.", dataQualityNote: "", evidenceIds: [] },
    sections: {
      sleep: absentSection("Sono"), mood: absentSection("Humor"), socialRhythms: absentSection("Ritmos Sociais"),
      plannerContext: absentSection("Rotina Planejada"), financialContext: absentSection("Contexto Financeiro"),
      cognition: absentSection("Cognição"), weeklyAssessments: absentSection("Avaliações Semanais"),
      lifeEvents: absentSection("Eventos de Vida"), correlations: absentSection("Correlações"),
      overallTrend: absentSection("Tendência Geral"),
    },
    actions: { shareWithProfessional: false, practicalSuggestions: ["Revise os dados numéricos dos insights acima", "Converse com seu profissional sobre as tendências"] },
    closing: { text: "Tente novamente em alguns minutos." },
    generatedAt: new Date().toISOString(),
  };
}

// ── Main export ────────────────────────────────────────────────

export async function generateNarrative(
  insights: InsightsResult,
  extra: NarrativeExtraData,
  now: Date = new Date(),
  tz: string = "America/Sao_Paulo",
): Promise<NarrativeGenerationResult> {
  const input = prepareNarrativeInput(insights, extra, now, tz);
  const sourceFingerprint = computeSourceFingerprint(input);
  const requestedModel = process.env.OPENAI_NARRATIVE_MODEL || DEFAULT_MODEL;
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const reasoningEffort = "medium";

  const basePersistence: NarrativePersistenceData = {
    model, reasoningEffort, promptVersion: PROMPT_VERSION, schemaVersion: SCHEMA_VERSION,
    analyticsVersion: ANALYTICS_VERSION, guardrailVersion: GUARDRAIL_VERSION,
    sourceFingerprint, bypassLlm: false, bypassReason: null,
    llmAttempted: false,
    guardrailPassed: true, guardrailViolations: [],
    inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, latencyMs: null,
  };

  // High-risk: LLM with extra safety instructions, template as fallback
  const isHighRisk = input.riskLevel === "high";

  if (insights.sleep.recordCount < 7 || insights.mood.recordCount < 3) {
    trackError({ name: "narrative_bypass", errorType: "insufficient_data", message: `LLM bypassed: insufficient data (sleep=${insights.sleep.recordCount}, mood=${insights.mood.recordCount})`, extra: {} });
    return { narrative: getInsufficientDataTemplateV2(), persistence: { ...basePersistence, bypassLlm: true, bypassReason: "insufficient_data" } };
  }

  const highRiskPrefix = isHighRisk
    ? `ATENÇÃO: Este paciente apresenta indicadores de risco elevado. Seja EXTRA cuidadoso:\n- Linguagem acolhedora e calma, sem alarmismo\n- NUNCA minimize os dados, mas também não dramatize\n- Foque nos fatos numéricos concretos — o que mudou e quanto\n- shareWithProfessional DEVE ser true\n- Inclua "Se perceber piora rápida, procure ajuda — CVV 188, SAMU 192" nas sugestões\n\n`
    : "";
  const userPrompt = `${highRiskPrefix}Verbalize as seguintes evidências estruturadas por domínio em uma narrativa para o paciente. Use APENAS as evidências listadas — não interprete, não infira, apenas descreva de forma acolhedora:\n\n${JSON.stringify(input, null, 2)}`;
  const startMs = Date.now();

  // For high-risk: if LLM fails, use enriched template instead of generic fallback
  function getFailureFallback(): NarrativeResultV2 {
    if (isHighRisk) return getHighRiskTemplateV2(insights, input);
    return getSafeFallbackV2();
  }

  // Mark llmAttempted BEFORE the call — even if it fails, data was sent to OpenAI
  basePersistence.llmAttempted = true;

  try {
    const supportsReasoning = model.startsWith("gpt-5") || model.startsWith("o");

    async function callOpenAI() {
      return getOpenAI().responses.create({
        model, instructions: INSTRUCTIONS_V2,
        input: [...FEW_SHOT_MESSAGES, { role: "user", content: userPrompt }],
        text: { format: { type: "json_schema", ...NARRATIVE_V2_JSON_SCHEMA } },
        store: false,
        ...(supportsReasoning ? { reasoning: { effort: reasoningEffort as "low" | "medium" | "high" } } : {}),
        max_output_tokens: 4096,
      });
    }

    // Retry once on transient OpenAI errors (timeout, 5xx, connection reset)
    let response: Awaited<ReturnType<typeof callOpenAI>>;
    try {
      response = await callOpenAI();
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : "";
      const isTransient = /timeout|ECONNRESET|ECONNREFUSED|503|502|529|rate_limit/i.test(msg)
        || (firstErr instanceof OpenAI.APIError && firstErr.status !== undefined && firstErr.status >= 500);
      if (!isTransient) throw firstErr;
      console.warn(`[AI Narrative] Retrying after transient error: ${msg.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, 2000));
      response = await callOpenAI();
    }

    const latencyMs = Date.now() - startMs;
    const usage = response.usage;
    basePersistence.inputTokens = usage?.input_tokens ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    basePersistence.cachedInputTokens = (usage as any)?.input_tokens_details?.cached_tokens ?? null;
    basePersistence.outputTokens = usage?.output_tokens ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    basePersistence.reasoningTokens = (usage as any)?.reasoning_tokens ?? null;
    basePersistence.latencyMs = latencyMs;

    if (response.status !== "completed") {
      Sentry.captureMessage(`AI narrative V2 response status: ${response.status}`, { level: "warning", tags: { feature: "ai-narrative-v2", reason: response.status, model } });
      trackError({ name: "narrative_error", errorType: "incomplete_status", message: `Status: ${response.status}`, extra: { model } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: [`status:${response.status}`] } };
    }

    const refusal = response.output.find((item) => item.type === "message" && item.content?.some((c: { type: string }) => c.type === "refusal"));
    if (refusal) {
      Sentry.captureMessage("AI narrative V2 refused", { level: "warning", tags: { feature: "ai-narrative-v2", reason: "refusal", model } });
      trackError({ name: "narrative_error", errorType: "refusal", message: "Model refused to generate narrative", extra: { model } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: ["refusal"] } };
    }

    const content = response.output_text;
    if (!content) {
      trackError({ name: "narrative_error", errorType: "empty_content", message: "LLM returned empty content", extra: { model } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: ["empty_content"] } };
    }
    if (content.length > 20_000) {
      Sentry.captureMessage("AI narrative V2 oversized", { level: "warning", tags: { feature: "ai-narrative-v2", reason: "oversized", model } });
      trackError({ name: "narrative_error", errorType: "oversized", message: `LLM output too large: ${content.length} chars`, extra: { model, contentLength: content.length } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: ["oversized"] } };
    }

    let raw: unknown;
    try { raw = JSON.parse(content); } catch {
      Sentry.captureMessage("AI narrative V2 JSON parse failed", { level: "warning", tags: { feature: "ai-narrative-v2", reason: "json-parse", model } });
      trackError({ name: "narrative_error", errorType: "json_parse", message: "Failed to parse LLM output as JSON", extra: { model, contentLength: content.length } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: ["json_parse_failed"] } };
    }

    const parsed = narrativeV2Schema.safeParse(raw);
    if (!parsed.success) {
      Sentry.captureMessage("AI narrative V2 Zod failed", { level: "warning", tags: { feature: "ai-narrative-v2", reason: "zod-validation", model }, extra: { errors: parsed.error.issues.slice(0, 5) } });
      trackError({ name: "narrative_error", errorType: "zod_validation", message: "LLM output failed schema validation", extra: { model, issueCount: parsed.error.issues.length } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: ["zod_validation_failed"] } };
    }

    const allText = extractAllText(raw as RawOutput);
    if (containsForbiddenContent(allText)) {
      Sentry.captureMessage("AI narrative V2 forbidden content", { level: "warning", tags: { feature: "ai-narrative-v2", reason: "forbidden-content", model } });
      trackError({ name: "narrative_error", errorType: "forbidden_content", message: "LLM output contained forbidden clinical content", extra: { model } });
      return { narrative: getFailureFallback(), persistence: { ...basePersistence, guardrailPassed: false, guardrailViolations: ["forbidden_content"] } };
    }

    // Layer 4: Evidence grounding check — every evidenceId referenced in the output
    // must exist in the input evidence set. Prevents hallucinated evidence references.
    const validEvidenceIds = new Set<string>();
    for (const section of Object.values(input.sections)) {
      for (const ev of section.evidence) validEvidenceIds.add(ev.id);
    }
    const outputSections = parsed.data.sections;
    const phantomIds: string[] = [];
    for (const sec of Object.values(outputSections)) {
      const section = sec as { evidenceIds?: string[] };
      for (const eid of section.evidenceIds ?? []) {
        if (!validEvidenceIds.has(eid)) phantomIds.push(eid);
      }
    }
    for (const eid of parsed.data.overview?.evidenceIds ?? []) {
      if (!validEvidenceIds.has(eid)) phantomIds.push(eid);
    }
    if (phantomIds.length > 0) {
      Sentry.captureMessage("AI narrative V2 phantom evidence IDs", {
        level: "warning",
        tags: { feature: "ai-narrative-v2", reason: "phantom-evidence", model },
        extra: { phantomIds: phantomIds.slice(0, 10), count: phantomIds.length },
      });
      // Strip phantom IDs instead of failing — the narrative text is still valid,
      // but the evidence chips would be broken. Remove them for safety.
      for (const sec of Object.values(outputSections)) {
        const section = sec as { evidenceIds: string[] };
        section.evidenceIds = section.evidenceIds.filter((id: string) => validEvidenceIds.has(id));
      }
      if (parsed.data.overview?.evidenceIds) {
        parsed.data.overview.evidenceIds = parsed.data.overview.evidenceIds.filter((id: string) => validEvidenceIds.has(id));
      }
      basePersistence.guardrailViolations = [...basePersistence.guardrailViolations, `phantom_evidence:${phantomIds.length}`];
    }

    // Post-generation QA (non-blocking)
    const qaWarnings = runNarrativeQA(parsed.data as NarrativeResultV2, input);
    if (qaWarnings.length > 0) {
      Sentry.captureMessage("AI narrative V2 QA warnings", {
        level: "info",
        tags: { feature: "ai-narrative-v2", reason: "qa-warnings", model },
        extra: { warnings: qaWarnings },
      });
      basePersistence.guardrailViolations = [...basePersistence.guardrailViolations, ...qaWarnings];
    }

    return { narrative: { ...parsed.data, source: "llm" as const, generatedAt: new Date().toISOString() }, persistence: basePersistence };
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "ai-narrative-v2" }, extra: { note: isHighRisk ? "High-risk LLM failed, using template fallback" : "Returned safe fallback V2" } });
    trackError({ name: "narrative_error", errorType: "exception", message: err instanceof Error ? err.message.slice(0, 200) : "unknown", extra: { model, isHighRisk } });
    return { narrative: getFailureFallback(), persistence: { ...basePersistence, latencyMs: Date.now() - startMs, guardrailPassed: false, guardrailViolations: [`exception:${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`] } };
  }
}
