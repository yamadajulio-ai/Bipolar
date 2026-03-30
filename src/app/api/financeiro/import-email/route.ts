import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { generateImportEmail } from "../inbound-email/route";

const HEADERS = { "Cache-Control": "no-store" };

/**
 * GET /api/financeiro/import-email
 *
 * Returns the user's unique import email address for financial file imports.
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`financeiro_import_email:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  const email = generateImportEmail(session.userId);

  return NextResponse.json({ email }, { headers: HEADERS });
}
