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
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_sei", label: "Não lembro" },
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
