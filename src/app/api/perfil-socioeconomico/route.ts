import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

  const profile = await prisma.socioeconomicProfile.findUnique({
    where: { userId: session.userId },
  });

  return NextResponse.json(profile);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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
    });

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
