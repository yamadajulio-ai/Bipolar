/**
 * Risk v2 — User-facing copy (pt-BR)
 *
 * All text shown to the user, organized by alert layer.
 * Clinical language follows CLAUDE.md guidelines:
 * - Never make diagnostic assertions
 * - "Não substitui avaliação profissional"
 * - Language for patients, not clinicians
 */

import type { AlertLayer, RailResult } from "./types";

// ── Headlines ────────────────────────────────────────────────────

export function getHeadline(layer: AlertLayer, safety: RailResult, syndrome: RailResult): string {
  if (layer === "RED") {
    if (syndrome.reasons.includes("mania_aguda_grave")) {
      return "Seus registros indicam um episódio intenso";
    }
    return "Sua segurança vem primeiro";
  }

  if (layer === "ORANGE") {
    if (safety.pending) {
      return "Precisamos fazer uma triagem de segurança";
    }
    if (safety.layer === "ORANGE") {
      return "Queremos garantir que você está seguro";
    }
    if (syndrome.reasons.includes("sinais_mistos_com_corroboracao")) {
      return "Seus registros mostram sinais mistos que merecem atenção";
    }
    if (syndrome.reasons.includes("sindrome_maniforme_provavel")) {
      return "Seus registros mostram sinais de ativação que merecem atenção";
    }
    if (syndrome.reasons.includes("sindrome_depressiva_relevante")) {
      return "Seus registros mostram sinais de rebaixamento persistente";
    }
    return "Vale buscar apoio hoje";
  }

  if (layer === "YELLOW") {
    return "Sinais de atenção hoje";
  }

  return "";
}

// ── Descriptions ─────────────────────────────────────────────────

export function getDescription(layer: AlertLayer, safety: RailResult, syndrome: RailResult): string {
  if (layer === "RED") {
    if (syndrome.reasons.includes("mania_aguda_grave")) {
      return "Seus registros mostram sinais muito intensos de ativação — perda de sono, agitação, mudanças abruptas ou comportamento incomum. Procure atendimento psiquiátrico de urgência agora.";
    }
    return "Pelos seus registros e respostas, pode haver risco agudo. Procure ajuda agora.";
  }

  if (layer === "ORANGE") {
    if (safety.pending) {
      return "Você marcou um sinal que merece cuidado. São perguntas rápidas para entender qual apoio faz sentido agora.";
    }
    if (safety.layer === "ORANGE") {
      return "Queremos entender como você está. Se precisar, há pessoas prontas para ajudar — 24 horas, todos os dias.";
    }
    if (syndrome.reasons.includes("sinais_mistos_com_corroboracao")) {
      return "Quando sinais de ativação e rebaixamento aparecem juntos, o desconforto pode ser intenso. Conversar com seu profissional pode ajudar a entender o que está acontecendo.";
    }
    return "Seus registros sugerem uma piora clinicamente relevante. Não é, por si só, uma emergência, mas recomendamos apoio nas próximas 24–72 horas.";
  }

  if (layer === "YELLOW") {
    return "Notamos mudanças que às vezes aparecem antes de uma piora. Não parece uma emergência, mas vale acompanhar.";
  }

  return "";
}

// ── Reason labels (human-readable pt-BR) ─────────────────────────

const REASON_LABELS: Record<string, string> = {
  // Safety
  ideacao_suicida_aguda: "Pensamentos suicidas agudos detectados",
  nao_consegue_se_manter_seguro: "Dificuldade em se manter seguro",
  pensamentos_suicidas_agora: "Pensamentos suicidas neste momento",
  intencao_declarada_de_agir: "Intenção declarada de agir",
  plano_para_hoje: "Plano com prazo imediato",
  plano_detalhado_com_acesso_a_meios: "Plano com acesso a meios",
  plano_com_intencao_incerta_e_prazo_proximo: "Plano com intenção incerta e prazo próximo",
  tentativa_recente: "Tentativa recente",
  comportamento_preparatorio_recente: "Comportamento preparatório recente",
  triagem_seguranca_pendente: "Triagem de segurança pendente",
  asq_positivo: "Triagem de segurança positiva",
  plano_suicida_presente: "Plano suicida identificado",
  intencao_incerta: "Incerteza sobre intenção de agir",
  prazo_temporal_proximo: "Prazo temporal próximo identificado",
  incerto_sobre_seguranca: "Incerteza sobre segurança pessoal",
  tentativa_ultimos_12_meses: "Tentativa nos últimos 12 meses",
  preparacao_ultimos_12_meses: "Preparação nos últimos 12 meses",
  ideacao_recente: "Ideação suicida recente",
  phq9_item9_positivo_sem_triagem: "Sinal na avaliação semanal — triagem pendente",
  phq9_item9_frequente: "Pensamentos de autolesão frequentes (quase diários)",
  phq9_item9_moderado_com_modificador: "Pensamentos de autolesão com fatores agravantes",
  historico_tentativa_remota: "Histórico de tentativa (remoto)",
  phq9_item9_positivo_triagem_ok: "Sinal na avaliação semanal — triagem já realizada",
  sinal_suicida_com_triagem_ok: "Sinal de alerta com triagem já realizada",

  // Syndrome
  mania_aguda_grave: "Sinais intensos de ativação — possível episódio maníaco agudo (pode incluir psicose ou agitação grave)",
  sinais_mistos_com_corroboracao: "Sinais mistos (ativação + rebaixamento simultâneos)",
  sinais_mistos_sem_corroboracao_completa: "Possíveis sinais mistos",
  sindrome_maniforme_provavel: "Sinais de ativação / possível hipomania",
  sinal_de_ativacao: "Sinal de ativação",
  sindrome_depressiva_relevante: "Sinais depressivos persistentes",
  sinal_depressivo: "Sinal depressivo",

  // Prodrome
  queda_sono_significativa: "Sono abaixo do seu padrão",
  noites_curtas_consecutivas: "Noites curtas consecutivas",
  mudanca_horario_sono: "Mudança no horário de sono",
  sinais_ativacao_agrupados: "Vários sinais de ativação recentes",
  sinais_rebaixamento_agrupados: "Vários sinais de rebaixamento recentes",
  gasto_atipico_material: "Gasto acima do seu padrão recente",
  gasto_acima_padrao: "Gasto acima do padrão",
  nao_adesao_medicacao_critica: "Falha na adesão à medicação",
  energia_elevada_recente: "Energia elevada nos últimos dias",
  irritabilidade_elevada_recente: "Irritabilidade elevada nos últimos dias",
  humor_baixo_recente: "Humor baixo nos últimos dias",
  ansiedade_elevada_recente: "Ansiedade elevada nos últimos dias",
  prodromos_dados_insuficientes: "Sinais detectados, mas poucos dados para confirmar",
};

export function reasonToLabel(reason: string): string {
  return REASON_LABELS[reason] || reason;
}

// ── Disclaimer ───────────────────────────────────────────────────

export const DISCLAIMER =
  "Este aplicativo não substitui avaliação profissional. Em emergência, ligue 192 (SAMU).";

export const DISCLAIMER_SHORT =
  "Não substitui avaliação profissional.";
