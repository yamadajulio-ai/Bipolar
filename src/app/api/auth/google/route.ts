import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google/auth";
import { checkRateLimit } from "@/lib/security";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`google_link:${session.userId}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
