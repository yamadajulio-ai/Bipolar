import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseMobillsCsv } from "@/lib/financeiro/parseMobillsCsv";
import { parseMobillsXlsx } from "@/lib/financeiro/parseMobillsXlsx";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
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
      transactions = parseMobillsXlsx(buffer);
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

    let imported = 0;
    let skipped = 0;

    for (const tx of transactions) {
      try {
        await prisma.financialTransaction.upsert({
          where: {
            userId_date_description_amount: {
              userId: session.userId,
              date: tx.date,
              description: tx.description,
              amount: tx.amount,
            },
          },
          update: {},
          create: {
            userId: session.userId,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
            account: tx.account,
            source: "mobills_csv",
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ imported, skipped, total: transactions.length });
  } catch {
    return NextResponse.json(
      { error: "Erro ao importar arquivo." },
      { status: 500 },
    );
  }
}
