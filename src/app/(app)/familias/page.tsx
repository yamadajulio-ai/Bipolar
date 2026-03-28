"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

/* ── 6 Playbook Modules per GPT PRO Audit ──────────────────── */
interface PlaybookModule {
  id: string;
  title: string;
  icon: string;
  duration: string;
  summary: string;
  keyPoints: string[];
  checklist: { label: string; detail: string }[];
  whenToSeekHelp: string;
}

const MODULES: PlaybookModule[] = [
  {
    id: "entender",
    title: "Entendendo o Transtorno Bipolar",
    icon: "📖",
    duration: "3 min",
    summary:
      "O transtorno bipolar é uma condição de saúde — não uma escolha ou falha de caráter. Entender o que acontece no cérebro ajuda a ter empatia e reduzir julgamentos.",
    keyPoints: [
      "O transtorno bipolar envolve alterações no humor, energia e sono que vão além do normal",
      "Existem diferentes tipos: Bipolar I, II e ciclotimia — cada um com características próprias",
      "O tratamento combina medicação e rotina — ambos são essenciais",
      "Episódios podem ser precedidos por sinais de alerta, como mudanças no sono",
      "A pessoa com transtorno bipolar não controla os episódios — apoio sem julgamento faz diferença",
    ],
    checklist: [
      { label: "Li sobre os tipos de transtorno bipolar", detail: "Bipolar I, II e ciclotimia têm diferenças importantes" },
      { label: "Entendo que episódios não são escolhas", detail: "Evite frases como 'é só se controlar'" },
      { label: "Sei que o tratamento é contínuo", detail: "Mesmo em fases estáveis, a medicação é essencial" },
      { label: "Conheço os sinais de alerta precoces", detail: "Mudanças no sono, energia e irritabilidade" },
    ],
    whenToSeekHelp: "Se você sente que não entende o que está acontecendo ou tem dúvidas sobre o diagnóstico, converse com o psiquiatra do seu familiar.",
  },
  {
    id: "comunicacao",
    title: "Comunicação Efetiva",
    icon: "💬",
    duration: "4 min",
    summary:
      "A forma como você se comunica pode ser o maior fator de proteção — ou de estresse — para quem vive com transtorno bipolar. Escuta ativa e linguagem não-julgadora fazem diferença real.",
    keyPoints: [
      "Escute sem interromper. Frases como 'isso vai passar' invalidam sentimentos reais",
      "Use 'eu percebi que...' em vez de 'você está...' — reduz a defensividade",
      "Converse sobre sinais de alerta em momentos de estabilidade, não durante crises",
      "Estabeleça um código combinado para quando a pessoa quiser pedir ajuda sem explicar",
      "Evite comparações ('fulano também tem e trabalha normal') — cada caso é único",
    ],
    checklist: [
      { label: "Pratiquei escuta ativa", detail: "Ouvir sem julgar, interromper ou aconselhar" },
      { label: "Combinei sinais de alerta com meu familiar", detail: "Ex: 'quando eu disser X, significa que preciso de espaço'" },
      { label: "Aprendi a usar linguagem não-julgadora", detail: "'Eu percebi que...' em vez de 'Você está...'" },
      { label: "Identifiquei minhas frases gatilho", detail: "Frases que sem querer invalidam ou pressionam" },
    ],
    whenToSeekHelp: "Se a comunicação está constantemente conflituosa ou se você sente que não consegue mais conversar sem brigar, busque terapia familiar.",
  },
  {
    id: "rotina",
    title: "Apoiando Rotina e Sono",
    icon: "🌙",
    duration: "3 min",
    summary:
      "Rotina regular — especialmente do sono — é o maior fator protetor contra recaídas. Como familiar, você pode ajudar criando um ambiente que favoreça a estabilidade.",
    keyPoints: [
      "O horário de acordar é o mais importante: fixá-lo estabiliza o relógio biológico",
      "Evite atividades estimulantes à noite: telas, discussões, decisões importantes",
      "Refeições em horários regulares ajudam a ancorar o ritmo circadiano",
      "Sono curto (<6h) pode preceder mania; sono longo (>10h) pode indicar depressão",
      "Mudanças bruscas na rotina (viagens, festas) precisam de planejamento extra",
    ],
    checklist: [
      { label: "Definimos horário fixo de acordar", detail: "Mesmo nos fins de semana — variação máxima de 30min" },
      { label: "Criamos rotina noturna de desaceleração", detail: "Luz baixa, sem telas 1h antes de dormir" },
      { label: "Refeições em horários regulares", detail: "Café, almoço e jantar em horários previsíveis" },
      { label: "Plano para eventos que quebram rotina", detail: "Viagens, festas, mudanças — antecipe e planeje" },
    ],
    whenToSeekHelp: "Se o sono está muito curto (<5h por vários dias) ou muito longo (>12h), converse com o psiquiatra — pode ser sinal de mudança de fase.",
  },
  {
    id: "sinais",
    title: "Reconhecendo Sinais Precoces",
    icon: "⚠️",
    duration: "4 min",
    summary:
      "Episódios raramente aparecem do nada. Existem sinais de alerta que aparecem dias ou semanas antes — reconhecê-los cedo pode prevenir crises.",
    keyPoints: [
      "Sinais de mania: menos sono sem cansaço, fala acelerada, gastos impulsivos, irritabilidade intensa",
      "Sinais de depressão: mais sono, isolamento, perda de interesse, lentidão, choro fácil",
      "Cada pessoa tem seus próprios sinais — crie uma lista personalizada em momentos estáveis",
      "Mudança no sono é o sinal mais consistente e precoce em pesquisas",
      "Não confunda um bom dia com hipomania: estabilidade é o estado ideal",
    ],
    checklist: [
      { label: "Criamos lista de sinais pessoais de mania", detail: "Os sinais que meu familiar específico apresenta" },
      { label: "Criamos lista de sinais pessoais de depressão", detail: "Sinais específicos, não genéricos" },
      { label: "Combinamos o que fazer quando sinais aparecem", detail: "Quem ligar, o que ajustar na rotina" },
      { label: "Tenho o plano de crise acessível", detail: "Contatos de emergência, CVV 188, SAMU 192" },
    ],
    whenToSeekHelp: "Se você percebe 2 ou mais sinais de alerta por mais de 3 dias, contate o psiquiatra. Se há risco de segurança, ligue para o SAMU 192 ou vá à UPA.",
  },
  {
    id: "crise",
    title: "O que Fazer em uma Crise",
    icon: "🆘",
    duration: "3 min",
    summary:
      "Em uma crise, sua prioridade é segurança — da pessoa e de você. Saber o que fazer com antecedência faz diferença entre pânico e ação efetiva.",
    keyPoints: [
      "Primeiro: avalie risco imediato. Se há risco de vida, ligue SAMU 192 ou vá à UPA",
      "Mantenha a calma e fale devagar. Não discuta, não confronte, não force",
      "Remova acesso a meios de risco se possível (medicamentos em excesso, objetos cortantes)",
      "Em mania severa: evite estimulação, reduza luzes e barulho, ofereça água",
      "Em depressão severa: não deixe a pessoa sozinha, ofereça presença silenciosa",
    ],
    checklist: [
      { label: "Tenho números de emergência salvos", detail: "CVV 188, SAMU 192, UPA mais próxima, psiquiatra" },
      { label: "Sei onde estão os medicamentos", detail: "Mantenha em local seguro durante crises" },
      { label: "Combinei com meu familiar um plano de crise", detail: "Quando e como agir, quem chamar" },
      { label: "Sei a diferença entre crise e episódio leve", detail: "Nem toda oscilação é emergência" },
    ],
    whenToSeekHelp: "Em risco imediato: SAMU 192 ou UPA. CVV 188 (24h). Se a pessoa verbaliza ideação suicida, não deixe sozinha e busque ajuda profissional imediatamente.",
  },
  {
    id: "autocuidado",
    title: "Cuidando de Quem Cuida",
    icon: "💚",
    duration: "3 min",
    summary:
      "Você não pode cuidar de alguém se estiver esgotado. Autocuidado não é egoísmo — é pré-requisito para ser um apoio sustentável.",
    keyPoints: [
      "Burnout de cuidador é real e comum. Sintomas: exaustão, irritabilidade, culpa, isolamento",
      "Estabeleça limites claros: você pode apoiar sem se anular ou assumir responsabilidades que não são suas",
      "Busque seu próprio acompanhamento: terapia individual ou grupos de familiares",
      "Mantenha suas atividades e relações sociais — não abandone sua vida",
      "Aceite que você não pode controlar os episódios — só pode oferecer apoio",
    ],
    checklist: [
      { label: "Mantenho atividades próprias", detail: "Trabalho, hobbies, exercício, amigos" },
      { label: "Tenho meu próprio apoio profissional", detail: "Terapia, grupo de familiares ou ambos" },
      { label: "Sei dizer 'não' quando preciso", detail: "Limites protegem você e a relação" },
      { label: "Reconheço sinais de burnout em mim", detail: "Cansaço, raiva, culpa, isolamento" },
    ],
    whenToSeekHelp: "Se você está exausto, com raiva constante ou sentindo culpa por tudo, busque terapia para si. Grupos como ABTB e ABRATA oferecem apoio para familiares.",
  },
];

