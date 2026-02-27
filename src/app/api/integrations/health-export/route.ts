import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayload } from "@/lib/integrations/healthExport";

export async function POST(request: NextRequest) {
  // Auth via Bearer API key (NOT session — this is called from iOS app)
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "API key ausente" }, { status: 401 });
  }
  const apiKey = authHeader.slice(7);

  // Validate API key
  const integration = await prisma.integrationKey.findUnique({
    where: { apiKey },
  });
  if (!integration || !integration.enabled || integration.service !== "health_auto_export") {
    return NextResponse.json({ error: "API key invalida" }, { status: 401 });
  }

  // Rate limit: 60 requests per hour per key
  if (!checkRateLimit(apiKey, 60, 3600000)) {
    return NextResponse.json({ error: "Limite de requisicoes atingido" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const sleepNights = parseHealthExportPayload(body);

    if (sleepNights.length === 0) {
      return NextResponse.json({ imported: 0, message: "Nenhum dado de sono encontrado" });
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

    return NextResponse.json({ imported });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar dados de sono." },
      { status: 500 },
    );
  }
}
