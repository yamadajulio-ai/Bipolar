import Link from "next/link";
import { Card } from "@/components/Card";

const actions = [
  { title: "Diário", description: "Registre humor e sono", href: "/diario", icon: "📝" },
  { title: "Sono", description: "Registro de sono", href: "/sono", icon: "🌙" },
  { title: "Exercícios", description: "Respiração e aterramento", href: "/exercicios", icon: "🫁" },
  { title: "Rotina", description: "Ritmo social", href: "/rotina", icon: "🕐" },
  { title: "Conteúdos", description: "Biblioteca educacional", href: "/conteudos", icon: "📚" },
  { title: "Sons", description: "Sons para relaxar", href: "/sons", icon: "🎵" },
  { title: "Plano de Crise", description: "Orientações e recursos", href: "/plano-de-crise", icon: "🆘" },
  { title: "Famílias", description: "Guia para familiares", href: "/familias", icon: "👨‍👩‍👧" },
  { title: "Cursos", description: "Cursos estruturados", href: "/cursos", icon: "🎓" },
  { title: "Relatório", description: "Relatório mensal", href: "/relatorio", icon: "📊" },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((item) => (
        <Link key={item.href} href={item.href} className="no-underline">
          <Card className="transition-shadow hover:shadow-md text-center">
            <div className="mb-1 text-xl">{item.icon}</div>
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <p className="text-xs text-muted">{item.description}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
