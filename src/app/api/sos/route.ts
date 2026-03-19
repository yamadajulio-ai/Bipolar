import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
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
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const limited = await checkRateLimit(`sos_write:${session.userId}`, 60, 60_000);
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
        userId: session.userId,
        action: parsed.data.action,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "sos" } });
    return NextResponse.json({ error: "Erro ao registrar" }, { status: 500 });
  }
}
