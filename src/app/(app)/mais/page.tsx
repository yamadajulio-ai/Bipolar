"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";

interface ModuleItem {
  href: string;
  label: string;
  description: string;
}

const quickAccess: ModuleItem[] = [
  { href: "/checkin", label: "Check-in", description: "Registrar humor agora" },
  { href: "/sono/novo", label: "Registrar Sono", description: "Novo registro de sono" },
  { href: "/insights", label: "Insights", description: "Padrões e tendências" },
  { href: "/plano-de-crise", label: "Plano de Crise", description: "Contatos e estratégias" },
];

const sections: { title: string; items: ModuleItem[]; defaultOpen: boolean }[] = [
  {
    title: "Registros",
    defaultOpen: true,
    items: [
      { href: "/meu-diario", label: "Meu Diário", description: "Pensamentos, sentimentos e insights pessoais" },
      { href: "/diario", label: "Histórico de Humor", description: "Histórico completo de check-ins e tendências" },
      { href: "/diario/tendencias", label: "Tendências de Humor", description: "Gráficos e alertas de padrão" },
      { href: "/sono", label: "Histórico de Sono", description: "Registro detalhado de sono" },
      { href: "/sono/tendencias", label: "Tendências de Sono", description: "Regularidade e qualidade" },
      { href: "/financeiro", label: "Financeiro", description: "Gastos cruzados com humor e energia" },
    ],
  },
  {
    title: "Avaliações",
    defaultOpen: true,
    items: [
      { href: "/avaliacao-semanal", label: "Avaliação Semanal", description: "Mania, depressão e funcionamento" },
      { href: "/life-chart", label: "Life Chart", description: "Registro de eventos significativos" },
      { href: "/circadiano", label: "Circadiano", description: "Análise do seu ritmo circadiano" },
      { href: "/cognitivo", label: "Cognitivo", description: "Tarefas de tempo de reação e memória" },
      { href: "/relatorio", label: "Relatório Mensal", description: "Resumo para profissionais de saúde" },
    ],
  },
  {
    title: "Bem-estar",
    defaultOpen: true,
    items: [
      { href: "/exercicios", label: "Exercícios", description: "Respiração e aterramento" },
      { href: "/sons", label: "Sons Ambiente", description: "Ruído branco, rosa, marrom e chuva" },
      { href: "/planejador", label: "Agenda - Rotina", description: "Blocos semanais de atividades" },
    ],
  },
  {
    title: "Aprendizado",
    defaultOpen: false,
    items: [
      { href: "/como-usar", label: "Como Usar", description: "Guia completo de como usar o sistema" },
      { href: "/conteudos", label: "Biblioteca", description: "Artigos educacionais sobre Transtorno Bipolar" },
      { href: "/noticias", label: "Notícias", description: "Estudos e notícias atualizadas" },
      { href: "/cursos", label: "Cursos", description: "Cursos estruturados com aulas" },
      { href: "/familias", label: "Famílias", description: "Guia para familiares e cuidadores" },
    ],
  },
  {
    title: "Configurações",
    defaultOpen: false,
    items: [
      { href: "/medicamentos", label: "Meus Medicamentos", description: "Cadastre medicamentos e horários para adesão por dose" },
      { href: "/plano-de-crise", label: "Plano de Crise", description: "Contatos e estratégias pessoais" },
      { href: "/integracoes", label: "Integrações", description: "Apple Health, Health Connect, Google Agenda, Mobills" },
      { href: "/perfil", label: "Perfil de Saúde", description: "Acesso a recursos e recomendações" },
      { href: "/acesso-profissional", label: "Acesso Profissional", description: "Compartilhe dados com seu psiquiatra" },
      { href: "/consentimentos", label: "Privacidade", description: "Gerenciar consentimentos e dados" },
      { href: "/feedback", label: "Feedback", description: "Sugestões, problemas ou elogios" },
      { href: "/conta", label: "Conta", description: "Configurações e lembretes" },
    ],
  },
];

function CollapsibleSection({
  title,
  items,
  defaultOpen,
}: {
  title: string;
  items: ModuleItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2"
        aria-expanded={open}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </h2>
        <span
          className={`text-muted text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          &#x25BE;
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mt-1">
          {items.map((mod) => (
            <Link key={mod.href} href={mod.href} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <p className="font-medium text-foreground">{mod.label}</p>
                <p className="text-sm text-muted mt-1">{mod.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getContextualRecommendation(): { href: string; label: string; description: string } | null {
  try {
    const now = new Date();
    const hour = parseInt(
      now.toLocaleTimeString("en-US", { timeZone: "America/Sao_Paulo", hour12: false, hour: "numeric" }),
      10,
    );
    if (hour < 10) {
      return { href: "/sono/novo", label: "Registrar sono", description: "Bom dia! Registre como foi sua noite de sono." };
    }
    if (hour >= 20) {
      return { href: "/checkin", label: "Check-in noturno", description: "Boa noite! Como você está se sentindo agora?" };
    }
  } catch {
    // timezone parsing failed — skip
  }
  return null;
}

export default function MaisPage() {
  const contextual = useMemo(() => getContextualRecommendation(), []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Mais</h1>

      {/* Contextual recommendation */}
      {contextual && (
        <Link href={contextual.href} className="block no-underline mb-6">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
            <p className="text-sm font-medium text-primary">{contextual.label}</p>
            <p className="text-xs text-muted mt-1">{contextual.description}</p>
          </div>
        </Link>
      )}

      {/* Quick access */}
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Mais usados
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {quickAccess.map((item) => (
            <Link key={item.href} href={item.href} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted mt-1">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="space-y-6">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.title}
            title={section.title}
            items={section.items}
            defaultOpen={section.defaultOpen}
          />
        ))}
      </div>
    </div>
  );
}
