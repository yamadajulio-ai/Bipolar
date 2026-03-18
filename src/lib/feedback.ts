// ── Shared constants for feedback system (API + client) ──────────

export const FEEDBACK_CATEGORIES = ["suggestion", "bug", "praise", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestion: "Sugestão",
  bug: "Problema",
  praise: "Elogio",
  other: "Outro",
};

export const FEEDBACK_SCREENS = [
  "hoje", "checkin", "sono", "insights", "financeiro", "rotina",
  "diario", "planejador", "exercicios", "sons", "conteudos",
  "avaliacao-semanal", "life-chart", "cognitivo", "relatorio",
  "plano-de-crise", "integracoes", "perfil", "conta", "outro",
] as const;
export type FeedbackScreen = (typeof FEEDBACK_SCREENS)[number];

export const FEEDBACK_SCREEN_LABELS: Record<FeedbackScreen, string> = {
  hoje: "Hoje (Dashboard)",
  checkin: "Check-in",
  sono: "Sono",
  insights: "Insights",
  financeiro: "Financeiro",
  rotina: "Rotina",
  diario: "Diário",
  planejador: "Agenda / Planejador",
  exercicios: "Exercícios",
  sons: "Sons Ambiente",
  conteudos: "Conteúdos",
  "avaliacao-semanal": "Avaliação Semanal",
  "life-chart": "Life Chart",
  cognitivo: "Cognitivo",
  relatorio: "Relatório Mensal",
  "plano-de-crise": "Plano de Crise",
  integracoes: "Integrações",
  perfil: "Perfil de Saúde",
  conta: "Conta",
  outro: "Outra tela",
};

// ── Crisis detection ──────────────────────────────────────────────

// Normalize text: remove accents, collapse whitespace/punctuation, lowercase
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip diacritics
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")          // punctuation → space
    .replace(/\s+/g, " ")             // collapse spaces
    .trim();
}

// Tier 1: high precision — almost certainly crisis content
const CRISIS_TIER1 = [
  "quero morrer", "nao quero mais viver", "melhor sem mim",
  "tirar minha vida", "planejar minha morte", "vou me matar",
  "me matar", "quero me matar", "penso em morrer",
  "autoagressao", "automutilacao", "suicidio", "suicida",
  "tentativa de suicidio", "ideacao suicida",
  "overdose", "enforcar", "pular de",
];

// Tier 2: medium confidence — may be crisis, may be colloquial
const CRISIS_TIER2 = [
  "nao aguento mais", "sem saida", "acabar com tudo",
  "sou um peso", "queria sumir", "queria desaparecer",
  "dormir e nao acordar", "nao vejo sentido",
  "vou fazer besteira", "nao vale a pena",
  "quero sumir", "melhor desaparecer",
  "ninguem se importa", "cansei de viver",
];

export type CrisisTier = "high" | "medium" | "none";

export function detectCrisis(rawText: string): CrisisTier {
  const text = normalize(rawText);
  if (CRISIS_TIER1.some((kw) => text.includes(kw))) return "high";
  if (CRISIS_TIER2.some((kw) => text.includes(kw))) return "medium";
  return "none";
}
