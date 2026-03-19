import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  // Validate date params — reject garbage that `new Date()` would silently accept
  if (timeMin && isNaN(new Date(timeMin).getTime())) {
    return NextResponse.json({ error: "timeMin inválido" }, { status: 400 });
  }
  if (timeMax && isNaN(new Date(timeMax).getTime())) {
    return NextResponse.json({ error: "timeMax inválido" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: any = { userId: session.userId };
  if (timeMin || timeMax) {
    where = {
      userId: session.userId,
      OR: [
        {
          ...(timeMin ? { endAt: { gte: new Date(timeMin) } } : {}),
          ...(timeMax ? { startAt: { lte: new Date(timeMax) } } : {}),
        },
        ...(timeMax
          ? [
              {
                recurrence: { isNot: null },
                startAt: { lte: new Date(timeMax) },
              },
            ]
          : []),
      ],
    };
  }

  const blocks = await prisma.plannerBlock.findMany({
    where,
    include: { recurrence: true, exceptions: true },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json(blocks);
}
