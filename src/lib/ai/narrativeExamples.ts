/**
 * narrativeExamples.ts — Versioned few-shot examples for AI narrative generation.
 *
 * Extracted from generateNarrative.ts (I4-T6) so examples can be:
 * 1. Independently tested against the narrative Zod schema
 * 2. Versioned and updated without touching generation logic
 */

export const EXAMPLES_VERSION = "v2.1";

// Example 1: STABLE — lean, only 3 relevant sections
export const FEW_SHOT_STABLE_INPUT = `Verbalize as seguintes evidências: {"riskLevel":"low","sections":{"sleep":{"status":"ok","evidence":[{"id":"sleep_avg_30d","text":"Sono médio: 7.2 horas (22 registros, confiança alta)"},{"id":"sleep_var_30d","text":"Variação do horário de dormir: 28 minutos"}]},"mood":{"status":"ok","evidence":[{"id":"mood_stability_7d","text":"Resumo do humor: Humor estável"}]},"assessments":{"status":"ok","evidence":[{"id":"assessments_weekly","text":"Questionário semanal de humor: escore 5 (-1 vs semana anterior)"}]}}}`;

export const FEW_SHOT_STABLE_OUTPUT = {
  schemaVersion: "narrative_v2" as const,
  overview: { headline: "Semana estável nos seus registros.", summary: "Seu sono ficou em torno de 7,2 horas com pouca variação entre as noites. O humor se manteve estável ao longo dos dias.", dataQualityNote: "Base sólida de registros nesta semana.", evidenceIds: ["sleep_avg_30d", "sleep_var_30d", "mood_stability_7d"] },
  sections: {
    sleep: { status: "stable" as const, title: "Sono", summary: "Noites regulares, com meia hora de variação.", keyPoints: ["Média de 7,2 horas por noite", "Variação de 28 minutos"], metrics: ["Sono médio: 7,2h", "Variação: 28min"], suggestions: [], evidenceIds: ["sleep_avg_30d", "sleep_var_30d"] },
    mood: { status: "stable" as const, title: "Humor", summary: "Humor estável no período.", keyPoints: ["Baixa oscilação"], metrics: [], suggestions: [], evidenceIds: ["mood_stability_7d"] },
    socialRhythms: { status: "absent" as const, title: "Ritmos Sociais", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    plannerContext: { status: "absent" as const, title: "Rotina Planejada", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    financialContext: { status: "absent" as const, title: "Contexto Financeiro", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    cognition: { status: "absent" as const, title: "Cognição", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    weeklyAssessments: { status: "stable" as const, title: "Avaliações Semanais", summary: "Escore caiu 1 ponto — dentro da faixa habitual.", keyPoints: ["Escore de humor: 5 (-1 vs semana anterior)"], metrics: [], suggestions: [], evidenceIds: ["assessments_weekly"] },
    lifeEvents: { status: "absent" as const, title: "Eventos de Vida", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    correlations: { status: "absent" as const, title: "Correlações", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    overallTrend: { status: "absent" as const, title: "Tendência Geral", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
  },
  actions: { shareWithProfessional: false, practicalSuggestions: ["Manter os horários de dormir parecidos no fim de semana ajuda a preservar essa regularidade", "Nos dias mais corridos, registrar pelo menos o sono já mantém a base de comparação"] },
  closing: { text: "Semana sem grandes mudanças — bom sinal para a estabilidade." },
};

// Example 2: ALERT — correlation without causal language
export const FEW_SHOT_ALERT_INPUT = `Verbalize as seguintes evidências: {"riskLevel":"moderate","shareWithProfessional":true,"sections":{"sleep":{"status":"ok","evidence":[{"id":"sleep_avg_7d","text":"Sono médio: 5.6 horas"},{"id":"sleep_var_7d","text":"Variação do horário de dormir: 130 minutos"},{"id":"sleep_delta_wow","text":"Tendência do sono: caindo (variação de -1.5h)"}]},"mood":{"status":"ok","evidence":[{"id":"mood_amplitude_7d","text":"Oscilação do humor: 50 (alta)"}]},"correlations":{"status":"ok","evidence":[{"id":"corr_sleep_mood_30d","text":"Associação entre sono e humor: 0.65 (moderada positiva)"}]}}}`;

export const FEW_SHOT_ALERT_OUTPUT = {
  schemaVersion: "narrative_v2" as const,
  overview: { headline: "Seu sono encurtou e o humor ficou mais instável nesta semana.", summary: "O sono caiu para 5,6 horas em média — quase 1 hora e meia a menos que a semana anterior. A variação entre as noites passou de 2 horas. Nos seus registros, noites mais curtas coincidiram com dias de humor mais difícil.", dataQualityNote: "Leitura consistente, com mudanças recentes bem marcadas.", evidenceIds: ["sleep_avg_7d", "sleep_var_7d", "sleep_delta_wow", "mood_amplitude_7d"] },
  sections: {
    sleep: { status: "notable" as const, title: "Sono", summary: "Noites mais curtas e com horários mais espalhados.", keyPoints: ["Média de 5,6 horas", "Mais de 2 horas de variação entre noites", "Queda de 1,5h vs semana anterior"], metrics: ["Sono médio: 5,6h", "Variação: 130min"], suggestions: ["Tente manter o horário de dormir mais parecido nos próximos dias"], evidenceIds: ["sleep_avg_7d", "sleep_var_7d", "sleep_delta_wow"] },
    mood: { status: "notable" as const, title: "Humor", summary: "Os check-ins oscilaram mais que o habitual.", keyPoints: ["Oscilação de 50 pontos (alta)"], metrics: [], suggestions: [], evidenceIds: ["mood_amplitude_7d"] },
    socialRhythms: { status: "absent" as const, title: "Ritmos Sociais", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    plannerContext: { status: "absent" as const, title: "Rotina Planejada", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    financialContext: { status: "absent" as const, title: "Contexto Financeiro", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    cognition: { status: "absent" as const, title: "Cognição", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    weeklyAssessments: { status: "absent" as const, title: "Avaliações Semanais", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    lifeEvents: { status: "absent" as const, title: "Eventos de Vida", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    correlations: { status: "stable" as const, title: "Correlações", summary: "Nos seus registros, noites mais curtas coincidiram com dias de humor mais difícil.", keyPoints: ["Associação moderada entre sono e humor (0,65)"], metrics: [], suggestions: [], evidenceIds: ["corr_sleep_mood_30d"] },
    overallTrend: { status: "absent" as const, title: "Tendência Geral", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
  },
  actions: { shareWithProfessional: true, practicalSuggestions: ["Proteger o horário de dormir nos próximos dias — mesmo 30 minutos mais cedo já muda o padrão", "Separar um bloco curto de desaceleração antes de dormir"] },
  closing: { text: "Vale observar se essa mudança no sono continua nos próximos dias." },
};

// Example 3: LIMITED — few records, honest about limitations
export const FEW_SHOT_LIMITED_INPUT = `Verbalize as seguintes evidências: {"riskLevel":"low","sections":{"sleep":{"status":"limited","evidence":[{"id":"sleep_count_low","text":"Sono médio: 6.5 horas (4 registros, confiança baixa)"}]},"mood":{"status":"limited","evidence":[{"id":"mood_count_low","text":"Resumo do humor: 2 check-ins registrados"}]}}}`;

export const FEW_SHOT_LIMITED_OUTPUT = {
  schemaVersion: "narrative_v2" as const,
  overview: { headline: "Poucos registros ainda para comparar padrões.", summary: "Com 4 noites e 2 check-ins, ainda não dá para traçar comparações firmes. Os primeiros registros mostram sono em torno de 6,5 horas.", dataQualityNote: "Base limitada — comparações ainda frágeis.", evidenceIds: ["sleep_count_low", "mood_count_low"] },
  sections: {
    sleep: { status: "limited" as const, title: "Sono", summary: "Média de 6,5 horas em 4 registros — pouco para identificar um padrão.", keyPoints: ["4 registros disponíveis"], metrics: ["Sono médio: 6,5h"], suggestions: [], evidenceIds: ["sleep_count_low"] },
    mood: { status: "limited" as const, title: "Humor", summary: "Apenas 2 check-ins — pouco para comparar.", keyPoints: ["2 registros disponíveis"], metrics: [], suggestions: [], evidenceIds: ["mood_count_low"] },
    socialRhythms: { status: "absent" as const, title: "Ritmos Sociais", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    plannerContext: { status: "absent" as const, title: "Rotina Planejada", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    financialContext: { status: "absent" as const, title: "Contexto Financeiro", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    cognition: { status: "absent" as const, title: "Cognição", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    weeklyAssessments: { status: "absent" as const, title: "Avaliações Semanais", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    lifeEvents: { status: "absent" as const, title: "Eventos de Vida", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    correlations: { status: "absent" as const, title: "Correlações", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    overallTrend: { status: "limited" as const, title: "Tendência Geral", summary: "Retrato inicial — ainda ganhando base.", keyPoints: ["Base pequena de registros"], metrics: [], suggestions: [], evidenceIds: ["sleep_count_low", "mood_count_low"] },
  },
  actions: { shareWithProfessional: false, practicalSuggestions: ["Registrar sono e humor por mais alguns dias já monta uma base para a próxima leitura", "Usar os lembretes do app nos mesmos horários facilita a consistência"] },
  closing: { text: "Cada registro novo deixa a próxima leitura mais útil." },
};

// Example 4: CONFLICTING SIGNALS — teaches uncertainty
export const FEW_SHOT_CONFLICT_INPUT = `Verbalize as seguintes evidências: {"riskLevel":"moderate","sections":{"sleep":{"status":"ok","evidence":[{"id":"sleep_avg_30d","text":"Sono médio: 7.8 horas (25 registros, confiança alta)"},{"id":"sleep_var_30d","text":"Variação do horário de dormir: 22 minutos"}]},"mood":{"status":"ok","evidence":[{"id":"mood_amplitude_7d","text":"Oscilação do humor: 55 (alta)"}]},"assessments":{"status":"ok","evidence":[{"id":"assess_phq9_weekly","text":"Questionário semanal de humor: escore 12 (+4 vs semana anterior)"},{"id":"assess_asrm_weekly","text":"Questionário semanal de energia e ritmo: escore 3 (-2 vs semana anterior)"}]}}}`;

export const FEW_SHOT_CONFLICT_OUTPUT = {
  schemaVersion: "narrative_v2" as const,
  overview: { headline: "Seu sono ficou regular, mas o humor oscilou mais do que o padrão.", summary: "O sono se manteve em 7,8 horas com apenas 22 minutos de variação — noites bem regulares. Porém, o humor oscilou bastante e o escore do questionário semanal subiu 4 pontos. Vale observar que sono estável nem sempre coincide com humor estável.", dataQualityNote: "Boa base de registros. Sinais mistos entre sono e humor.", evidenceIds: ["sleep_avg_30d", "mood_amplitude_7d", "assess_phq9_weekly"] },
  sections: {
    sleep: { status: "stable" as const, title: "Sono", summary: "Noites regulares e dentro da faixa habitual.", keyPoints: ["Média de 7,8 horas", "Variação de apenas 22 minutos"], metrics: ["Sono médio: 7,8h", "Variação: 22min"], suggestions: [], evidenceIds: ["sleep_avg_30d", "sleep_var_30d"] },
    mood: { status: "notable" as const, title: "Humor", summary: "Os check-ins oscilaram mais, mesmo com sono regular.", keyPoints: ["Oscilação de 55 pontos (alta)"], metrics: [], suggestions: [], evidenceIds: ["mood_amplitude_7d"] },
    socialRhythms: { status: "absent" as const, title: "Ritmos Sociais", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    plannerContext: { status: "absent" as const, title: "Rotina Planejada", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    financialContext: { status: "absent" as const, title: "Contexto Financeiro", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    cognition: { status: "absent" as const, title: "Cognição", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    weeklyAssessments: { status: "notable" as const, title: "Avaliações Semanais", summary: "O escore de humor subiu 4 pontos, enquanto o de energia caiu 2.", keyPoints: ["Questionário de humor: +4 pontos", "Energia e ritmo: -2 pontos"], metrics: [], suggestions: [], evidenceIds: ["assess_phq9_weekly", "assess_asrm_weekly"] },
    lifeEvents: { status: "absent" as const, title: "Eventos de Vida", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    correlations: { status: "absent" as const, title: "Correlações", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
    overallTrend: { status: "absent" as const, title: "Tendência Geral", summary: "", keyPoints: [], metrics: [], suggestions: [], evidenceIds: [] },
  },
  actions: { shareWithProfessional: true, practicalSuggestions: ["Registrar como está o humor em diferentes horas do dia ajuda a mapear o padrão", "Manter a rotina de sono que está funcionando bem"] },
  closing: { text: "Vale acompanhar se essa oscilação de humor continua nos próximos dias." },
};

/**
 * All few-shot examples as message pairs for the LLM prompt.
 * Each pair is { role: "user", content } + { role: "assistant", content }.
 */
export const FEW_SHOT_MESSAGES = [
  { role: "user" as const, content: FEW_SHOT_STABLE_INPUT },
  { role: "assistant" as const, content: JSON.stringify(FEW_SHOT_STABLE_OUTPUT) },
  { role: "user" as const, content: FEW_SHOT_ALERT_INPUT },
  { role: "assistant" as const, content: JSON.stringify(FEW_SHOT_ALERT_OUTPUT) },
  { role: "user" as const, content: FEW_SHOT_LIMITED_INPUT },
  { role: "assistant" as const, content: JSON.stringify(FEW_SHOT_LIMITED_OUTPUT) },
  { role: "user" as const, content: FEW_SHOT_CONFLICT_INPUT },
  { role: "assistant" as const, content: JSON.stringify(FEW_SHOT_CONFLICT_OUTPUT) },
];

/** All example outputs for schema validation testing */
export const ALL_EXAMPLE_OUTPUTS = [
  FEW_SHOT_STABLE_OUTPUT,
  FEW_SHOT_ALERT_OUTPUT,
  FEW_SHOT_LIMITED_OUTPUT,
  FEW_SHOT_CONFLICT_OUTPUT,
];
