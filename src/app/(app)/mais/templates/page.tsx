import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TemplatesManager } from "@/components/planner/TemplatesManager";

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  const templates = await prisma.plannerTemplate.findMany({
    where: { userId: session.userId },
    include: { blocks: true },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    blocksCount: t.blocks.length,
    updatedAt: t.updatedAt.toISOString(),
    blocks: t.blocks.map((b) => ({
      title: b.title,
      category: b.category,
      kind: b.kind,
      weekDay: b.weekDay,
      startTimeMin: b.startTimeMin,
      durationMin: b.durationMin,
    })),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Templates de Semana</h1>
      <TemplatesManager templates={serialized} />
    </div>
  );
}
