"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/Card";

interface SleepData {
  midpoint: string | null;
  avgDuration: number | null;
  bedtimeVariance: number | null;
}

const DARK_THERAPY_TIPS = [
  {
    title: "Reduza luz azul 2h antes de dormir",
    detail:
      "Em algumas condições, a luz azul (telas, LEDs brancos) pode reduzir significativamente a melatonina. Use filtros de luz noturna no celular e reduza luzes da casa.",
    reference: "Gooley et al., 2011 — Journal of Clinical Endocrinology",
    icon: "📱",
  },
  {
    title: "Mantenha o quarto escuro para dormir",
    detail:
      "Use cortinas blackout ou máscara de dormir. Mesmo 5 lux (luz fraca) durante o sono pode afetar o ritmo circadiano.",
    reference: "Cho et al., 2015 — PNAS",
    icon: "🌑",
  },
  {
    title: "Exposição à luz solar pela manhã",
    detail:
      "10-30 minutos de luz solar matinal ajuda a sincronizar o relógio biológico. Isso é especialmente importante no transtorno bipolar.",
    reference: "Sit et al., 2007 — Bipolar Disorders",
    icon: "☀️",
  },
  {
    title: "Terapia de escuridão (dark therapy)",
    detail:
      "Ficar em ambiente escuro ou com luz âmbar 14h (ex: 18h-08h) pode atenuar episódios maníacos. Versão prática: óculos que bloqueiam luz azul.",
    reference: "Henriksen et al., 2016 — Bipolar Disorders (RCT)",
    icon: "🕶️",
  },
  {
    title: "Evite luz intensa à noite",
    detail:
      "Troque lâmpadas brancas por luz mais quente/âmbar no período noturno. Luz com menor proporção de azul tende a ter menor impacto na melatonina.",
    reference: "Phelps, 2008 — Medical Hypotheses",
    icon: "💡",
  },
  {
    title: "Horário regular de sono",
    detail:
      "Manter horários consistentes para dormir e acordar é a base da IPSRT. Irregularidade circadiana pode estar associada a maior risco de episódios em algumas pessoas.",
    reference: "Frank et al., 2005 — Archives of General Psychiatry",
    icon: "⏰",
  },
];

const CHRONOTYPE_INFO = [
  {
    type: "Matutino extremo",
    midpointRange: "antes de 02:30",
    description: "Prefere dormir cedo e acordar cedo. Pode ter mais dificuldade com eventos sociais noturnos.",
  },
  {
    type: "Matutino moderado",
    midpointRange: "02:30 – 03:30",
    description: "Tendência matutina com boa adaptação social. Cronótipo mais comum em adultos mais velhos.",
  },
  {
    type: "Intermediário",
    midpointRange: "03:30 – 04:30",
    description: "Cronótipo mais frequente. Boa flexibilidade para horários variados.",
  },
  {
    type: "Vespertino moderado",
    midpointRange: "04:30 – 05:30",
    description: "Preferência por horários mais tardios. Social jet lag pode ser maior durante a semana.",
  },
  {
    type: "Vespertino extremo",
    midpointRange: "após 05:30",
    description: "Preferência forte por horários tardios. Maior risco de desregulação circadiana se forçado a horários matutinos.",
  },
];

