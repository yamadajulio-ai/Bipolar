import Link from "next/link";
import { getAllContent } from "@/lib/content";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

export default function ConteudosPage() {
  const contents = getAllContent();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Biblioteca de Conteúdos</h1>
      <Alert variant="info" className="mb-6">
        Conteúdo educacional — não substitui orientação de profissionais de saúde.
      </Alert>

      <div className="space-y-3">
        {contents.map((item) => (
          <Link
            key={item.slug}
            href={`/conteudos/${item.slug}`}
            className="block no-underline"
          >
            <Card className="transition-shadow hover:shadow-[var(--shadow-raised)]">
              <h2 className="font-semibold text-foreground">{item.title}</h2>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
              <p className="mt-2 text-xs text-muted">{item.readingTime}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
