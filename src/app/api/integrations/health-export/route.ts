import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayload } from "@/lib/integrations/healthExport";

/**
 * GET — Test endpoint connectivity and show imported sleep records.
 * If called with Bearer token: validates key and shows last sleep records.
 * If called without auth (from browser via session): shows user's sleep records.
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

  // Show last imported sleep records for this user
  const recentLogs = await prisma.sleepLog.findMany({
    where: { userId: integration.userId },
    orderBy: { date: "desc" },
    take: 10,
  });

  return NextResponse.json({
    status: "ok",
    message: "Conexão válida!",
    service: integration.service,
    enabled: integration.enabled,
    recentSleepLogs: recentLogs,
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
  if (!checkRateLimit(apiKey, 60, 3600000)) {
    return NextResponse.json({ error: "Limite de requisições atingido" }, { status: 429 });
  }

  try {
    const body = await request.json();

    // Store raw payload sample in DB for debugging (first 5KB)
    const payloadStr = JSON.stringify(body, null, 2);
    await prisma.integrationKey.update({
      where: { apiKey },
      data: { lastPayloadDebug: payloadStr.slice(0, 5000) },
    });

    console.log("[health-export] Raw payload:", payloadStr.slice(0, 5000));

    // Build debug info from payload
    const metrics = body?.data?.metrics ?? body?.metrics ?? [];
    const sleepMetric = Array.isArray(metrics)
      ? metrics.find((m: { name: string }) =>
          ["sleep_analysis", "Sleep Analysis", "sleepAnalysis", "sleep"].includes(m.name))
      : null;

    const debugInfo = {
      topLevelKeys: Object.keys(body || {}),
      hasData: !!body?.data,
      hasMetrics: !!body?.data?.metrics,
      hasTopLevelMetrics: !!body?.metrics,
      metricsCount: Array.isArray(metrics) ? metrics.length : 0,
      metricNames: Array.isArray(metrics) ? metrics.map((m: { name: string }) => m.name) : [],
      sleepMetricFound: !!sleepMetric,
      sleepDataCount: sleepMetric?.data?.length ?? 0,
      sleepDataSample: sleepMetric?.data?.slice(0, 3) ?? [],
    };

    console.log("[health-export] Debug info:", JSON.stringify(debugInfo));

    const sleepNights = parseHealthExportPayload(body);

    console.log("[health-export] Parsed nights:", JSON.stringify(sleepNights));

    if (sleepNights.length === 0) {
      return NextResponse.json({
        imported: 0,
        message: "Nenhum dado de sono encontrado no payload",
        debug: debugInfo,
      });
    }

    let imported = 0;
    for (const night of sleepNights) {
      await prisma.sleepLog.upsert({
        where: {
          userId_date: { userId: integration.userId, date: night.date },
        },
        update: {
          bedtime: night.bedtime,
          wakeTime: night.wakeTime,
          totalHours: night.totalHours,
          quality: night.quality,
          awakenings: night.awakenings,
        },
        create: {
          userId: integration.userId,
          date: night.date,
          bedtime: night.bedtime,
          wakeTime: night.wakeTime,
          totalHours: night.totalHours,
          quality: night.quality,
          awakenings: night.awakenings,
        },
      });
      imported++;
    }

    return NextResponse.json({ imported, nights: sleepNights, debug: debugInfo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[health-export] Error:", message, err);
    return NextResponse.json(
      { error: "Erro ao processar dados de sono", detail: message },
      { status: 500 },
    );
  }
}