export default function CircadianoPage() {
  const [sleepData, setSleepData] = useState<SleepData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/insights-summary");
        if (res.ok) {
          const data = await res.json();
          setSleepData({
            midpoint: data.midpoint ?? null,
            avgDuration: data.avgDuration ?? null,
            bedtimeVariance: data.bedtimeVariance ?? null,
          });
        }
      } catch {
        // Graceful fallback — tips still show
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function estimateChronotype(midpoint: string): string | null {
    const match = /^(\d{2}):(\d{2})$/.exec(midpoint);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null;
    const mins = h * 60 + m;
    if (mins < 150) return "Matutino extremo";
    if (mins < 210) return "Matutino moderado";
    if (mins < 270) return "Intermediário";
    if (mins < 330) return "Vespertino moderado";
    return "Vespertino extremo";
  }

  const chronotype = sleepData?.midpoint ? estimateChronotype(sleepData.midpoint) : null;
  const chronoInfo = chronotype ? CHRONOTYPE_INFO.find((c) => c.type === chronotype) : null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Ritmo Circadiano e Luz</h1>
      <p className="mb-6 text-sm text-muted">
        Como a luz e a escuridão afetam o transtorno bipolar.
      </p>

      {/* Personal circadian summary */}
      {!loading && sleepData?.midpoint && (
        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Seu Perfil Circadiano</h2>
          <div className="mb-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-muted">Ponto médio</div>
              <div className="text-lg font-bold text-foreground tabular-nums">
                {sleepData.midpoint}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Duração média</div>
              <div className="text-lg font-bold text-foreground tabular-nums">
                {sleepData.avgDuration !== null
                  ? (() => {
                      const totalMin = Math.round(sleepData.avgDuration * 60);
                      const h = Math.floor(totalMin / 60);
                      const m = totalMin % 60;
                      return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
                    })()
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Regularidade</div>
              <div className="text-lg font-bold text-foreground tabular-nums">
                {sleepData.bedtimeVariance !== null
                  ? `±${sleepData.bedtimeVariance}min`
                  : "—"}
              </div>
            </div>
          </div>

          {chronoInfo && (
            <div className="rounded-lg bg-primary/10 p-3">
              <p className="text-sm font-medium text-foreground">
                Cronótipo estimado: {chronotype}
              </p>
              <p className="mt-1 text-xs text-muted">
                {chronoInfo.description}
              </p>
            </div>
          )}
        </Card>
      )}

      {loading && (
        <p className="mb-6 text-center text-sm text-muted">Carregando dados...</p>
      )}

      {/* Dark therapy educational content */}
      <h2 className="mb-3 text-lg font-semibold">Terapia de Luz e Escuridão</h2>
      <p className="mb-4 text-xs text-muted">
        A cronobiologia tem papel central no transtorno bipolar. Pesquisas mostram que
        intervenções baseadas em luz e escuridão podem ajudar na estabilização do humor.
      </p>

      <div className="space-y-3">
        {DARK_THERAPY_TIPS.map((tip, i) => (
          <Card key={i}>
            <div className="flex gap-3">
              <span className="text-2xl flex-shrink-0">{tip.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {tip.title}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {tip.detail}
                </p>
                <p className="mt-1.5 text-[10px] text-muted italic">
                  {tip.reference}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Chronotype reference table */}
      <Card className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">Cronótipos e Ponto Médio do Sono</h3>
        <div className="space-y-2">
          {CHRONOTYPE_INFO.map((c) => (
            <div
              key={c.type}
              className={`rounded-lg border p-2.5 text-xs ${
                chronotype === c.type
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.type}</span>
                <span className="tabular-nums">{c.midpointRange}</span>
              </div>
              <p className="mt-0.5 text-[10px]">{c.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-muted">
          Baseado no Munich Chronotype Questionnaire (Roenneberg et al., 2003).
          Ponto médio = média entre horário de dormir e acordar.
        </p>
      </Card>

      {/* Bipolar-specific notes */}
      <Card className="mt-4">
        <h3 className="mb-2 text-sm font-semibold">Por que isso importa no Bipolar?</h3>
        <ul className="space-y-2 text-xs text-muted">
          <li>
            <strong className="text-foreground">Mania e luz:</strong> Exposição a luz intensa
            à noite pode desencadear episódios maníacos. A terapia de escuridão (dark therapy)
            mostrou eficácia como adjuvante no tratamento da mania aguda.
          </li>
          <li>
            <strong className="text-foreground">Depressão e escuridão:</strong> Fototerapia
            matinal (luz brilhante ~10.000 lux) pode ajudar na depressão bipolar, mas deve
            ser usada com cautela e supervisão para evitar virada maníaca.
          </li>
          <li>
            <strong className="text-foreground">Relógio biológico:</strong> Mutações em genes
            circadianos (CLOCK, BMAL1) estão associadas ao transtorno bipolar. Manter ritmos
            regulares é uma forma de tratamento (Terapia IPSRT).
          </li>
          <li>
            <strong className="text-foreground">Social jet lag:</strong> A diferença entre
            horários de sono na semana vs fim de semana desregula o relógio biológico e pode
            precipitar episódios.
          </li>
        </ul>
      </Card>

      <p className="mt-6 text-center text-[10px] text-muted">
        Referências: Henriksen et al. (2016), Sit et al. (2007), Roenneberg et al. (2003),
        Frank et al. (2005). Informações educativas — não substitui orientação profissional.
      </p>
    </div>
  );
}
