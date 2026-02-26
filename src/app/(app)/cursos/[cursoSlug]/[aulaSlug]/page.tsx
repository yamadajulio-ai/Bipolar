"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

interface LessonData {
  title: string;
  description: string;
  lessonNumber: number;
  contentHtml: string;
  courseSlug: string;
  slug: string;
}

export default function AulaPage() {
  const params = useParams();
  const cursoSlug = params.cursoSlug as string;
  const aulaSlug = params.aulaSlug as string;

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    fetch(`/api/cursos/aula?curso=${cursoSlug}&aula=${aulaSlug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Aula não encontrada");
        return res.json();
      })
      .then((data) => setLesson(data))
      .catch(() => setLesson(null))
      .finally(() => setLoading(false));
  }, [cursoSlug, aulaSlug]);

  async function markComplete() {
    await fetch("/api/cursos/progresso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: cursoSlug, lessonSlug: aulaSlug }),
    });
    setMarked(true);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-muted py-8">Carregando aula...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="danger">Aula não encontrada.</Alert>
        <Link href={`/cursos/${cursoSlug}`} className="text-sm text-primary hover:underline">
          Voltar ao curso
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/cursos/${cursoSlug}`} className="text-sm text-primary hover:underline">
        &larr; Voltar ao curso
      </Link>

      <div>
        <p className="text-xs text-muted">Aula {lesson.lessonNumber}</p>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
      </div>

      <Alert variant="info">
        Conteúdo educacional. Não substitui orientação de profissionais de saúde.
      </Alert>

      <Card>
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
        />
      </Card>

      <div className="text-center">
        {marked ? (
          <p className="text-success font-medium">Aula marcada como concluída!</p>
        ) : (
          <button
            onClick={markComplete}
            className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
          >
            Marcar como concluída
          </button>
        )}
      </div>
    </div>
  );
}
