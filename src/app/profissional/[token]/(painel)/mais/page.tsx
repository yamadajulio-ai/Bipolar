"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/Card";

interface ModuleItem {
  href: string;
  label: string;
  description: string;
}

function CollapsibleSection({
  title,
  items,
  defaultOpen,
}: {
  title: string;
  items: ModuleItem[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2"
        aria-expanded={open}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </h2>
        <span
          className={`text-muted text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          &#x25BE;
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mt-1">
          {items.map((mod) => (
            <Link key={mod.href} href={mod.href} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <p className="font-medium text-foreground">{mod.label}</p>
                <p className="text-sm text-muted mt-1">{mod.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ViewerMaisPage() {
  const params = useParams();
  const token = params.token as string;
  const base = `/profissional/${token}`;

  const quickAccess: ModuleItem[] = [
    { href: `${base}/notas`, label: "Observações", description: "Suas anotações clínicas" },
    { href: `${base}/insights`, label: "Insights", description: "Padrões e tendências" },
    { href: `${base}/avaliacoes`, label: "Avaliações", description: "ASRM, PHQ-9, FAST" },
    { href: `${base}/medicamentos`, label: "Medicamentos", description: "Medicamentos do paciente" },
  ];

  const sections: { title: string; items: ModuleItem[]; defaultOpen: boolean }[] = [
    {
      title: "Registros",
      defaultOpen: true,
      items: [
        { href: `${base}/meu-diario`, label: "Diário", description: "Pensamentos e sentimentos do paciente" },
        { href: `${base}/diario`, label: "Histórico de Humor", description: "Histórico completo de check-ins" },
        { href: `${base}/sono`, label: "Histórico de Sono", description: "Registro detalhado de sono" },
        { href: `${base}/life-chart`, label: "Life Chart", description: "Eventos significativos" },
      ],
    },
    {
      title: "Avaliações",
      defaultOpen: true,
      items: [
        { href: `${base}/avaliacoes`, label: "Avaliação Semanal", description: "Mania, depressão e funcionamento" },
        { href: `${base}/medicamentos`, label: "Medicamentos", description: "Lista de medicamentos ativos" },
      ],
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Menu</h1>

      {/* Quick access */}
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Mais usados
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {quickAccess.map((item) => (
            <Link key={item.href} href={item.href} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted mt-1">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.title}
            title={section.title}
            items={section.items}
            defaultOpen={section.defaultOpen}
          />
        ))}
      </div>
    </div>
  );
}
