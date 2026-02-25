import { notFound } from "next/navigation";
import Link from "next/link";
import { getContentBySlug, getAllContent } from "@/lib/content";
import { Alert } from "@/components/Alert";

export function generateStaticParams() {
  const contents = getAllContent();
  return contents.map((c) => ({ slug: c.slug }));
}

export default async function ConteudoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getContentBySlug(slug);

  if (!content) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/conteudos"
        className="mb-4 inline-block text-sm text-muted hover:text-foreground"
      >
        ← Voltar para conteúdos
      </Link>

      <Alert variant="warning" className="mb-6">
        <strong>Conteúdo educacional.</strong> Não substitui orientação de
        profissionais de saúde mental.
      </Alert>

      <h1 className="mb-2 text-2xl font-bold">{content.meta.title}</h1>
      <p className="mb-6 text-sm text-muted">{content.meta.readingTime}</p>

      <div
        className="prose prose-sm max-w-none text-foreground"
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    </div>
  );
}
