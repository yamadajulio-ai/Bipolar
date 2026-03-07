import { prisma } from "@/lib/db";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000;

/** Only keep articles whose title mentions bipolar disorder. */
function isBipolarRelated(title: string): boolean {
  const t = title.toLowerCase();
  // "bipolar" covers: bipolar disorder, transtorno bipolar, bipolaridade, transtorno afetivo bipolar
  if (t.includes("bipolar")) return true;
  // TAB = Transtorno Afetivo Bipolar (word boundary to avoid "table", "tablet", etc.)
  if (/\btab\b/.test(t)) return true;
  return false;
}

// ── Translation (EN → PT-BR) ─────────────────────────────────────

async function translateText(text: string): Promise<string> {
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", "pt-BR");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return text;

    const data = await res.json();
    // Response: [[[translated, original, ...], ...], ...]
    const translated = (data[0] as [string, string][] | undefined)
      ?.map((part) => part[0])
      .join("");
    return translated || text;
  } catch {
    return text; // fallback to original English
  }
}

/** Translate an array of texts EN→PT-BR in parallel (max 5 concurrent). */
async function translateBatch(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const results: string[] = new Array(texts.length);
  const CONCURRENCY = 5;

  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY);
    const translated = await Promise.all(batch.map((t) => translateText(t)));
    for (let j = 0; j < translated.length; j++) {
      results[i + j] = translated[j];
    }
  }

  return results;
}

// ── PubMed ────────────────────────────────────────────────────────

interface PubMedSearchResult {
  esearchresult: { idlist: string[] };
}

interface PubMedSummaryResult {
  result: Record<
    string,
    {
      uid: string;
      title: string;
      sortfirstauthor?: string;
      authors?: { name: string }[];
      source?: string;
      sortpubdate?: string;
      epubdate?: string;
    }
  >;
}

async function fetchPubMedArticles(): Promise<
  { externalId: string; title: string; url: string; publishedAt: Date; sourceName: string; authors: string }[]
> {
  const searchUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" +
    new URLSearchParams({
      db: "pubmed",
      term: "bipolar disorder",
      retmax: "20",
      sort: "date",
      retmode: "json",
    });

  const searchRes = await fetch(searchUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!searchRes.ok) return [];

  const searchData: PubMedSearchResult = await searchRes.json();
  const ids = searchData.esearchresult?.idlist;
  if (!ids?.length) return [];

  const summaryUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?" +
    new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "json",
    });

  const summaryRes = await fetch(summaryUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!summaryRes.ok) return [];

  const summaryData: PubMedSummaryResult = await summaryRes.json();
  const results = summaryData.result;

  const articles = ids
    .filter((id) => results[id]?.title)
    .map((id) => {
      const item = results[id];
      const authorNames = item.authors?.slice(0, 3).map((a) => a.name) ?? [];
      const dateStr = item.sortpubdate || item.epubdate || "";
      const parsed = new Date(dateStr.replace(/\//g, "-"));
      const publishedAt = isNaN(parsed.getTime()) ? new Date() : parsed;

      return {
        externalId: `pubmed_${id}`,
        title: item.title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        publishedAt,
        sourceName: item.source || "PubMed",
        authors: authorNames.join(", "),
      };
    });

  // Translate titles from English to PT-BR
  const translatedTitles = await translateBatch(articles.map((a) => a.title));
  for (let i = 0; i < articles.length; i++) {
    articles[i].title = translatedTitles[i];
  }

  return articles.filter((a) => isBipolarRelated(a.title));
}

// ── Google News RSS ───────────────────────────────────────────────

function parseRssItems(xml: string) {
  const items: { title: string; link: string; pubDate: string; source: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") ?? "";

    if (title && link) {
      items.push({ title, link, pubDate, source });
    }
  }

  return items;
}

async function fetchGoogleNewsArticles(): Promise<
  { externalId: string; title: string; url: string; publishedAt: Date; sourceName: string; authors: string }[]
> {
  const rssUrl =
    "https://news.google.com/rss/search?" +
    new URLSearchParams({
      q: "transtorno bipolar",
      hl: "pt-BR",
      gl: "BR",
      ceid: "BR:pt-419",
    });

  const res = await fetch(rssUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const items = parseRssItems(xml);

  return items.filter((item) => isBipolarRelated(item.title)).slice(0, 20).map((item) => {
    const parsed = new Date(item.pubDate);
    const publishedAt = isNaN(parsed.getTime()) ? new Date() : parsed;

    return {
      externalId: `gnews_${Buffer.from(item.link).toString("base64url").slice(0, 80)}`,
      title: item.title,
      url: item.link,
      publishedAt,
      sourceName: item.source || "Google News",
      authors: "",
    };
  });
}

// ── Cache logic ───────────────────────────────────────────────────

async function isCacheFresh(source: string): Promise<boolean> {
  const latest = await prisma.newsArticle.findFirst({
    where: { source },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });

  if (!latest) return false;
  return Date.now() - latest.fetchedAt.getTime() < CACHE_TTL_MS;
}

async function upsertArticles(
  source: string,
  articles: { externalId: string; title: string; url: string; publishedAt: Date; sourceName: string; authors: string }[],
) {
  for (const a of articles) {
    await prisma.newsArticle.upsert({
      where: { externalId: a.externalId },
      update: {
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
        sourceName: a.sourceName,
        authors: a.authors,
        fetchedAt: new Date(),
      },
      create: {
        externalId: a.externalId,
        source,
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
        sourceName: a.sourceName,
        authors: a.authors,
      },
    });
  }
}

async function refreshSource(source: string) {
  try {
    const articles =
      source === "pubmed"
        ? await fetchPubMedArticles()
        : await fetchGoogleNewsArticles();

    if (articles.length > 0) {
      await upsertArticles(source, articles);
    }
  } catch {
    // Silently fail — serve stale cache
  }
}

// ── Public API ────────────────────────────────────────────────────

export async function getNews(source?: "pubmed" | "google_news") {
  const sources = source ? [source] : ["pubmed", "google_news"];

  // Refresh stale sources in parallel
  await Promise.all(
    sources.map(async (s) => {
      if (!(await isCacheFresh(s))) {
        await refreshSource(s);
      }
    }),
  );

  // Return from DB — only articles with bipolar-related titles
  const bipolarFilter = {
    OR: [
      { title: { contains: "bipolar", mode: "insensitive" as const } },
      { title: { contains: " TAB ", mode: "insensitive" as const } },
      { title: { startsWith: "TAB ", mode: "insensitive" as const } },
      { title: { endsWith: " TAB", mode: "insensitive" as const } },
    ],
  };

  return prisma.newsArticle.findMany({
    where: {
      ...(source ? { source } : {}),
      ...bipolarFilter,
      publishedAt: { lte: new Date() },
    },
    orderBy: { publishedAt: "desc" },
    take: 40,
  });
}