export default function FamiliasPage() {
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("familias-checklist");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  function toggleCheck(moduleId: string, idx: number) {
    const key = `${moduleId}-${idx}`;
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("familias-checklist", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function moduleProgress(moduleId: string, total: number): number {
    let done = 0;
    for (let i = 0; i < total; i++) {
      if (checked[`${moduleId}-${i}`]) done++;
    }
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Área para Famílias</h1>
      <p className="mb-6 text-sm text-muted">
        6 módulos práticos para familiares e cuidadores. Cada módulo traz os pontos essenciais,
        um checklist para praticar e orientações de quando buscar ajuda.
      </p>

      <Alert variant="info" className="mb-6">
        Este guia é informativo e educacional, baseado em orientações do CANMAT e CDC.
        Para orientações personalizadas, busque profissionais de saúde mental.
      </Alert>

      <div className="space-y-3">
        {MODULES.map((mod, moduleIdx) => {
          const isOpen = openModule === mod.id;
          const progress = moduleProgress(mod.id, mod.checklist.length);

          return (
            <Card key={mod.id}>
              {/* Module header (always visible) */}
              <button
                onClick={() => setOpenModule(isOpen ? null : mod.id)}
                className="w-full text-left flex items-center gap-3"
                aria-expanded={isOpen}
                aria-controls={`module-${mod.id}`}
              >
                <span className="text-2xl flex-shrink-0">{mod.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">
                      {moduleIdx + 1}. {mod.title}
                    </h2>
                    <span className="text-[11px] text-muted flex-shrink-0">{mod.duration}</span>
                  </div>
                  {/* Progress bar */}
                  {progress > 0 && (
                    <div className="mt-1 h-1.5 w-full rounded-full bg-black/10">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progresso: ${progress}%`}
                      />
                    </div>
                  )}
                </div>
                <span className={`text-lg flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>

              {/* Module content (expandable) */}
              {isOpen && (
                <div id={`module-${mod.id}`} className="mt-4 space-y-4">
                  {/* Summary */}
                  <p className="text-sm text-foreground/80">{mod.summary}</p>

                  {/* Key points */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Pontos essenciais</h3>
                    <ul className="space-y-2">
                      {mod.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted">
                          <span className="mt-0.5 flex-shrink-0 text-primary font-bold">{i + 1}.</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Checklist */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Checklist para praticar</h3>
                    <div className="space-y-2">
                      {mod.checklist.map((item, i) => {
                        const key = `${mod.id}-${i}`;
                        const isDone = checked[key] || false;
                        return (
                          <label
                            key={i}
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                              isDone ? "bg-primary/5 border-primary/30" : "border-border hover:border-primary/20"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => toggleCheck(mod.id, i)}
                              className="mt-0.5 accent-primary"
                            />
                            <div>
                              <span className={`text-sm font-medium ${isDone ? "line-through text-muted" : ""}`}>
                                {item.label}
                              </span>
                              <p className="text-[11px] text-muted mt-0.5">{item.detail}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* When to seek help */}
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">Quando procurar ajuda profissional</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">{mod.whenToSeekHelp}</p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Emergency contacts */}
      <Card className="mt-6 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <h2 className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">Emergências</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <a href="tel:188" className="rounded-lg bg-surface border border-red-200 p-2 no-underline">
            <p className="text-lg font-bold text-red-700">188</p>
            <p className="text-[11px] text-red-600">CVV (24h)</p>
          </a>
          <a href="tel:192" className="rounded-lg bg-surface border border-red-200 p-2 no-underline">
            <p className="text-lg font-bold text-red-700">192</p>
            <p className="text-[11px] text-red-600">SAMU</p>
          </a>
          <a href="tel:190" className="rounded-lg bg-surface border border-red-200 p-2 no-underline">
            <p className="text-lg font-bold text-red-700">190</p>
            <p className="text-[11px] text-red-600">Polícia</p>
          </a>
        </div>
      </Card>

      <p className="mt-4 text-center text-[11px] text-muted">
        Baseado em orientações CANMAT (patient/family guide), CDC health literacy guidelines e pesquisas PROMAN/USP.
      </p>
    </div>
  );
}
