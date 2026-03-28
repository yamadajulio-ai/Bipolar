"use client";

import { useState } from "react";
import { Card } from "@/components/Card";

interface Article {
  id: string;
  externalId: string;
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string | null;
  authors: string | null;
  fetchedAt: string;
}

type Tab = "all" | "pubmed" | "google_news";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pubmed", label: "Estudos científicos" },
  { key: "google_news", label: "Notícias" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SourceBadge({ source }: { source: string }) {
  if (source === "pubmed") {
    return (
      <span className="inline-flex items-center rounded-full bg-info-bg-subtle px-2 py-0.5 text-xs font-medium text-info-fg">
        PubMed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-success-bg-subtle px-2 py-0.5 text-xs font-medium text-success-fg">
      Notícia
    </span>
  );
}

function NewsCard({ article }: { article: Article }) {
  return (
    <Card className="transition-shadow hover:shadow-[var(--shadow-raised)]">
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="mb-2 flex items-center gap-2">
          <SourceBadge source={article.source} />
          {article.sourceName && (
            <span className="text-xs text-muted">{article.sourceName}</span>
          )}
        </div>
        <h3 className="mb-1 text-sm font-semibold leading-snug text-foreground">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted">
          {article.authors && <span>{article.authors}</span>}
          {article.authors && <span>·</span>}
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
          <span>Ler mais</span>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          <span className="sr-only">(abre em nova aba)</span>
        </div>
      </a>
    </Card>
  );
}

export function NewsFeed({ initialArticles }: { initialArticles: Article[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const filtered =
    activeTab === "all"
      ? initialArticles
      : initialArticles.filter((a) => a.source === activeTab);

  return (
    <>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-surface text-foreground shadow-[var(--shadow-card)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Articles */}
      {filtered.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">
            Nenhum artigo encontrado. Tente novamente mais tarde.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        Fontes: PubMed (NIH) e Google News. Atualizado automaticamente a cada hora.
      </p>
    </>
  );
}
