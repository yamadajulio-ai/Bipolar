import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { quickAddParse } from "@/lib/planner/quickAddParse";

const quickAddSchema = z.object({
  text: z.string().min(1).max(200),
  contextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = quickAddSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: { text: parsed.error.issues.map((i) => i.message) } },
        { status: 400 },
      );
    }

    const result = quickAddParse(parsed.data.text, parsed.data.contextDate);

    if (!result.isComplete) {
      // Return parsed data for the client to open the modal prefilled
      return NextResponse.json({ parsed: result, created: false });
    }

    // Auto-create the block
    const block = await prisma.plannerBlock.create({
      data: {
        userId: session.userId,
        title: result.title,
        category: result.category,
        kind: result.kind,
        startAt: new Date(result.startAt),
        endAt: new Date(result.endAt),
        energyCost: result.energyCost,
        stimulation: result.stimulation,
      },
      include: { recurrence: true, exceptions: true },
    });

    return NextResponse.json({ block, created: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar quick-add." },
      { status: 500 },
    );
  }
}
