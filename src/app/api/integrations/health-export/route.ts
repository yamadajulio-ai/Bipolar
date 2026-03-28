import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";
import {
  mergeWearableNights,
  enrichStandaloneHrvHr,
  type WearableNight,
} from "@/lib/sleepMerge";

type PrismaPromise = Prisma.PrismaPromise<unknown>;

// Allow up to 60s for large HAE payloads (Vercel Pro); free tier caps at 10s
export const maxDuration = 60;

/**
 * GET — Test endpoint connectivity and show imported sleep records.
 * If called with Bearer token: validates key and shows last sleep records.
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

  if (!integration || !integration.enabled || integration.service !== "health_auto_export") {
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
    message: "Conexão válida!",
    service: integration.service,
    enabled: integration.enabled,
    recentSleepLogs: recentLogs,
    totalHealthMetrics: metricsCount,
  }, {
    headers: { "Cache-Control": "private, no-cache" },
  });
}

/**
 * Background processor — handles the heavy DB operations (merge, upsert, enrich)
 * after the HTTP response has already been sent to the client.
 */
async function processPayloadInBackground(
  userId: string,
  apiKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
): Promise<void> {
  try {
    const metrics = body?.data?.metrics ?? body?.metrics ?? [];
    const result = parseHealthExportPayloadV2(body);

    // 1. Save debug payload — ONLY overwrite when sleep data is present
    const sleepMetricRaw = Array.isArray(metrics)
      ? metrics.find((m: { name?: string; data?: { value?: string }[] }) =>
          ["sleep_analysis", "Sleep Analysis", "sleepAnalysis", "sleep"].includes(m.name || "") ||
          (m.data?.slice(0, 5).some((e: { value?: string }) =>
            e.value && /Core|Deep|REM|Asleep|InBed|Awake/i.test(e.value))))
      : null;
    if (sleepMetricRaw) {
      const debugPayload = JSON.stringify({
        _sleepMetric: sleepMetricRaw,
        _parsedNights: result.sleepNights,
        _metricsCount: metrics.length,
        _timestamp: new Date().toISOString(),
      });
      await prisma.integrationKey.update({
        where: { apiKey },
        data: { lastPayloadDebug: debugPayload.slice(0, 50000) },
      });
    }

    // 2. Sleep nights: shared merge loop (Serializable transaction, stale purge, provenance)
    if (result.sleepNights.length > 0) {
      const nights: WearableNight[] = result.sleepNights.map((n) => ({
        date: n.date, bedtime: n.bedtime, wakeTime: n.wakeTime,
        totalHours: n.totalHours, quality: n.quality,
        awakenings: n.awakenings, awakeMinutes: n.awakeMinutes,
        hrv: n.hrv, heartRate: n.heartRate,
        hasStages: n.hasStages ?? true,
        providerRecordId: n.providerRecordId,
      }));
      await mergeWearableNights(prisma, userId, nights, "hae", `hae_worker_${Date.now()}`);
    }

    // 3. Upsert generic health metrics (idempotent, separate batch)
    if (result.genericMetrics.length > 0) {
      const metricOps: PrismaPromise[] = result.genericMetrics.map((gm) =>
        prisma.healthMetric.upsert({
          where: {
            userId_date_metric: {
              userId,
              date: gm.date,
              metric: gm.metric,
            },
          },
          update: { value: gm.value, unit: gm.unit },
          create: {
            userId,
            date: gm.date,
            metric: gm.metric,
            value: gm.value,
            unit: gm.unit,
          },
        }),
      );
      await prisma.$transaction(metricOps);
    }

    // 4. Enrich existing SleepLogs with standalone HRV/HR
    if (result.sleepNights.length === 0) {
      const { hrvByDate, hrByDate } = result.hrvHrData;
      await enrichStandaloneHrvHr(
        prisma, userId, hrvByDate, hrByDate, "hae", `hae_enrich_${Date.now()}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    Sentry.captureException(err, { tags: { endpoint: "health-export-bg" } });
    console.error(JSON.stringify({
      event: "health_export_bg_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: message.slice(0, 200),
    }));
  }
}

export async function POST(request: NextRequest) {
  // Auth via Bearer API key (NOT session — this is called from iOS app)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "API key ausente", detail: "Envie header: Authorization: Bearer [sua key]" },
      { status: 401 },
    );
  }
  const apiKey = authHeader.slice(7);

  // Validate API key
  const integration = await prisma.integrationKey.findUnique({
    where: { apiKey },
    select: { id: true, userId: true, enabled: true, service: true },
  });
  if (!integration || !integration.enabled || integration.service !== "health_auto_export") {
    return NextResponse.json(
      { error: "API key inválida" },
      { status: 401 },
    );
  }

  // Rate limit: 500 requests per hour per key (high to support HAE batch mode)
  if (!(await checkRateLimit(apiKey, 500, 3600000))) {
    return NextResponse.json({ error: "Limite de requisições atingido" }, { status: 429 });
  }

  // Reject oversized payloads before JSON parsing (max 5MB — HAE batches are typically <1MB)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 5_000_000) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  try {
    const body = await request.json();

    // Parse synchronously (CPU-only, fast) to get estimated counts for the response
    const result = parseHealthExportPayloadV2(body);

    const sleepNights = result.sleepNights.length;
    const metricsCount = result.genericMetrics.length;
    const hasAnyData = sleepNights > 0 || metricsCount > 0 ||
      (result.hrvHrData.hrvByDate.size > 0 || result.hrvHrData.hrByDate.size > 0);

    // Defer all heavy DB operations (merge, upsert, enrich) to background
    // so the HTTP response is sent immediately — prevents HAE CancellationError
    waitUntil(processPayloadInBackground(integration.userId, apiKey, body));

    return NextResponse.json({
      imported: sleepNights,
      sleepNights,
      metricsCount,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
      skippedCount: result.skippedCount,
      message: hasAnyData
        ? `Recebido: ${sleepNights} noite(s), ${metricsCount} metrica(s). Processando em segundo plano.`
        : "Nenhum dado reconhecido no payload",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    Sentry.captureException(err, { tags: { endpoint: "health-export" } });
    console.error(JSON.stringify({ event: "health_export_error", errorType: err instanceof Error ? err.constructor.name : "Unknown", message: message.slice(0, 200) }));
    return NextResponse.json(
      { error: "Erro ao processar dados de saúde" },
      { status: 500 },
    );
  }
}
