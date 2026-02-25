import Link from "next/link";
import { Card } from "@/components/Card";

const shortcuts = [
  {
    title: "Diário",
    description: "Registre humor e sono",
    href: "/diario",
    icon: "📝",
  },
  {
    title: "Conteúdos",
    description: "Biblioteca educacional",
    href: "/conteudos",
    icon: "📚",
  },
  {
    title: "Plano de Crise",
    description: "Orientações e recursos",
    href: "/plano-de-crise",
    icon: "🆘",
  },
  {
    title: "Famílias",
    description: "Guia para familiares",
    href: "/familias",
    icon: "👨‍👩‍👧",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Início</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="no-underline">
            <Card className="transition-shadow hover:shadow-md">
              <div className="mb-2 text-2xl">{item.icon}</div>
              <h2 className="font-semibold text-foreground">{item.title}</h2>
              <p className="text-sm text-muted">{item.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
