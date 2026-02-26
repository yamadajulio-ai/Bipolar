"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrisisPlanForm } from "@/components/CrisisPlanForm";

interface CrisisPlanData {
  trustedContacts: string | null;
  professionalName: string | null;
  professionalPhone: string | null;
  medications: string | null;
  preferredHospital: string | null;
  copingStrategies: string | null;
}

export default function EditarPlanoPage() {
  const [plan, setPlan] = useState<CrisisPlanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/plano-de-crise");
        if (res.ok) {
          const data = await res.json();
          setPlan(data);
        }
      } catch {
        // fail silently, form will start empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="py-12 text-center text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {plan ? "Editar meu plano de crise" : "Criar meu plano de crise"}
        </h1>
        <Link
          href="/plano-de-crise"
          className="text-sm text-primary hover:underline"
        >
          Voltar
        </Link>
      </div>

      <CrisisPlanForm initialData={plan} />
    </div>
  );
}
