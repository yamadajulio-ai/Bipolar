import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthConnectPayload } from "@/lib/integrations/healthConnect";
import {
  mergeWearableNights,
  type WearableNight,
} from "@/lib/sleepMerge";

type PrismaPromise = Prisma.PrismaPromise<unknown>;

// Allow up to 60s for large payloads
export const maxDuration = 60;

/**
 * GET — Test endpoint connectivity (validates Bearer token).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { status: "error", message: "Header Authorization ausente. Envie: Authorization: Bearer [sua key]" },
      { status: 401 },
    );
  }
  const apiKey = authHeader.slice(7);

  const rlAllowed = await checkRateLimit(`hc_get:${apiKey.slice(0, 16)}`, 30, 60_000);
  if (!rlAllowed) {
    return NextResponse.json({ status: "error", message: "Muitas requisições" }, { status: 429 });
  }

  const integration = await prisma.integrationKey.findUnique({
    where: { apiKey },
    select: { id: true, userId: true, enabled: true, service: true },
  });

  if (!integration || !integration.enabled || integration.service !== "health_connect") {
    return NextResponse.json(
      { status: "error", message: "API key inválida ou desativada" },
      { status: 401 },
    );
  }

  // Consent gate: verify key owner still has "health_data" consent (LGPD Art. 11)
  const getConsent = await prisma.consent.findFirst({
    where: { userId: integration.userId, scope: "health_data", revokedAt: null },
    select: { id: true },
  });
  if (!getConsent) {
    return NextResponse.json(
      { status: "error", message: "Consentimento para dados de saúde revogado pelo usuário." },
      { status: 403 },
    );
  }

  const recentLogs = await prisma.sleepLog.findMany({
    where: { userId: integration.userId },
    select: { date: true, bedtime: true, wakeTime: true, totalHours: true, quality: true },
    orderBy: { date: "desc" },
    take: 10,
  });

  const metricsCount = await prisma.healthMetric.count({
    where: { userId: integration.userId },
  });

  return NextResponse.json({
    status: "ok",
    message: "Conexão válida! (Health Connect)",
    service: integration.service,
    enabled: integration.enabled,
    recentSleepLogs: recentLogs,
    totalHealthMetrics: metricsCount,
  });
}

/**
 * POST — Receive health data from HC Webhook / Life Dashboard Companion (Android).
 * Auth via Bearer token (same as HAE, separate IntegrationKey with service="health_connect").
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "API key ausente", detail: "Envie header: Authorization: Bearer [sua key]" },
      { status: 401 },
    );
  }
  const apiKey = authHeader.slice(7);

  const integration = await prisma.integrationKey.findUnique({
    where: { apiKey },
    select: { id: true, userId: true, enabled: true, service: true },
  });
  if (!integration || !integration.enabled || integration.service !== "health_connect") {
    return NextResponse.json(
      { error: "API key inválida ou desativada" },
      { status: 401 },
    );
  }

  // Rate limit: 500 requests per hour per key
  if (!(await checkRateLimit(apiKey, 500, 3600000))) {
    return NextResponse.json({ error: "Limite de requisições atingido" }, { status: 429 });
  }

  // Consent gate: verify key owner still has "health_data" consent (LGPD Art. 11)
  const consent = await prisma.consent.findFirst({
    where: { userId: integration.userId, scope: "health_data", revokedAt: null },
    select: { id: true },
  });
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento para dados de saúde revogado pelo usuário." },
      { status: 403 },
    );
  }

  // Body size limit: reject payloads > 5MB to prevent memory abuse
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 5_000_000) {
    return NextResponse.json(
      { error: "Payload muito grande", detail: "Máximo 5MB por requisição" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Payload JSON inválido" },
      { status: 400 },
    );
  }

  try {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = body as any;
    const debugInfo = {
      topLevelKeys: Object.keys(b || {}),
      sleepCount: Array.isArray(b?.sleep) ? b.sleep.length : 0,
      stepsCount: Array.isArray(b?.steps) ? b.steps.length : 0,
      hrCount: Array.isArray(b?.heart_rate) ? b.heart_rate.length : 0,
      hrvCount: Array.isArray(b?.heart_rate_variability) ? b.heart_rate_variability.length : 0,
      appVersion: b?.app_version,
    };

    const result = parseHealthConnectPayload(body);

    // Always save debug info for troubleshooting (standalone, non-critical)
    const debugPayload = JSON.stringify({
      _source: "health_connect",
      _keys: Object.keys((body as Record<string, unknown>) || {}),
      _counts: debugInfo,
      _parsedNightsCount: result.sleepNights.length,
      _parsedNightsDates: result.sleepNights.map((n) => n.date),
      _parsedMetrics: result.genericMetrics.length,
      _timestamp: new Date().toISOString(),
    });
    await prisma.integrationKey.update({
      where: { apiKey },
      data: { lastPayloadDebug: debugPayload.slice(0, 50000) },
    });

    // Sleep nights: shared merge loop (Serializable tx, stale purge, provenance)
    if (result.sleepNights.length > 0) {
      const nights: WearableNight[] = result.sleepNights.map((n) => ({
        date: n.date, bedtime: n.bedtime, wakeTime: n.wakeTime,
        totalHours: n.totalHours, quality: n.quality,
        awakenings: n.awakenings,
        awakeMinutes: Math.round((n as { awakeMinutes?: number }).awakeMinutes ?? 0),
        hrv: n.hrv, heartRate: n.heartRate,
        hasStages: n.hasStages ?? false,
        providerRecordId: n.providerRecordId,
      }));
      await mergeWearableNights(prisma, integration.userId, nights, "health_connect", `hc_${Date.now()}`);
    }

    // Upsert generic health metrics (idempotent, separate batch)
    if (result.genericMetrics.length > 0) {
      const metricOps: PrismaPromise[] = result.genericMetrics.map((gm) =>
        prisma.healthMetric.upsert({
          where: {
            userId_date_metric: {
              userId: integration.userId,
              date: gm.date,
              metric: gm.metric,
            },
          },
          update: { value: gm.value, unit: gm.unit },
          create: {
            userId: integration.userId,
            date: gm.date,
            metric: gm.metric,
            value: gm.value,
            unit: gm.unit,
          },
        }),
      );
      await prisma.$transaction(metricOps);
    }

    const sleepImported = result.sleepNights.length;
    const metricsImported = result.genericMetrics.length;
    const hasAnyData = sleepImported > 0 || metricsImported > 0;

    return NextResponse.json({
      imported: sleepImported,
      sleepNights: sleepImported,
      metricsImported,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
      message: hasAnyData
        ? `Importado: ${sleepImported} noite(s), ${metricsImported} métrica(s)`
        : "Nenhum dado reconhecido no payload",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    Sentry.captureException(err, { tags: { endpoint: "health-connect" } });
    console.error(JSON.stringify({ event: "health_connect_error", errorType: err instanceof Error ? err.constructor.name : "Unknown", message: message.slice(0, 200) }));
    return NextResponse.json(
      { error: "Erro ao processar dados de saúde" },
      { status: 500 },
    );
  }
}
