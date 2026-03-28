import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { FEEDBACK_CATEGORIES, FEEDBACK_SCREENS, detectCrisis } from "@/lib/feedback";

const HEADERS = { "Cache-Control": "no-store" };

const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().min(10).max(2000),
  screen: z.enum(FEEDBACK_SCREENS).optional(),
  canContact: z.boolean().optional().default(false),
  // Silent metadata
  route: z.string().max(200).optional(),
  appVersion: z.string().max(50).optional(),
  clientType: z.string().max(30).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`user-feedback:${session.userId}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em breve." }, { status: 429, headers: HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: HEADERS });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: HEADERS });
  }

  // Detect crisis on RAW text (before any transformation)
  const rawMessage = parsed.data.message.trim();
  const crisisTier = detectCrisis(rawMessage);

  try {
    // Store raw validated text — React handles escaping on render
    const feedback = await prisma.feedback.create({
      data: {
        userId: session.userId,
        category: parsed.data.category,
        message: rawMessage,
        screen: parsed.data.screen ?? null,
        canContact: parsed.data.canContact,
        priority: crisisTier !== "none" ? "high" : "normal",
        route: parsed.data.route ?? null,
        appVersion: parsed.data.appVersion ?? null,
        clientType: parsed.data.clientType ?? null,
      },
    });

    // Don't expose crisis boolean directly — return neutral follow-up signal
    return NextResponse.json({
      ok: true,
      id: feedback.id,
      followUp: crisisTier !== "none" ? "support" : null,
    }, { headers: HEADERS });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "feedback" } });
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers: HEADERS });
  }
}
