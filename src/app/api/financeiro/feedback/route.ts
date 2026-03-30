import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { hasConsent } from "@/lib/consent";

const HEADERS = { "Cache-Control": "no-store" };

const feedbackSchema = z.object({
  alertType: z.enum(["spending_spike", "frequency_spike", "sustained_increase"]),
  alertDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  useful: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  // Rate limit: 20 feedback per 15 min per user
  const allowed = await checkRateLimit(`feedback:${session.userId}`, 20, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  const consent = await hasConsent(session.userId, "health_data");
  if (!consent) {
    return NextResponse.json({ error: "Consentimento necessário." }, { status: 403, headers: HEADERS });
  }

  try {
    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: HEADERS });
    }

    // Upsert for idempotency (1 feedback per user+alertType+alertDate)
    await prisma.alertFeedback.upsert({
      where: {
        userId_alertType_alertDate: {
          userId: session.userId,
          alertType: parsed.data.alertType,
          alertDate: parsed.data.alertDate,
        },
      },
      update: { useful: parsed.data.useful },
      create: {
        userId: session.userId,
        alertType: parsed.data.alertType,
        alertDate: parsed.data.alertDate,
        useful: parsed.data.useful,
      },
    });

    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "financeiro-feedback" } });
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: HEADERS });
  }
}
