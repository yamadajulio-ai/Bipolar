import Link from "next/link";
import { Card } from "@/components/Card";

const modules = [
  { href: "/diario", label: "Diario", description: "Registro expandido de humor, sono e sinais" },
  { href: "/diario/tendencias", label: "Tendencias do Diario", description: "Graficos e alertas de padrao" },
  { href: "/sono", label: "Sono", description: "Registro detalhado de sono" },
  { href: "/sono/tendencias", label: "Tendencias de Sono", description: "Regularidade e qualidade" },
  { href: "/exercicios", label: "Exercicios", description: "Respiracao e aterramento" },
  { href: "/rotina", label: "Rotina", description: "Rastreador de ritmo social (IPSRT)" },
  { href: "/rotina/tendencias", label: "Tendencias de Rotina", description: "Regularidade de ancoras" },
  { href: "/conteudos", label: "Biblioteca", description: "Artigos educacionais sobre TAB1" },
  { href: "/cursos", label: "Cursos", description: "Cursos estruturados com aulas" },
  { href: "/sons", label: "Sons Ambiente", description: "Ruido branco, rosa, marrom e chuva" },
  { href: "/relatorio", label: "Relatorio Mensal", description: "Resumo para profissionais de saude" },
  { href: "/plano-de-crise", label: "Plano de Crise", description: "Contatos e estrategias pessoais" },
  { href: "/familias", label: "Familias", description: "Guia para familiares e cuidadores" },
  { href: "/conta", label: "Conta", description: "Configuracoes e lembretes" },
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
