import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthConnectPayload } from "@/lib/integrations/healthConnect";
import {
  findBestMatch,
  computeAbsoluteTimestamps,
  computeRawHash,
  reconcileWearableIntoExisting,
  type ExistingRecord,
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

    console.log("[health-connect] Payload info:", JSON.stringify(debugInfo));

    const result = parseHealthConnectPayload(body);

    if (result.sleepNights.length > 0) {
      console.log("[health-connect] Sleep nights parsed:", JSON.stringify(result.sleepNights));
    }

    // ── Batch all DB writes in a single transaction ──
    const txOps: PrismaPromise[] = [];

    // Always save debug info for troubleshooting
    const debugPayload = JSON.stringify({
      _source: "health_connect",
      _keys: Object.keys((body as Record<string, unknown>) || {}),
      _counts: debugInfo,
      _parsedNights: result.sleepNights,
      _parsedMetrics: result.genericMetrics.length,
      _timestamp: new Date().toISOString(),
    });
    txOps.push(
      prisma.integrationKey.update({
        where: { apiKey },
        data: { lastPayloadDebug: debugPayload.slice(0, 50000) },
      }),
    );

    // Pre-fetch ALL existing records for affected dates (not just manual — check fieldProvenance)
    const affectedDates = [...new Set(result.sleepNights.map((n) => n.date))];
    const existingRecords = affectedDates.length > 0
      ? await prisma.sleepLog.findMany({
          where: { userId: integration.userId, date: { in: affectedDates } },
          select: {
            id: true, bedtime: true, wakeTime: true, bedtimeAt: true, wakeTimeAt: true,
            totalHours: true, quality: true, perceivedQuality: true, awakenings: true,
            awakeMinutes: true, hrv: true, heartRate: true, excluded: true, source: true,
            fieldProvenance: true, providerRecordId: true, rawHash: true, preRoutine: true,
            notes: true, mergeLog: true, date: true,
          },
        })
      : [];

    const importBatchId = `hc_${Date.now()}`;
    const consumedIds = new Set<string>();
    const existingByDate = new Map<string, typeof existingRecords>();
    for (const rec of existingRecords) {
      const list = existingByDate.get(rec.date) || [];
      list.push(rec);
      existingByDate.set(rec.date, list);
    }

    // Reconcile sleep nights using v2 merge system
    for (const night of result.sleepNights) {
      const dateRecords = (existingByDate.get(night.date) || []).filter((r) => !consumedIds.has(r.id));
      const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps(night.date, night.bedtime, night.wakeTime);

      const matchResult = findBestMatch(
        { bedtime: night.bedtime, bedtimeAt, wakeTimeAt },
        dateRecords,
      );

      const existingRecord = matchResult?.match as ExistingRecord | undefined ?? null;
      if (existingRecord) consumedIds.add(existingRecord.id);

      const rawHash = computeRawHash({
        date: night.date, bedtime: night.bedtime, wakeTime: night.wakeTime,
        totalHours: night.totalHours, quality: night.quality,
      });

      const reconciled = reconcileWearableIntoExisting(
        {
          bedtime: night.bedtime, wakeTime: night.wakeTime,
          totalHours: night.totalHours, quality: night.quality,
          awakenings: night.awakenings,
          awakeMinutes: Math.round((night as { awakeMinutes?: number }).awakeMinutes ?? 0),
          hrv: night.hrv, heartRate: night.heartRate,
          hasStages: night.hasStages ?? false,
          providerRecordId: night.providerRecordId, rawHash,
        },
        existingRecord,
        night.date,
        "health_connect",
        importBatchId,
      );

      for (const op of reconciled.operations) {
        if (op.type === "delete") {
          txOps.push(prisma.sleepLog.delete({ where: { id: op.id } }));
        }
      }

      txOps.push(
        prisma.sleepLog.upsert({
          where: {
            userId_date_bedtime: { userId: integration.userId, date: night.date, bedtime: night.bedtime },
          },
          update: reconciled.data as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          create: { userId: integration.userId, date: night.date, ...reconciled.data } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
    Sentry.captureException(err, { tags: { endpoint: "health-connect" } });
    console.error("[health-connect] Error:", message, err);
    return NextResponse.json(
      { error: "Erro ao processar dados de saúde" },
      { status: 500 },
    );
  }
}
