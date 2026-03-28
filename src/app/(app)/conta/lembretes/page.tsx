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
  privacyMode: boolean;
  whatsappEnabled: boolean;
  whatsappPhone: string;
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
      privacyMode: formData.get("privacyMode") === "on",
      whatsappEnabled: formData.get("whatsappEnabled") === "on",
      whatsappPhone: (formData.get("whatsappPhone") as string) || null,
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
        Configure lembretes para receber notificações no navegador.
        Você escolhe o horário exato de cada lembrete.
        Para receber notificações, o app precisa estar instalado na Tela Inicial do iPhone (Compartilhar → Adicionar à Tela de Início).
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
          <div className="mb-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings?.enabled ?? true}
                className="h-4 w-4 rounded border-border"
              />
              Lembretes ativados
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="privacyMode"
                defaultChecked={settings?.privacyMode ?? true}
                className="h-4 w-4 rounded border-border"
              />
              Modo privado
            </label>
            <p className="ml-6 text-xs text-muted">
              Exibe notificações genéricas sem mencionar saúde mental, para proteger sua privacidade na tela de bloqueio.
            </p>
          </div>

          {/* WhatsApp opt-in section — LGPD Art. 11: specific, highlighted consent */}
          <div className="mb-4 rounded-lg border border-border/50 bg-surface-alt p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="whatsappEnabled"
                defaultChecked={settings?.whatsappEnabled ?? false}
                className="h-4 w-4 rounded border-border"
              />
              Receber lembretes também por WhatsApp
            </label>
            <p className="ml-6 mt-1 text-xs text-muted">
              Mensagens genéricas enviadas via WhatsApp Business (Meta Platforms, Inc.).
              O conteúdo não menciona saúde mental — apenas &quot;Você tem um lembrete pendente&quot;.
            </p>
            <p className="ml-6 mt-1 text-[11px] text-muted/70">
              Ao ativar, você consente com a transferência do seu número de telefone para servidores
              da Meta nos EUA/EU (LGPD art. 33), com retenção de até 30 dias.
              Você pode revogar este consentimento a qualquer momento aqui ou em Privacidade → Consentimentos.
            </p>
            <div className="ml-6 mt-2">
              <label className="text-xs font-medium text-foreground" htmlFor="whatsappPhone">
                Número do WhatsApp (com DDD)
              </label>
              <input
                type="tel"
                id="whatsappPhone"
                name="whatsappPhone"
                placeholder="(11) 99999-9999"
                defaultValue={settings?.whatsappPhone ?? ""}
                className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                maxLength={20}
              />
            </div>
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
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>
      </Card>
    </div>
  );
}
