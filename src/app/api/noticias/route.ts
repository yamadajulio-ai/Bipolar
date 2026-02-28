import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNews } from "@/lib/news";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const source = request.nextUrl.searchParams.get("source") as
    | "pubmed"
    | "google_news"
    | null;

  const validSources = ["pubmed", "google_news"];
  const filtered = source && validSources.includes(source) ? source : undefined;

  const articles = await getNews(filtered);
  return NextResponse.json(articles);
}
