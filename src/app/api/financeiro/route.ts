import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { hasConsent } from "@/lib/consent";
import { localDateStr } from "@/lib/dateUtils";
import * as Sentry from "@sentry/nextjs";

const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  description: z.string().min(1).max(200),
  amount: z.number(),
  category: z.string().min(1).max(100),
  account: z.string().max(100).optional(),
  occurredAt: z.string().datetime().optional(),
});

const HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`financeiro_read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  const consent = await hasConsent(session.userId, "health_data");
  if (!consent) {
    return NextResponse.json({ error: "Consentimento necessário." }, { status: 403, headers: HEADERS });
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
    dateFilter = { gte: localDateStr(cutoff) };
  }

  try {
    const transactions = await prisma.financialTransaction.findMany({
      where: { userId: session.userId, date: dateFilter },
      orderBy: { date: "desc" },
      select: {
        id: true, date: true, description: true, amount: true,
        category: true, account: true, occurredAt: true, source: true, createdAt: true,
      },
    });

    return NextResponse.json(transactions, { headers: HEADERS });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "financeiro" } });
    return NextResponse.json({ error: "Erro interno" }, { status: 500, headers: HEADERS });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`financeiro_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  const consent = await hasConsent(session.userId, "health_data");
  if (!consent) {
    return NextResponse.json({ error: "Consentimento necessário." }, { status: 403, headers: HEADERS });
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
      return NextResponse.json({ errors: fieldErrors }, { status: 400, headers: HEADERS });
    }

    const tx = await prisma.financialTransaction.create({
      data: {
        userId: session.userId,
        date: parsed.data.date,
        description: parsed.data.description,
        amount: parsed.data.amount,
        category: parsed.data.category,
        account: parsed.data.account || null,
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
        source: "manual",
      },
      select: {
        id: true, date: true, description: true, amount: true,
        category: true, account: true, occurredAt: true, source: true, createdAt: true,
      },
    });

    return NextResponse.json(tx, { status: 201, headers: HEADERS });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "financeiro" } });
    return NextResponse.json(
      { error: "Erro ao criar transação." },
      { status: 500, headers: HEADERS },
    );
  }
}
