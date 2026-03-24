import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp, maskIp } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const sosLogSchema = z.object({
  action: z.enum([
    "opened",
    "called_188",
    "called_192",
    "called_190",
    "called_193",
    "called_180",
    "called_100",
    "called_contact",
    "breathing",
    "grounding",
    "open_maps_upa",
    "chat_while_waiting",
    "chat_from_tools",
    "waiting_188_mode",
  ]),
});

export async function POST(request: NextRequest) {
  // SOS is public — allow anonymous logging for crisis situations
  const session = await getSession();
  const isAuth = session.isLoggedIn;

  // Rate limit: by userId if authenticated, by masked IP if anonymous
  const rateLimitKey = isAuth
    ? `sos_write:${session.userId}`
    : `sos_write_anon:${maskIp(getClientIp(request) || "unknown")}`;
  const limited = await checkRateLimit(rateLimitKey, 60, 60_000);
  if (limited) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = sosLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    await prisma.sOSEvent.create({
      data: {
        userId: isAuth ? session.userId : null,
        action: parsed.data.action,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "sos" } });
    return NextResponse.json({ error: "Erro ao registrar" }, { status: 500 });
  }
}
