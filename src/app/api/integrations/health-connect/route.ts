import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthConnectPayload } from "@/lib/integrations/healthConnect";

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

  const integration = await prisma.integrationKey.findUnique({
    where: { apiKey },
  });

  if (!integration || !integration.enabled || integration.service !== "health_connect") {
    return NextResponse.json(
      { status: "error", message: "API key inválida ou desativada" },
      { status: 401 },
    );
  }

  const recentLogs = await prisma.sleepLog.findMany({
    where: { userId: integration.userId },
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
  });
  if (!integration || !integration.enabled || integration.service !== "health_connect") {
    return NextResponse.json(
      { error: "API key inválida", detail: `Key length: ${apiKey.length}, expected: 64` },
      { status: 401 },
    );
  }

  // Rate limit: 500 requests per hour per key
  if (!(await checkRateLimit(apiKey, 500, 3600000))) {
    return NextResponse.json({ error: "Limite de requisições atingido" }, { status: 429 });
  }

  try {
    const body = await request.json();

    const debugInfo = {
      topLevelKeys: Object.keys(body || {}),
      sleepCount: Array.isArray(body?.sleep) ? body.sleep.length : 0,
      stepsCount: Array.isArray(body?.steps) ? body.steps.length : 0,
      hrCount: Array.isArray(body?.heart_rate) ? body.heart_rate.length : 0,
      hrvCount: Array.isArray(body?.heart_rate_variability) ? body.heart_rate_variability.length : 0,
      appVersion: body?.app_version,
    };

    console.log("[health-connect] Payload info:", JSON.stringify(debugInfo));

    const result = parseHealthConnectPayload(body);

    if (result.sleepNights.length > 0) {
      console.log("[health-connect] Sleep nights parsed:", JSON.stringify(result.sleepNights));
    }

    // ── Batch all DB writes in a single transaction ──
    const txOps: PrismaPromise[] = [];

    // Save debug payload
    if (body?.sleep?.length > 0) {
      const debugPayload = JSON.stringify({
        _source: "health_connect",
        _sleepData: body.sleep,
        _parsedNights: result.sleepNights,
        _timestamp: new Date().toISOString(),
      });
      txOps.push(
        prisma.integrationKey.update({
          where: { apiKey },
          data: { lastPayloadDebug: debugPayload.slice(0, 50000) },
        }),
      );
    }

    // Upsert sleep nights
    for (const night of result.sleepNights) {
      const data = {
        bedtime: night.bedtime,
        wakeTime: night.wakeTime,
        totalHours: night.totalHours,
        quality: night.quality,
        awakenings: night.awakenings,
        hrv: night.hrv ?? null,
        heartRate: night.heartRate ?? null,
      };
      txOps.push(
        prisma.sleepLog.upsert({
          where: {
            userId_date: { userId: integration.userId, date: night.date },
          },
          update: data,
          create: { userId: integration.userId, date: night.date, ...data },
        }),
      );
    }

    // Upsert generic health metrics
    for (const gm of result.genericMetrics) {
      txOps.push(
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
    }

    // Execute all writes in one round-trip
    if (txOps.length > 0) {
      await prisma.$transaction(txOps);
    }

    const sleepImported = result.sleepNights.length;
    const metricsImported = result.genericMetrics.length;
    const hasAnyData = sleepImported > 0 || metricsImported > 0;

    console.log("[health-connect] Result:", JSON.stringify({ sleepImported, metricsImported }));

    return NextResponse.json({
      imported: sleepImported,
      sleepNights: sleepImported,
      metricsImported,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
      message: hasAnyData
        ? `Importado: ${sleepImported} noite(s), ${metricsImported} métrica(s)`
        : "Nenhum dado reconhecido no payload",
      debug: debugInfo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[health-connect] Error:", message, err);
    return NextResponse.json(
      { error: "Erro ao processar dados de saúde", detail: message },
      { status: 500 },
    );
  }
}
