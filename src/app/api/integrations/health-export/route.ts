import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";

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
  });

  if (!integration || !integration.enabled || integration.service !== "health_auto_export") {
    return NextResponse.json(
      { status: "error", message: "API key inválida ou desativada", keyLength: apiKey.length },
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
  });
  if (!integration || !integration.enabled || integration.service !== "health_auto_export") {
    return NextResponse.json(
      { error: "API key inválida", detail: `Key length: ${apiKey.length}, expected: 64` },
      { status: 401 },
    );
  }

  // Rate limit: 60 requests per hour per key
  if (!(await checkRateLimit(apiKey, 60, 3600000))) {
    return NextResponse.json({ error: "Limite de requisições atingido" }, { status: 429 });
  }

  try {
    const body = await request.json();

    // Store raw payload sample in DB for debugging (first 50KB)
    const payloadStr = JSON.stringify(body, null, 2);
    await prisma.integrationKey.update({
      where: { apiKey },
      data: { lastPayloadDebug: payloadStr.slice(0, 50000) },
    });

    const metrics = body?.data?.metrics ?? body?.metrics ?? [];
    const debugInfo = {
      topLevelKeys: Object.keys(body || {}),
      metricsCount: Array.isArray(metrics) ? metrics.length : 0,
      metricNames: Array.isArray(metrics)
        ? metrics.map((m: { name?: string; units?: string }) => m.name || `(unnamed, units=${m.units})`)
        : [],
    };

    console.log("[health-export] Debug info:", JSON.stringify(debugInfo));

    // Log first metric's first data entry for format diagnosis
    if (Array.isArray(metrics) && metrics.length > 0) {
      const m0 = metrics[0];
      const sample = Array.isArray(m0.data) ? m0.data.slice(0, 2) : [];
      console.log("[health-export] First metric sample:", JSON.stringify({
        name: m0.name,
        units: m0.units,
        dataCount: m0.data?.length,
        sample,
      }));
    }

    const result = parseHealthExportPayloadV2(body);

    // ── 1. Upsert sleep nights ──
    let sleepImported = 0;
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
      await prisma.sleepLog.upsert({
        where: {
          userId_date: { userId: integration.userId, date: night.date },
        },
        update: data,
        create: { userId: integration.userId, date: night.date, ...data },
      });
      sleepImported++;
    }

    // ── 2. Enrich existing SleepLogs with standalone HRV/HR ──
    // When a separate automation sends only HRV/HR (no sleep), update
    // any existing SleepLog records for those dates.
    let hrvHrEnriched = 0;
    if (result.sleepNights.length === 0) {
      const { hrvByDate, hrByDate } = result.hrvHrData;
      const allDates = new Set([...hrvByDate.keys(), ...hrByDate.keys()]);

      for (const date of allDates) {
        const hrv = hrvByDate.get(date);
        const hr = hrByDate.get(date);
        if (hrv === undefined && hr === undefined) continue;

        const existing = await prisma.sleepLog.findUnique({
          where: { userId_date: { userId: integration.userId, date } },
        });
        if (!existing) continue;

        const updateData: Record<string, number> = {};
        if (hrv !== undefined && hrv >= 1 && hrv <= 300) updateData.hrv = hrv;
        if (hr !== undefined && hr >= 20 && hr <= 250) updateData.heartRate = hr;

        if (Object.keys(updateData).length > 0) {
          await prisma.sleepLog.update({
            where: { userId_date: { userId: integration.userId, date } },
            data: updateData,
          });
          hrvHrEnriched++;
        }
      }
    }

    // ── 3. Upsert generic health metrics ──
    let metricsImported = 0;
    for (const gm of result.genericMetrics) {
      await prisma.healthMetric.upsert({
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
      });
      metricsImported++;
    }

    const hasAnyData = sleepImported > 0 || hrvHrEnriched > 0 || metricsImported > 0;
    console.log("[health-export] Result:", JSON.stringify({
      sleepImported, hrvHrEnriched, metricsImported,
      sleepNightsFound: result.sleepNights.length,
      hrvDates: result.hrvHrData.hrvByDate.size,
      hrDates: result.hrvHrData.hrByDate.size,
      genericMetricsFound: result.genericMetrics.length,
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
    console.error("[health-export] Error:", message, err);
    return NextResponse.json(
      { error: "Erro ao processar dados de saude", detail: message },
      { status: 500 },
    );
  }
}
