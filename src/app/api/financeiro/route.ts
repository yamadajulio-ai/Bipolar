import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  description: z.string().min(1).max(200),
  amount: z.number(),
  category: z.string().min(1).max(100),
  account: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  let dateFilter: { gte: string; lte?: string };

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    dateFilter = { gte: `${month}-01`, lte: `${month}-${String(lastDay).padStart(2, "0")}` };
  } else {
    const days = parseInt(searchParams.get("days") || "30");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    dateFilter = { gte: `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}` };
  }

  const transactions = await prisma.financialTransaction.findMany({
    where: { userId: session.userId, date: dateFilter },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const tx = await prisma.financialTransaction.create({
      data: {
        userId: session.userId,
        date: parsed.data.date,
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
        account: parsed.data.account || null,
        source: "manual",
      },
    });

    return NextResponse.json(tx, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar transação." },
      { status: 500 },
    );
  }
}
