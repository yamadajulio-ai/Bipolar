import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { hasConsent } from "@/lib/consent";
import { isPluggyConfigured, createConnectToken } from "@/lib/financeiro/pluggy";
import * as Sentry from "@sentry/nextjs";

const HEADERS = { "Cache-Control": "no-store" };

/**
 * POST /api/financeiro/pluggy/connect
 *
 * Creates a Pluggy Connect Token for the frontend widget.
 * The user can then open the Pluggy widget to link their bank account.
 */
export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`pluggy_connect:${session.userId}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  if (!isPluggyConfigured()) {
    return NextResponse.json(
      { error: "Conexão bancária não está configurada no momento." },
      { status: 503, headers: HEADERS },
    );
  }

  const consent = await hasConsent(session.userId, "health_data");
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento necessário para conectar conta bancária." },
      { status: 403, headers: HEADERS },
    );
  }

  try {
    const { accessToken } = await createConnectToken(session.userId);
    return NextResponse.json({ accessToken }, { headers: HEADERS });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "pluggy_connect" } });
    return NextResponse.json(
      { error: "Erro ao criar conexão. Tente novamente." },
      { status: 500, headers: HEADERS },
    );
  }
}
