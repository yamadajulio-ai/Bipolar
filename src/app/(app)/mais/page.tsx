import Link from "next/link";
import { Card } from "@/components/Card";

const modules = [
  { href: "/como-usar", label: "Como usar", description: "Guia completo de como usar o sistema" },
  { href: "/diario", label: "Diário", description: "Registro expandido de humor, sono e sinais" },
  { href: "/diario/tendencias", label: "Tendências do Diário", description: "Gráficos e alertas de padrão" },
  { href: "/sono", label: "Sono", description: "Registro detalhado de sono" },
  { href: "/sono/tendencias", label: "Tendências de Sono", description: "Regularidade e qualidade" },
  { href: "/exercicios", label: "Exercícios", description: "Respiração e aterramento" },
  { href: "/rotina", label: "Rotina", description: "Rastreador de ritmo social (IPSRT)" },
  { href: "/rotina/tendencias", label: "Tendências de Rotina", description: "Regularidade de âncoras" },
  { href: "/conteudos", label: "Biblioteca", description: "Artigos educacionais sobre Transtorno Bipolar" },
  { href: "/noticias", label: "Notícias", description: "Estudos e notícias atualizadas sobre Transtorno Bipolar" },
  { href: "/cursos", label: "Cursos", description: "Cursos estruturados com aulas" },
  { href: "/sons", label: "Sons Ambiente", description: "Ruído branco, rosa, marrom e chuva" },
  { href: "/relatorio", label: "Relatório Mensal", description: "Resumo para profissionais de saúde" },
  { href: "/plano-de-crise", label: "Plano de Crise", description: "Contatos e estratégias pessoais" },
  { href: "/familias", label: "Famílias", description: "Guia para familiares e cuidadores" },
  { href: "/integracoes", label: "Integrações", description: "Health Auto Export, Google Calendar" },
  { href: "/financeiro", label: "Financeiro", description: "Transações, importação Mobills" },
  { href: "/perfil", label: "Perfil de Saúde", description: "Acesso a recursos e recomendações personalizadas" },
  { href: "/acesso-profissional", label: "Acesso Profissional", description: "Compartilhe dados com seu psiquiatra" },
  { href: "/conta", label: "Conta", description: "Configurações e lembretes" },
];

export default function MaisPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Mais</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href} className="block no-underline">
            <Card className="hover:border-primary/50 transition-colors h-full">
              <p className="font-medium text-foreground">{mod.label}</p>
              <p className="text-sm text-muted mt-1">{mod.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
