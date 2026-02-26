import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { getSession } from "@/lib/auth";
import { cloneWeek } from "@/lib/planner/weekClone";

const cloneSchema = z.object({
  fromWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["all", "flexOnly", "exceptAnchors"]).default("all"),
  offsetMin: z.number().int().min(-480).max(480).default(0),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = cloneSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const { fromWeekStart, toWeekStart, mode, offsetMin } = parsed.data;

    if (fromWeekStart === toWeekStart) {
      return NextResponse.json(
        { error: "Semana de origem e destino não podem ser iguais." },
        { status: 400 },
      );
    }

    const result = await cloneWeek(
      session.userId,
      fromWeekStart,
      toWeekStart,
      mode,
      offsetMin,
    );

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao clonar semana." },
      { status: 500 },
    );
  }
}
