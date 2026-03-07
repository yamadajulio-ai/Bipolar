import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google/auth";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
