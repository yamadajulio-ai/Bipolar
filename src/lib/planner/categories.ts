export const BLOCK_CATEGORIES = [
  { value: "sono", label: "Sono" },
  { value: "medicacao", label: "Medicação" },
  { value: "refeicao", label: "Refeição" },
  { value: "trabalho", label: "Trabalho" },
  { value: "social", label: "Social" },
  { value: "exercicio", label: "Exercício" },
  { value: "lazer", label: "Lazer" },
  { value: "outro", label: "Outro" },
] as const;

export const BLOCK_KINDS = [
  { value: "ANCHOR", label: "Âncora", description: "Horários fixos que protegem sua estabilidade" },
  { value: "FLEX", label: "Flexível", description: "Atividades que podem ser ajustadas" },
  { value: "RISK", label: "Risco", description: "Atividades que merecem atenção especial" },
] as const;

export const STIMULATION_LEVELS = [
  { value: 0, label: "Baixa" },
  { value: 1, label: "Media" },
  { value: 2, label: "Alta" },
] as const;

export const RECURRENCE_OPTIONS = [
  { value: "NONE", label: "Unico" },
  { value: "DAILY", label: "Diario" },
  { value: "WEEKLY", label: "Semanal" },
] as const;

export const WEEKDAY_LABELS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  sono: "bg-indigo-100 border-indigo-300 text-indigo-800",
  medicacao: "bg-emerald-100 border-emerald-300 text-emerald-800",
  refeicao: "bg-amber-100 border-amber-300 text-amber-800",
  trabalho: "bg-blue-100 border-blue-300 text-blue-800",
  social: "bg-pink-100 border-pink-300 text-pink-800",
  exercicio: "bg-green-100 border-green-300 text-green-800",
  lazer: "bg-purple-100 border-purple-300 text-purple-800",
  outro: "bg-gray-100 border-gray-300 text-gray-800",
};

/** Google Calendar event color IDs → inline styles (matching Google's palette). */
export const GOOGLE_EVENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "1":  { bg: "#d4e4fc", border: "#7986CB", text: "#3b4880" },  // Lavanda
  "2":  { bg: "#c8f7d8", border: "#33B679", text: "#1a6b3f" },  // Sálvia
  "3":  { bg: "#f0d4f7", border: "#8E24AA", text: "#5c1370" },  // Uva
  "4":  { bg: "#fde0dd", border: "#E67C73", text: "#8c3a33" },  // Flamingo
  "5":  { bg: "#e0e0e0", border: "#616161", text: "#333333" },  // Grafite
  "6":  { bg: "#fef3c7", border: "#F6BF26", text: "#7a5d0a" },  // Banana
  "7":  { bg: "#fdd8cc", border: "#F4511E", text: "#8c2a0e" },  // Tangerina
  "8":  { bg: "#cce8f9", border: "#039BE5", text: "#045a85" },  // Pavão
  "9":  { bg: "#d4d8f0", border: "#3F51B5", text: "#283270" },  // Mirtilo
  "10": { bg: "#c8e6d0", border: "#0B8043", text: "#064d28" },  // Manjericão
  "11": { bg: "#fccccb", border: "#D50000", text: "#800000" },  // Tomate
};
