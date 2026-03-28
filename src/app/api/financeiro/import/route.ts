import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";
import { parseMobillsCsv } from "@/lib/financeiro/parseMobillsCsv";
import { parseMobillsXlsx } from "@/lib/financeiro/parseMobillsXlsx";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`financeiro_import_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { errors: { file: ["Arquivo obrigatorio (.csv ou .xlsx)"] } },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    const isXlsx =
      fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    let transactions;
    if (isXlsx) {
      const buffer = await file.arrayBuffer();
      transactions = await parseMobillsXlsx(buffer);
    } else {
      const content = await file.text();
      transactions = parseMobillsCsv(content);
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          errors: {
            file: [
              "Nenhuma transacao encontrada no arquivo. Verifique se o formato esta correto.",
            ],
          },
        },
        { status: 400 },
      );
    }

    // Use createMany with skipDuplicates — single SQL INSERT ... ON CONFLICT DO NOTHING
    // Much faster than individual upserts (1 query vs N queries)
    const total = transactions.length;
    let imported = 0;

    const BATCH_SIZE = 200;
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const result = await prisma.financialTransaction.createMany({
        data: batch.map((tx) => ({
          userId: session.userId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          account: tx.account,
          source: "mobills_csv",
        })),
        skipDuplicates: true,
      });
      imported += result.count;
    }

    const skipped = total - imported;
    return NextResponse.json({ imported, skipped, total });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "financeiro_import" } });
    return NextResponse.json(
      { error: "Erro ao importar arquivo." },
      { status: 500 },
    );
  }
}
