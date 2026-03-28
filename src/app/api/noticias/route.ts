import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNews } from "@/lib/news";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`noticias_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const source = request.nextUrl.searchParams.get("source") as
      | "pubmed"
      | "google_news"
      | null;

    const validSources = ["pubmed", "google_news"];
    const filtered = source && validSources.includes(source) ? source : undefined;

    const articles = await getNews(filtered);
    return NextResponse.json(articles, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "noticias" } });
    return NextResponse.json(
      { error: "Erro ao buscar notícias." },
      { status: 500 },
    );
  }
}
