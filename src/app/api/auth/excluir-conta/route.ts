import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * LGPD Art. 18, VI — Eliminação de dados pessoais.
 * Deletes the user and ALL associated data (Prisma cascade).
 */
export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userId = session.userId;

  await prisma.user.delete({ where: { id: userId } });

  session.destroy();

  // Redirect to landing page after deletion
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"), 303);
}
