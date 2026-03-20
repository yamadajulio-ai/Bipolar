import Link from "next/link";
import { Card } from "@/components/Card";

interface ModuleItem {
  href: string;
  label: string;
  description: string;
}

const sections: { title: string; items: ModuleItem[] }[] = [
  {
    title: "Registros",
    items: [
      { href: "/meu-diario", label: "Meu Diário", description: "Pensamentos, sentimentos e insights pessoais" },
      { href: "/diario", label: "Diário de Check-in", description: "Registro expandido de humor, sono e sinais" },
      { href: "/diario/tendencias", label: "Tendências do Diário", description: "Gráficos e alertas de padrão" },
      { href: "/sono", label: "Sono", description: "Registro detalhado de sono" },
      { href: "/sono/tendencias", label: "Tendências de Sono", description: "Regularidade e qualidade" },
      { href: "/rotina", label: "Rotina", description: "Seus horários-âncora do dia" },
      { href: "/rotina/tendencias", label: "Tendências de Rotina", description: "Regularidade de âncoras" },
      { href: "/financeiro", label: "Financeiro", description: "Gastos cruzados com humor e energia" },
    ],
  },
  {
    title: "Avaliações",
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
    items: [
      { href: "/exercicios", label: "Exercícios", description: "Respiração e aterramento" },
      { href: "/sons", label: "Sons Ambiente", description: "Ruído branco, rosa, marrom e chuva" },
      { href: "/planejador", label: "Agenda - Rotina", description: "Blocos semanais de atividades" },
    ],
  },
  {
    title: "Aprendizado",
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
    items: [
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

export default function MaisPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Mais</h1>
      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {section.items.map((mod) => (
                <Link key={mod.href} href={mod.href} className="block no-underline">
                  <Card className="hover:border-primary/50 transition-colors h-full">
                    <p className="font-medium text-foreground">{mod.label}</p>
                    <p className="text-sm text-muted mt-1">{mod.description}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
