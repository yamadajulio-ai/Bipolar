import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getNativeAuth } from "@/lib/native-auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const crisisPlanSchema = z.object({
  trustedContacts: z.string().max(5000).optional(),
  professionalName: z.string().max(200).optional(),
  professionalPhone: z.string().max(20).optional(),
  medications: z.string().max(5000).optional(),
  preferredHospital: z.string().max(200).optional(),
  copingStrategies: z.string().max(5000).optional(),
  // Offline sync fields
  clientRev: z.number().int().min(0).optional(),
  deviceId: z.string().max(200).optional(),
});

/**
 * GET /api/native/plano-de-crise
 *
 * Returns the crisis plan with serverRev for offline sync.
 * Client caches this locally and uses serverRev to detect conflicts.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getNativeAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await checkRateLimit(`native-crisis-read:${auth.userId}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const plan = await prisma.crisisPlan.findUnique({
      where: { userId: auth.userId },
      select: {
        trustedContacts: true,
        professionalName: true,
        professionalPhone: true,
        medications: true,
        preferredHospital: true,
        copingStrategies: true,
        serverRev: true,
        updatedByDeviceId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      plan: plan ?? null,
      syncState: plan ? {
        serverRev: plan.serverRev,
        updatedAt: plan.updatedAt.toISOString(),
        updatedByDeviceId: plan.updatedByDeviceId,
      } : null,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-crisis-plan-read" } });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

/**
 * PUT /api/native/plano-de-crise
 *
 * Upserts crisis plan with optimistic concurrency.
 * Client sends clientRev (the serverRev it last saw).
 * If serverRev > clientRev, there's a conflict → return 409 with server data.
 * If no conflict, update and bump serverRev.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getNativeAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await checkRateLimit(`native-crisis-write:${auth.userId}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // Consent gate: require crisis_plan or legacy health_data consent
    const consent = await prisma.consent.findFirst({
      where: {
        userId: auth.userId,
        scope: { in: ["crisis_plan", "health_data"] },
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!consent) {
      return NextResponse.json({ error: "Consentimento necessário." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const parsed = crisisPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const { clientRev, deviceId, ...planData } = parsed.data;

    // Atomic optimistic concurrency via $transaction
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.crisisPlan.findUnique({
        where: { userId: auth.userId },
        select: {
          serverRev: true,
          trustedContacts: true,
          professionalName: true,
          professionalPhone: true,
          medications: true,
          preferredHospital: true,
          copingStrategies: true,
          updatedAt: true,
          updatedByDeviceId: true,
        },
      });

      // Conflict: server has newer version than what client last saw
      if (existing && clientRev !== undefined && existing.serverRev > clientRev) {
        return {
          conflict: true as const,
          serverPlan: existing,
          serverRev: existing.serverRev,
          updatedAt: existing.updatedAt.toISOString(),
          updatedByDeviceId: existing.updatedByDeviceId,
        };
      }

      const newRev = (existing?.serverRev ?? 0) + 1;

      const plan = await tx.crisisPlan.upsert({
        where: { userId: auth.userId },
        create: {
          userId: auth.userId,
          ...planData,
          serverRev: 1,
          updatedByDeviceId: deviceId ?? null,
        },
        update: {
          ...planData,
          serverRev: newRev,
          updatedByDeviceId: deviceId ?? null,
        },
      });

      return { conflict: false as const, plan };
    });

    if (result.conflict) {
      return NextResponse.json({
        error: "conflict",
        serverPlan: result.serverPlan,
        serverRev: result.serverRev,
        updatedAt: result.updatedAt,
        updatedByDeviceId: result.updatedByDeviceId,
      }, { status: 409 });
    }

    const plan = result.plan;

    return NextResponse.json({
      plan,
      syncState: {
        serverRev: plan.serverRev,
        updatedAt: plan.updatedAt.toISOString(),
        updatedByDeviceId: plan.updatedByDeviceId,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-crisis-plan-write" } });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
