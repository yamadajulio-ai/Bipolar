"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { FormField } from "@/components/FormField";

interface Settings {
  wakeReminder: string | null;
  sleepReminder: string | null;
  diaryReminder: string | null;
  breathingReminder: string | null;
  enabled: boolean;
}

const reminderFields = [
  { name: "wakeReminder", label: "Lembrete de despertar" },
  { name: "sleepReminder", label: "Lembrete de hora de dormir" },
  { name: "diaryReminder", label: "Lembrete de registrar diário" },
  { name: "breathingReminder", label: "Lembrete de exercício de respiração" },
] as const;

export default function LembretesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/lembretes");
        if (res.ok) {
          setSettings(await res.json());
        }
      } catch {
        setError("Erro ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string | boolean | null> = {
      enabled: formData.get("enabled") === "on",
    };

    for (const field of reminderFields) {
      const val = formData.get(field.name) as string;
      data[field.name] = val || null;
    }

    try {
      const res = await fetch("/api/lembretes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSettings(await res.json());
        setMessage("Configurações salvas com sucesso.");
      } else {
        setError("Erro ao salvar configurações.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="py-12 text-center text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Lembretes</h1>

      <Alert variant="info" className="mb-4">
        Configure lembretes para receber notificacoes no navegador.
        No plano atual, os lembretes sao enviados uma vez por dia pela manha (entre 6h e 7h, sem horario exato).
        Para receber notificacoes, o app precisa estar instalado na Tela Inicial do iPhone (Compartilhar → Adicionar a Tela Inicial).
      </Alert>

      {message && (
        <Alert variant="success" className="mb-4">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings?.enabled ?? true}
                className="h-4 w-4 rounded border-border"
              />
              Lembretes ativados
            </label>
          </div>

          {reminderFields.map((field) => (
            <FormField
              key={field.name}
              label={field.label}
              name={field.name}
              type="time"
              value={settings?.[field.name as keyof Settings] as string || ""}
            />
          ))}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar configuracoes"}
          </button>
        </form>
      </Card>
    </div>
  );
}
