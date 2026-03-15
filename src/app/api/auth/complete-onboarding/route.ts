import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { onboarded: true },
  });

  session.onboarded = true;
  await session.save();

  return NextResponse.json({ success: true });
}
