"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { CATEGORY_COLORS } from "@/lib/planner/categories";
import { localDateStr } from "@/lib/dateUtils";

interface TemplateBlock {
  title: string;
  category: string;
  kind: string;
  weekDay: number;
  startTimeMin: number;
  durationMin: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  blocksCount: number;
  updatedAt: string;
  blocks: TemplateBlock[];
}

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TemplatesManager({ templates: initial }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Remover este template?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleApplyToCurrentWeek(id: string) {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(monday.getDate() + diff);
    const weekStart = localDateStr(monday);

    const res = await fetch(`/api/templates/${id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, mode: "merge" }),
    });

    if (res.ok) {
      const data = await res.json();
      alert(`${data.created} blocos criados!`);
      router.push("/planejador");
    }
  }

  if (templates.length === 0) {
    return (
      <Card>
        <p className="text-center text-muted py-4">
          Nenhum template salvo. Use o botao &quot;Template&quot; no planejador para salvar sua semana atual.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <Card key={template.id}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-foreground">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-muted mt-1">{template.description}</p>
              )}
              <p className="text-xs text-muted mt-1">
                {template.blocksCount} blocos
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApplyToCurrentWeek(template.id)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
              >
                Aplicar
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                disabled={deleting === template.id}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>

          {/* Mini preview of template blocks by day */}
          <div className="mt-3 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, dayIdx) => {
              const dayBlocks = template.blocks
                .filter((b) => b.weekDay === dayIdx)
                .sort((a, b) => a.startTimeMin - b.startTimeMin);
              return (
                <div key={dayIdx} className="rounded border border-border p-1">
                  <p className="text-[10px] font-medium text-muted text-center mb-0.5">
                    {WEEKDAY_NAMES[dayIdx]}
                  </p>
                  {dayBlocks.length === 0 ? (
                    <p className="text-[9px] text-center text-muted/50">—</p>
                  ) : (
                    dayBlocks.map((b, j) => {
                      const colors = CATEGORY_COLORS[b.category] || CATEGORY_COLORS.outro;
                      return (
                        <div key={j} className={`rounded px-0.5 py-0.5 text-[9px] leading-tight mb-0.5 ${colors}`}>
                          {formatMin(b.startTimeMin)} {b.title.slice(0, 8)}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
