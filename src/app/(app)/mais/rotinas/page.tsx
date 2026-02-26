import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RoutinesManager } from "@/components/planner/RoutinesManager";

export default async function RotinasPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  const routines = await prisma.plannerBlock.findMany({
    where: { userId: session.userId, isRoutine: true },
    include: { recurrence: true },
    orderBy: { startAt: "asc" },
  });

  const serialized = routines.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    kind: r.kind,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    energyCost: r.energyCost,
    recurrence: r.recurrence
      ? {
          freq: r.recurrence.freq,
          weekDays: r.recurrence.weekDays,
          until: r.recurrence.until?.toISOString() || null,
        }
      : null,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Rotinas</h1>
      <RoutinesManager routines={serialized} />
    </div>
  );
}
