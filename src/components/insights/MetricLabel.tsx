"use client";

import { InfoTooltip } from "./InfoTooltip";

const METRIC_INFO: Record<string, { title: string; content: string; tip?: string }> = {
  // Sleep metrics
  avgDuration: {
    title: "Média de sono",
    content: "Horas médias dormidas por noite nos últimos 30 dias. Referência para bipolar: 7-9h (Allison Harvey, UC Berkeley).",
    tip: "Mantenha horário fixo de dormir e acordar, mesmo nos fins de semana. Evite telas 1h antes de dormir.",
  },
  regularidade: {
    title: "Regularidade",
    content: "Desvio padrão do horário de dormir. Mede se você vai dormir no mesmo horário todo dia. Meta: ±30min ou menos.",
    tip: "Escolha um horário fixo de deitar (ex: 23:00) e mantenha mesmo nos fins de semana. Use alarme para lembrar.",
  },
  variabilidade: {
    title: "Variabilidade",
    content: "Desvio padrão da duração do sono de uma noite para outra. Noites com duração muito diferente indicam instabilidade circadiana.",
    tip: "Evite 'compensar' sono no fim de semana. Mantenha a mesma duração todas as noites — consistência protege o humor.",
  },
  tendencia: {
    title: "Tendência",
    content: "Compara a média de sono dos últimos 7 dias com os 7 dias anteriores. ↑ = dormindo mais, ↓ = dormindo menos, → = estável.",
  },
  pontoMedio: {
    title: "Ponto médio do sono",
    content: "Horário médio entre dormir e acordar — marcador do ritmo circadiano. Mudanças bruscas indicam desregulação circadiana (Bauer & Whybrow).",
    tip: "Se o ponto médio está atrasando, exponha-se à luz natural pela manhã. Se está adiantando, evite luz forte à noite.",
  },
  qualidade: {
    title: "Qualidade do sono",
    content: "Estimada a partir dos estágios de sono do wearable: proporção de sono profundo + REM, despertares e duração total.",
  },

  // Mood metrics
  moodTrend: {
    title: "Tendência de humor",
    content: "Compara a média da primeira metade com a segunda metade dos últimos 7 dias. ↑ = subindo, ↓ = caindo.",
  },
  oscilacao: {
    title: "Oscilação do humor",
    content: "Diferença entre o humor mais alto e o mais baixo nos últimos 7 dias. Alta oscilação (3+ pontos) pode indicar instabilidade.",
    tip: "Mantenha rotina regular, monitore sono, e converse com seu profissional se a oscilação persistir.",
  },
  medicacao: {
    title: "Adesão à medicação",
    content: "Percentual de dias que você marcou 'sim' para medicação nos últimos 30 dias. Meta: 90%+ (STEP-BD).",
    tip: "Use alarme no celular para lembrar da medicação. Associe a uma rotina existente (ex: após escovar os dentes).",
  },
  sinaisAlerta: {
    title: "Sinais de alerta",
    content: "Os 3 sinais mais frequentes que você marcou nos últimos 30 dias. Sinais recorrentes ajudam a identificar padrões prodrômicos.",
  },

  socialJetLag: {
    title: "Social Jet Lag",
    content: "Diferença entre o ponto médio do sono em dias de semana vs fim de semana. Indica desalinhamento circadiano social (Wittmann et al., 2006).",
    tip: "Tente manter horários de sono semelhantes nos dias úteis e fins de semana. Diferença >60min aumenta risco de instabilidade.",
  },

  // Rhythm metrics
  regularidadeGeral: {
    title: "Regularidade geral (IPSRT)",
    content: "Média ponderada da regularidade de 5 âncoras do dia: acordar, contato social, atividade principal, jantar e dormir. Baseado na Terapia de Ritmos Sociais (Ellen Frank, Pittsburgh).",
    tip: "Comece estabilizando UMA âncora por vez. Horário de acordar é a mais impactante.",
  },
};

interface Props {
  metricKey: string;
  children: React.ReactNode;
  className?: string;
}

export function MetricLabel({ metricKey, children, className }: Props) {
  const info = METRIC_INFO[metricKey];
  if (!info) return <span className={className}>{children}</span>;

  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      {children}
      <InfoTooltip title={info.title} content={info.content} tip={info.tip} />
    </span>
  );
}
