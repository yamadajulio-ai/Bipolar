import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLessonContent } from "@/lib/courses";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const curso = searchParams.get("curso");
  const aula = searchParams.get("aula");

  if (!curso || !aula) {
    return NextResponse.json({ error: "Parâmetros curso e aula são obrigatórios" }, { status: 400 });
  }

  const lesson = await getLessonContent(curso, aula);
  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  }

  return NextResponse.json(lesson);
}
