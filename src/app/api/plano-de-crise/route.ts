import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const crisisPlanSchema = z.object({
  trustedContacts: z.string().max(5000).optional(),
  professionalName: z.string().max(200).optional(),
  professionalPhone: z.string().max(20).optional(),
  medications: z.string().max(5000).optional(),
  preferredHospital: z.string().max(200).optional(),
  copingStrategies: z.string().max(5000).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`crisisplan_read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const plan = await prisma.crisisPlan.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        trustedContacts: true,
        professionalName: true,
        professionalPhone: true,
        medications: true,
        preferredHospital: true,
        copingStrategies: true,
      },
    });

    return NextResponse.json(plan, { headers: { "Cache-Control": "private, no-cache" } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "crisisplan" } });
    return NextResponse.json(
      { error: "Erro ao buscar plano de crise." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Consent gate: require "crisis_plan" scope (or legacy "health_data" for existing users)
  const consent = await prisma.consent.findFirst({
    where: {
      userId: session.userId,
      scope: { in: ["crisis_plan", "health_data"] },
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento para plano de crise não concedido. Acesse Privacidade para autorizar." },
      { status: 403 },
    );
  }

  const allowed = await checkRateLimit(`crisisplan_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = crisisPlanSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const plan = await prisma.crisisPlan.upsert({
      where: { userId: session.userId },
      update: {
        trustedContacts: parsed.data.trustedContacts ?? null,
        professionalName: parsed.data.professionalName ?? null,
        professionalPhone: parsed.data.professionalPhone ?? null,
        medications: parsed.data.medications ?? null,
        preferredHospital: parsed.data.preferredHospital ?? null,
        copingStrategies: parsed.data.copingStrategies ?? null,
        serverRev: { increment: 1 },
      },
      create: {
        userId: session.userId,
        trustedContacts: parsed.data.trustedContacts ?? null,
        professionalName: parsed.data.professionalName ?? null,
        professionalPhone: parsed.data.professionalPhone ?? null,
        medications: parsed.data.medications ?? null,
        preferredHospital: parsed.data.preferredHospital ?? null,
        copingStrategies: parsed.data.copingStrategies ?? null,
      },
      select: {
        id: true,
        trustedContacts: true,
        professionalName: true,
        professionalPhone: true,
        medications: true,
        preferredHospital: true,
        copingStrategies: true,
      },
    });

    return NextResponse.json(plan);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "crisisplan" } });
    return NextResponse.json(
      { error: "Erro ao salvar plano de crise." },
      { status: 500 },
    );
  }
}
