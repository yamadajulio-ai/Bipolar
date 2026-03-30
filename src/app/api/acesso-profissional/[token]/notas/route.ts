import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import * as Sentry from "@sentry/nextjs";

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private, max-age=0",
  "Pragma": "no-cache",
};

function privateJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...(init?.headers ?? {}) },
  });
}

// GET: List notes for this professional access
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) {
    return privateJson({ error: "Sessão expirada" }, { status: 401 });
  }

  try {
    const notes = await prisma.professionalNote.findMany({
      where: { accessId: session.accessId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return privateJson(notes);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "professional_notes_get" } });
    return privateJson({ error: "Erro interno" }, { status: 500 });
  }
}

// POST: Create a new note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) {
    return privateJson({ error: "Sessão expirada" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const content = String(body.content || "").trim();

    if (!content || content.length > 5000) {
      return privateJson(
        { error: content ? "Nota muito longa (máx 5000 caracteres)" : "Conteúdo vazio" },
        { status: 400 },
      );
    }

    const note = await prisma.professionalNote.create({
      data: {
        accessId: session.accessId,
        content,
      },
    });

    return privateJson(note, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "professional_notes_post" } });
    return privateJson({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE: Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) {
    return privateJson({ error: "Sessão expirada" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("id");

    if (!noteId) {
      return privateJson({ error: "ID da nota não fornecido" }, { status: 400 });
    }

    // Verify note belongs to this access
    const note = await prisma.professionalNote.findFirst({
      where: { id: noteId, accessId: session.accessId },
    });

    if (!note) {
      return privateJson({ error: "Nota não encontrada" }, { status: 404 });
    }

    await prisma.professionalNote.delete({ where: { id: noteId } });

    return privateJson({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "professional_notes_delete" } });
    return privateJson({ error: "Erro interno" }, { status: 500 });
  }
}
