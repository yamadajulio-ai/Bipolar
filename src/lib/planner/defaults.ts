/** Category defaults for quick-add and smart defaults in the block editor */

export interface CategoryDefault {
  durationMin: number;
  energyCost: number;
  stimulation: number;
  kind: "ANCHOR" | "FLEX" | "RISK";
}

export const CATEGORY_DEFAULTS: Record<string, CategoryDefault> = {
  sono:      { durationMin: 480, energyCost: 0, stimulation: 0, kind: "ANCHOR" },
  medicacao: { durationMin: 15,  energyCost: 1, stimulation: 0, kind: "ANCHOR" },
  refeicao:  { durationMin: 30,  energyCost: 2, stimulation: 0, kind: "ANCHOR" },
  trabalho:  { durationMin: 120, energyCost: 7, stimulation: 2, kind: "FLEX" },
  social:    { durationMin: 120, energyCost: 5, stimulation: 2, kind: "RISK" },
  exercicio: { durationMin: 60,  energyCost: 4, stimulation: 1, kind: "FLEX" },
  lazer:     { durationMin: 60,  energyCost: 2, stimulation: 1, kind: "FLEX" },
  outro:     { durationMin: 60,  energyCost: 3, stimulation: 1, kind: "FLEX" },
};

/** Keywords that map to categories (pt-BR) */
export const KEYWORD_CATEGORY: Record<string, string> = {
  // sono
  dormir: "sono", sono: "sono", descansar: "sono", cochilo: "sono", soneca: "sono",
  // medicacao
  remedio: "medicacao", medicacao: "medicacao", medicamento: "medicacao", comprimido: "medicacao",
  litio: "medicacao", lamotrigina: "medicacao", quetiapina: "medicacao",
  // refeicao
  cafe: "refeicao", almoco: "refeicao", jantar: "refeicao", lanche: "refeicao",
  refeicao: "refeicao", comer: "refeicao", almocar: "refeicao", janta: "refeicao",
  // trabalho
  trabalho: "trabalho", reuniao: "trabalho", trabalhar: "trabalho", aula: "trabalho",
  estudo: "trabalho", estudar: "trabalho", faculdade: "trabalho",
  // social
  amigos: "social", familia: "social", visita: "social", festa: "social",
  encontro: "social", social: "social", sair: "social",
  // exercicio
  academia: "exercicio", caminhada: "exercicio", corrida: "exercicio", yoga: "exercicio",
  exercicio: "exercicio", treino: "exercicio", alongamento: "exercicio",
  // lazer
  filme: "lazer", serie: "lazer", leitura: "lazer", ler: "lazer", jogo: "lazer",
  musica: "lazer", pintura: "lazer", hobby: "lazer", lazer: "lazer",
};
