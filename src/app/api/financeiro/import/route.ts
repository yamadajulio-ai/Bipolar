import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { hasConsent } from "@/lib/consent";
import * as Sentry from "@sentry/nextjs";
import { ingestFinancialFile, IngestError } from "@/lib/financeiro/ingest";

export const maxDuration = 60;

const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`financeiro_import_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  // Consent gate for financial data
  const consent = await hasConsent(session.userId, "health_data");
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento necessário para importar dados financeiros." },
      { status: 403, headers: HEADERS },
    );
  }

  try {
    const formData = await request.formData();
    const raw = formData.get("file");
    if (!raw || !(raw instanceof File)) {
      return NextResponse.json(
        { errors: { file: ["Arquivo obrigatório (.csv, .xlsx, .ofx ou .qfx)"] } },
        { status: 400, headers: HEADERS },
      );
    }
    const file = raw;

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { errors: { file: ["Arquivo muito grande. Tamanho máximo: 10MB."] } },
        { status: 400, headers: HEADERS },
      );
    }

    // Sanitize filename against path traversal
    const fileName = (file.name.split(/[/\\]/).pop() || "file").toLowerCase();

    if (fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
      return NextResponse.json(
        { errors: { file: ["Formato .xls não é suportado. Exporte como .xlsx, .csv, .ofx ou .qfx."] } },
        { status: 400, headers: HEADERS },
      );
    }

    // Route to unified ingestion pipeline
    let content: string | ArrayBuffer;
    if (fileName.endsWith(".xlsx")) {
      content = await file.arrayBuffer();
    } else {
      content = await file.text();
    }

    const safeName = file.name.split(/[/\\]/).pop() || "file";
    const result = await ingestFinancialFile(content, safeName, {
      userId: session.userId,
      channel: "web_upload",
      fileName: safeName,
      fileSize: file.size,
    });

    return NextResponse.json({
      imported: result.imported,
      skipped: result.skipped,
      total: result.total,
      source: result.source,
      bank: result.bank,
    }, { headers: HEADERS });
  } catch (err) {
    if (err instanceof IngestError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400, headers: HEADERS },
      );
    }
    Sentry.captureException(err, { tags: { endpoint: "financeiro_import" } });
    return NextResponse.json(
      { error: "Erro ao importar arquivo." },
      { status: 500, headers: HEADERS },
    );
  }
}
