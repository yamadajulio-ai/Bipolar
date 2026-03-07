export const WARNING_SIGNS = [
  { key: "sono_reduzido", label: "Dormindo menos que o habitual" },
  { key: "pensamentos_acelerados", label: "Pensamentos acelerados" },
  { key: "irritabilidade", label: "Mais irritável que o normal" },
  { key: "gastos_impulsivos", label: "Vontade de gastar ou comprar" },
  { key: "isolamento", label: "Evitando pessoas" },
  { key: "energia_excessiva", label: "Energia excessiva, sem cansaço" },
  { key: "desesperanca", label: "Sentimento de desesperança" },
  { key: "apetite_alterado", label: "Apetite muito alterado" },
  { key: "dificuldade_concentracao", label: "Dificuldade de concentração" },
  { key: "planos_grandiosos", label: "Planos grandiosos ou irrealistas" },
  // Added per ISBD/STEP-BD prodrome research
  { key: "aumento_atividade", label: "Fazendo muitas coisas ao mesmo tempo" },
  { key: "agitacao", label: "Inquietação ou agitação" },
  { key: "uso_alcool", label: "Uso de álcool ou substâncias" },
  { key: "conflitos", label: "Mais conflitos interpessoais" },
  { key: "fala_rapida", label: "Falando mais rápido que o normal" },
] as const;

// ── ASRM (Altman Self-Rating Mania Scale) — 5 items, 0-4 each ────
// Adapted for self-report. Score >= 6 suggests possible hypomania/mania.
export const ASRM_ITEMS = [
  {
    id: 1,
    question: "Humor",
    options: [
      "Não me sinto mais feliz ou animado que o normal",
      "Às vezes me sinto mais feliz ou animado que o normal",
      "Me sinto mais feliz ou animado boa parte do tempo",
      "Me sinto mais feliz ou animado na maior parte do tempo",
      "Me sinto extremamente feliz, eufórico o tempo todo",
    ],
  },
  {
    id: 2,
    question: "Autoconfiança",
    options: [
      "Não me sinto mais autoconfiante que o normal",
      "Às vezes me sinto mais autoconfiante que o normal",
      "Me sinto mais autoconfiante boa parte do tempo",
      "Me sinto muito mais autoconfiante na maior parte do tempo",
      "Me sinto capaz de qualquer coisa o tempo todo",
    ],
  },
  {
    id: 3,
    question: "Sono",
    options: [
      "Não preciso de menos sono que o habitual",
      "Preciso de um pouco menos de sono que o habitual",
      "Preciso de bem menos sono que o habitual",
      "Preciso de muito menos sono, mas não me sinto cansado",
      "Quase não preciso dormir e tenho muita energia",
    ],
  },
  {
    id: 4,
    question: "Fala",
    options: [
      "Não falo mais que o normal",
      "Às vezes falo mais que o normal",
      "Falo mais que o normal boa parte do tempo",
      "Falo muito mais na maior parte do tempo",
      "Não consigo parar de falar o tempo todo",
    ],
  },
  {
    id: 5,
    question: "Atividade",
    options: [
      "Não estou mais ativo que o normal",
      "Às vezes estou mais ativo que o normal",
      "Estou mais ativo boa parte do tempo",
      "Estou muito mais ativo na maior parte do tempo",
      "Estou em atividade constante o tempo todo",
    ],
  },
] as const;

// ── PHQ-9 (Patient Health Questionnaire) — 9 items, 0-3 each ─────
// Score ranges: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 mod-severe, 20-27 severe
export const PHQ9_ITEMS = [
  "Pouco interesse ou prazer em fazer as coisas",
  "Se sentir 'pra baixo', deprimido ou sem esperança",
  "Dificuldade para dormir, ou dormindo demais",
  "Se sentir cansado ou com pouca energia",
  "Pouco apetite ou comendo demais",
  "Se sentir mal consigo mesmo, achando que é um fracasso",
  "Dificuldade para se concentrar nas coisas",
  "Se movimentar ou falar tão devagar que as pessoas percebem (ou o oposto: agitação)",
  "Pensar que seria melhor estar morto ou se machucar de alguma forma",
] as const;

export const PHQ9_FREQUENCY_OPTIONS = [
  { value: 0, label: "Nenhuma vez" },
  { value: 1, label: "Vários dias" },
  { value: 2, label: "Mais da metade dos dias" },
  { value: 3, label: "Quase todos os dias" },
] as const;

// ── FAST short (Functioning Assessment) — 6 key domains ──────────
export const FAST_SHORT_ITEMS = [
  { key: "work", label: "Trabalho/estudo — conseguiu cumprir suas responsabilidades?" },
  { key: "social", label: "Relações sociais — manteve contato com pessoas?" },
  { key: "selfcare", label: "Autocuidado — cuidou da higiene, alimentação, saúde?" },
  { key: "finances", label: "Finanças — controlou seus gastos?" },
  { key: "cognition", label: "Cognição — conseguiu se concentrar e lembrar das coisas?" },
  { key: "leisure", label: "Lazer — conseguiu fazer atividades prazerosas?" },
] as const;

