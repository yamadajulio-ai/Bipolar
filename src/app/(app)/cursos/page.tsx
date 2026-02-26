import Link from "next/link";
import { getAllCourses } from "@/lib/courses";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

export default async function CursosPage() {
  const session = await getSession();
  const courses = getAllCourses();

  const progress = await prisma.courseProgress.findMany({
    where: { userId: session.userId },
  });

  const progressByCourse: Record<string, number> = {};
  progress.forEach((p) => {
    progressByCourse[p.courseSlug] = (progressByCourse[p.courseSlug] || 0) + 1;
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Cursos</h1>
      <p className="text-sm text-muted">
        Cursos estruturados com aulas sequenciais para aprofundar seu conhecimento.
      </p>

      <Alert variant="info">
        Conteúdo educacional. Não substitui orientação de profissionais de saúde.
      </Alert>

      {courses.length === 0 ? (
        <Card>
          <p className="text-center text-muted">Nenhum curso disponível ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const completed = progressByCourse[course.slug] || 0;
            return (
              <Link key={course.slug} href={`/cursos/${course.slug}`} className="no-underline block">
                <Card className="transition-shadow hover:shadow-md">
                  <h2 className="font-semibold text-foreground">{course.title}</h2>
                  <p className="text-sm text-muted mt-1">{course.description}</p>
                  <p className="text-xs text-muted mt-2">
                    {completed} de {course.totalLessons} aulas concluídas
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
