import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";

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
  });
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

    const metrics = body?.data?.metrics ?? body?.metrics ?? [];
    const debugInfo = {
      topLevelKeys: Object.keys(body || {}),
      metricsCount: Array.isArray(metrics) ? metrics.length : 0,
      metricNames: Array.isArray(metrics)
        ? metrics.map((m: { name?: string; units?: string }) => m.name || `(unnamed, units=${m.units})`)
        : [],
    };

    console.log("[health-export] Debug info:", JSON.stringify(debugInfo));

    const result = parseHealthExportPayloadV2(body);

    // Log sleep parsing results for debugging
    if (result.sleepNights.length > 0) {
      console.log("[health-export] Sleep nights parsed:", JSON.stringify(result.sleepNights));
    }

    // ── Batch all DB writes in a single transaction ──
    const txOps: PrismaPromise[] = [];

    // 1. Save debug payload — ONLY overwrite when sleep data is present
    //    (prevents non-sleep metrics from overwriting sleep debug data)
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
      txOps.push(
        prisma.integrationKey.update({
          where: { apiKey },
          data: { lastPayloadDebug: debugPayload.slice(0, 50000) },
        }),
      );
    }

    // 2. Upsert sleep nights
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

    // 3. Upsert generic health metrics
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
    await prisma.$transaction(txOps);

    const sleepImported = result.sleepNights.length;
    const metricsImported = result.genericMetrics.length;

    // 4. Enrich existing SleepLogs with standalone HRV/HR (separate pass)
    let hrvHrEnriched = 0;
    if (sleepImported === 0) {
      const { hrvByDate, hrByDate } = result.hrvHrData;
      const allDates = [...new Set([...hrvByDate.keys(), ...hrByDate.keys()])];

      if (allDates.length > 0) {
        const enrichOps: PrismaPromise[] = [];
        // Batch-fetch existing sleep logs for all dates
        const existingLogs = await prisma.sleepLog.findMany({
          where: {
            userId: integration.userId,
            date: { in: allDates },
          },
          select: { date: true },
        });
        const existingDates = new Set(existingLogs.map((l) => l.date));

        for (const date of allDates) {
          if (!existingDates.has(date)) continue;
          const hrv = hrvByDate.get(date);
          const hr = hrByDate.get(date);
          const updateData: Record<string, number> = {};
          if (hrv !== undefined && hrv >= 1 && hrv <= 300) updateData.hrv = hrv;
          if (hr !== undefined && hr >= 20 && hr <= 250) updateData.heartRate = hr;
          if (Object.keys(updateData).length > 0) {
            enrichOps.push(
              prisma.sleepLog.update({
                where: { userId_date: { userId: integration.userId, date } },
                data: updateData,
              }),
            );
            hrvHrEnriched++;
          }
        }
        if (enrichOps.length > 0) await prisma.$transaction(enrichOps);
      }
    }

    const hasAnyData = sleepImported > 0 || hrvHrEnriched > 0 || metricsImported > 0;
    console.log("[health-export] Result:", JSON.stringify({
      sleepImported, hrvHrEnriched, metricsImported,
    }));

    return NextResponse.json({
      imported: sleepImported,
      sleepNights: sleepImported,
      hrvHrEnriched,
      metricsImported,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
      message: hasAnyData
        ? `Importado: ${sleepImported} noite(s), ${hrvHrEnriched} enriquecimento(s) HRV/HR, ${metricsImported} metrica(s)`
        : "Nenhum dado reconhecido no payload",
      debug: debugInfo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    Sentry.captureException(err, { tags: { endpoint: "health-export" } });
    console.error("[health-export] Error:", message, err);
    return NextResponse.json(
      { error: "Erro ao processar dados de saúde" },
      { status: 500 },
    );
  }
}