// ── Life Chart event types ───────────────────────────────────────
export const LIFE_CHART_EVENT_TYPES = [
  { key: "med_change", label: "Mudança de medicação" },
  { key: "stressor", label: "Evento estressante" },
  { key: "travel", label: "Viagem" },
  { key: "hospitalization", label: "Internação" },
  { key: "therapy", label: "Sessão de terapia" },
  { key: "menstrual", label: "Período menstrual" },
  { key: "other", label: "Outro" },
] as const;

export const MOOD_LABELS: Record<number, string> = {
  1: "Muito baixo",
  2: "Baixo",
  3: "Neutro",
  4: "Elevado",
  5: "Muito elevado",
};

export const ENERGY_LABELS: Record<number, string> = {
  1: "Letárgico",
  2: "Baixa energia",
  3: "Normal",
  4: "Agitado",
  5: "Muito agitado",
};

export const ANXIETY_LABELS: Record<number, string> = {
  1: "Tranquilo",
  2: "Leve",
  3: "Moderada",
  4: "Alta",
  5: "Muito alta",
};

export const IRRITABILITY_LABELS: Record<number, string> = {
  1: "Calmo",
  2: "Leve",
  3: "Moderada",
  4: "Alta",
  5: "Muito alta",
};

export const MEDICATION_OPTIONS = [
  { value: "sim", label: "Já tomei" },
  { value: "nao", label: "Não tomei" },
  { value: "nao_sei", label: "Ainda não" },
] as const;

export const SLEEP_ROUTINES = [
  { key: "tela", label: "Usou tela antes de dormir", negative: true },
  { key: "cafeina", label: "Consumiu cafeína à tarde/noite", negative: true },
  { key: "exercicio_tarde", label: "Exercício intenso à noite", negative: true },
  { key: "leitura", label: "Leitura leve", negative: false },
  { key: "respiracao", label: "Exercício de respiração", negative: false },
  { key: "banho", label: "Banho morno", negative: false },
  { key: "horario_regular", label: "Dormiu no horário habitual", negative: false },
  { key: "ambiente_escuro", label: "Quarto escuro e silencioso", negative: false },
] as const;

export const BREATHING_EXERCISES = {
  "478": {
    name: "Respiração 4-7-8",
    description: "Técnica calmante para ansiedade e insônia. Inspire por 4 segundos, segure por 7, expire por 8.",
    inhale: 4,
    hold: 7,
    exhale: 8,
    holdAfter: 0,
    cycles: 4,
  },
  box: {
    name: "Respiração Quadrada",
    description: "Técnica de equilíbrio para estabilizar o sistema nervoso. 4 tempos iguais.",
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdAfter: 4,
    cycles: 4,
  },
  diafragmatica: {
    name: "Respiração Diafragmática",
    description: "Respiração profunda e lenta para aterramento e redução de estresse.",
    inhale: 4,
    hold: 2,
    exhale: 6,
    holdAfter: 0,
    cycles: 6,
  },
} as const;

export const GROUNDING_EXERCISES = {
  "5sentidos": {
    name: "5 Sentidos (5-4-3-2-1)",
    description: "Técnica de aterramento sensorial para momentos de ansiedade ou dissociação.",
    steps: [
      { instruction: "Nomeie 5 coisas que você pode VER ao seu redor", count: 5, sense: "visão" },
      { instruction: "Nomeie 4 coisas que você pode TOCAR", count: 4, sense: "tato" },
      { instruction: "Nomeie 3 coisas que você pode OUVIR", count: 3, sense: "audição" },
      { instruction: "Nomeie 2 coisas que você pode CHEIRAR", count: 2, sense: "olfato" },
      { instruction: "Nomeie 1 coisa que você pode SABOREAR", count: 1, sense: "paladar" },
    ],
  },
  muscular: {
    name: "Relaxamento Muscular Progressivo",
    description: "Tensione e relaxe grupos musculares para liberar tensão física.",
    steps: [
      { instruction: "Tensione os punhos por 5 segundos... agora solte.", duration: 10 },
      { instruction: "Tensione os ombros levantando-os até as orelhas... solte.", duration: 10 },
      { instruction: "Tensione os músculos da face (aperte os olhos e boca)... solte.", duration: 10 },
      { instruction: "Tensione o abdômen... solte.", duration: 10 },
      { instruction: "Tensione os pés pressionando-os no chão... solte.", duration: 10 },
      { instruction: "Agora respire profundamente e sinta todo o corpo relaxando.", duration: 15 },
    ],
  },
} as const;
