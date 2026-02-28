import { getNews } from "@/lib/news";
import { NewsFeed } from "@/components/noticias/NewsFeed";

export const revalidate = 3600; // ISR: 1 hour

export default async function NoticiasPage() {
  const articles = await getNews();

  // Serialize Date → string for client component
  const serialized = articles.map((a) => ({
    ...a,
    publishedAt: a.publishedAt.toISOString(),
    fetchedAt: a.fetchedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Notícias e Estudos</h1>
      <p className="mb-6 text-sm text-muted">
        Artigos científicos e notícias atualizadas sobre Transtorno Bipolar.
      </p>
      <NewsFeed initialArticles={serialized} />
    </div>
  );
}
