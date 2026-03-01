import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayload } from "@/lib/integrations/healthExport";

/**
 * GET — Test endpoint connectivity. Returns OK if API key is valid.
 * Useful for debugging from a browser or the Health Auto Export app.
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

  return NextResponse.json({
    status: "ok",
    message: "Conexão válida! O endpoint está pronto para receber dados.",
    service: integration.service,
    enabled: integration.enabled,
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

    // Log payload structure for debugging
    const debugInfo = {
      hasData: !!body?.data,
      hasMetrics: !!body?.data?.metrics,
      metricsCount: body?.data?.metrics?.length ?? 0,
      metricNames: body?.data?.metrics?.map((m: { name: string }) => m.name) ?? [],
    };

    const sleepNights = parseHealthExportPayload(body);

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

    return NextResponse.json({ imported, nights: sleepNights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro ao processar dados de sono", detail: message },
      { status: 500 },
    );
  }
}
