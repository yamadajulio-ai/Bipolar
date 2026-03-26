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
            const pct = course.totalLessons > 0 ? Math.round((completed / course.totalLessons) * 100) : 0;
            const isComplete = completed >= course.totalLessons;
            return (
              <Link key={course.slug} href={`/cursos/${course.slug}`} className="no-underline block">
                <Card className={`transition-shadow hover:shadow-[var(--shadow-raised)] ${isComplete ? "border-l-4 border-l-green-500" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h2 className="font-semibold text-foreground">{course.title}</h2>
                      <p className="text-sm text-muted mt-1">{course.description}</p>
                    </div>
                    {isComplete && (
                      <span className="flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                        Completo
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted">
                        {completed} de {course.totalLessons} aulas
                      </span>
                      <span className="text-[11px] font-medium text-muted">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/10">
                      <div
                        className={`h-2 rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${completed} de ${course.totalLessons} aulas concluídas`}
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
