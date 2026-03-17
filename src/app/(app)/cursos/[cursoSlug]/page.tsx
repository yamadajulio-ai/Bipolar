import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllCourses, getCourseLessons } from "@/lib/courses";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

export function generateStaticParams() {
  const courses = getAllCourses();
  return courses.map((c) => ({ cursoSlug: c.slug }));
}

export default async function CursoPage({
  params,
}: {
  params: Promise<{ cursoSlug: string }>;
}) {
  const { cursoSlug } = await params;
  const courses = getAllCourses();
  const course = courses.find((c) => c.slug === cursoSlug);
  if (!course) notFound();

  const lessons = getCourseLessons(cursoSlug);
  const session = await getSession();

  const progress = await prisma.courseProgress.findMany({
    where: { userId: session.userId, courseSlug: cursoSlug },
  });
  const completedSlugs = new Set(progress.map((p) => p.lessonSlug));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/cursos" className="text-sm text-primary hover:underline">
        &larr; Voltar para cursos
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="text-sm text-muted mt-1">{course.description}</p>
        {/* Visual progress */}
        {(() => {
          const pct = lessons.length > 0 ? Math.round((completedSlugs.size / lessons.length) * 100) : 0;
          const isComplete = completedSlugs.size >= lessons.length;
          return (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted">
                  {completedSlugs.size} de {lessons.length} aulas concluídas
                </span>
                <span className={`text-xs font-bold ${isComplete ? "text-green-600" : "text-muted"}`}>
                  {isComplete ? "Completo!" : `${pct}%`}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-black/10">
                <div
                  className={`h-2.5 rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${completedSlugs.size} de ${lessons.length} aulas concluídas`}
                />
              </div>
            </div>
          );
        })()}
      </div>

      <Alert variant="info">
        Conteúdo educacional. Não substitui orientação de profissionais de saúde.
      </Alert>

      <div className="space-y-2">
        {lessons.map((lesson) => {
          const done = completedSlugs.has(lesson.slug);
          return (
            <Link
              key={lesson.slug}
              href={`/cursos/${cursoSlug}/${lesson.slug}`}
              className="no-underline block"
            >
              <Card className={`transition-shadow hover:shadow-md ${done ? "border-l-4 border-l-success" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-green-100 text-green-700"
                      : "bg-surface-alt text-muted"
                  }`}>
                    {done ? "✓" : lesson.lessonNumber}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">
                      {lesson.title}
                      {lesson.videoUrl && (
                        <span className="ml-1.5 inline-block rounded bg-red-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-red-700">
                          Video
                        </span>
                      )}
                    </h3>
                    {lesson.description && (
                      <p className="text-xs text-muted">{lesson.description}</p>
                    )}
                  </div>
                  {done && <span className="ml-auto text-success text-sm">Concluída</span>}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
