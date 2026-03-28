import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const profileSchema = z.object({
  careAccess: z.enum(["regular", "irregular", "sem_acesso"]),
  medicationSource: z.enum(["sus", "plano", "particular", "nao_toma"]),
  consultFrequency: z.enum(["mensal", "trimestral", "semestral", "quando_consigo", "nunca"]),
  hasEmergencyContact: z.boolean(),
  livingSituation: z.enum(["estavel", "instavel", "situacao_rua"]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`perfil_read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const profile = await prisma.socioeconomicProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        careAccess: true,
        medicationSource: true,
        consultFrequency: true,
        hasEmergencyContact: true,
        livingSituation: true,
      },
    });

    return NextResponse.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "perfil" } });
    return NextResponse.json(
      { error: "Erro ao buscar perfil." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`perfil_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const data = {
      careAccess: parsed.data.careAccess,
      medicationSource: parsed.data.medicationSource,
      consultFrequency: parsed.data.consultFrequency,
      hasEmergencyContact: parsed.data.hasEmergencyContact,
      livingSituation: parsed.data.livingSituation ?? null,
    };

    const profile = await prisma.socioeconomicProfile.upsert({
      where: { userId: session.userId },
      update: data,
      create: { userId: session.userId, ...data },
      select: {
        id: true,
        careAccess: true,
        medicationSource: true,
        consultFrequency: true,
        hasEmergencyContact: true,
        livingSituation: true,
      },
    });

    return NextResponse.json(profile);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "perfil" } });
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
