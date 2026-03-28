"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { FormField } from "@/components/FormField";

interface Contact {
  name: string;
  phone: string;
}

interface CrisisPlanData {
  trustedContacts: string | null;
  professionalName: string | null;
  professionalPhone: string | null;
  medications: string | null;
  preferredHospital: string | null;
  copingStrategies: string | null;
}

interface CrisisPlanFormProps {
  initialData?: CrisisPlanData | null;
}

export function CrisisPlanForm({ initialData }: CrisisPlanFormProps) {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [justGranted, setJustGranted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  // Check consent on mount
  useEffect(() => {
    fetch("/api/consentimentos")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { setHasConsent(false); return; }
        const granted = data.consents?.some(
          (c: { scope: string }) => c.scope === "crisis_plan" || c.scope === "health_data",
        );
        setHasConsent(!!granted);
      })
      .catch(() => setHasConsent(false));
  }, []);

  async function grantConsent() {
    setConsentLoading(true);
    try {
      const res = await fetch("/api/consentimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "crisis_plan", action: "grant" }),
      });
      if (res.ok) {
        setHasConsent(true);
        setJustGranted(true);
      }
    } catch { /* ignore */ }
    finally { setConsentLoading(false); }
  }
  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (initialData?.trustedContacts) {
      try {
        return JSON.parse(initialData.trustedContacts);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [medications, setMedications] = useState<string[]>(() => {
    if (initialData?.medications) {
      try {
        return JSON.parse(initialData.medications);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [strategies, setStrategies] = useState<string[]>(() => {
    if (initialData?.copingStrategies) {
      try {
        return JSON.parse(initialData.copingStrategies);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [professionalName, setProfessionalName] = useState(
    initialData?.professionalName || "",
  );
  const [professionalPhone, setProfessionalPhone] = useState(
    initialData?.professionalPhone || "",
  );
  const [preferredHospital, setPreferredHospital] = useState(
    initialData?.preferredHospital || "",
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Contact handlers
  function addContact() {
    setContacts([...contacts, { name: "", phone: "" }]);
  }

  function removeContact(index: number) {
    setContacts(contacts.filter((_, i) => i !== index));
  }

  function updateContact(index: number, field: "name" | "phone", value: string) {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  }

  // Medication handlers
  function addMedication() {
    setMedications([...medications, ""]);
  }

  function removeMedication(index: number) {
    setMedications(medications.filter((_, i) => i !== index));
  }

  function updateMedication(index: number, value: string) {
    const updated = [...medications];
    updated[index] = value;
    setMedications(updated);
  }

  // Strategy handlers
  function addStrategy() {
    setStrategies([...strategies, ""]);
  }

  function removeStrategy(index: number) {
    setStrategies(strategies.filter((_, i) => i !== index));
  }

  function updateStrategy(index: number, value: string) {
    const updated = [...strategies];
    updated[index] = value;
    setStrategies(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const filteredContacts = contacts.filter((c) => c.name || c.phone);
    const filteredMeds = medications.filter((m) => m.trim());
    const filteredStrategies = strategies.filter((s) => s.trim());

    const data = {
      trustedContacts: filteredContacts.length > 0 ? JSON.stringify(filteredContacts) : undefined,
      professionalName: professionalName || undefined,
      professionalPhone: professionalPhone || undefined,
      medications: filteredMeds.length > 0 ? JSON.stringify(filteredMeds) : undefined,
      preferredHospital: preferredHospital || undefined,
      copingStrategies: filteredStrategies.length > 0 ? JSON.stringify(filteredStrategies) : undefined,
    };

    try {
      const res = await fetch("/api/plano-de-crise", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setMessage("Plano de crise salvo com sucesso.");
      } else {
        const body = await res.json().catch(() => null);
        const apiError = body?.error || body?.errors?.geral?.[0];
        setError(apiError || "Erro ao salvar. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasConsent !== null && (
        <Card className={hasConsent
          ? "border-success-border bg-success-bg-subtle"
          : "border-warning-border bg-warning-bg-subtle"
        }>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="consent-crisis-plan"
              checked={hasConsent}
              onChange={hasConsent ? undefined : grantConsent}
              disabled={consentLoading || hasConsent}
              className="mt-1 h-4 w-4 rounded border-control-border text-primary focus-visible:ring-control-border-focus"
            />
            <label htmlFor="consent-crisis-plan" className="text-sm text-foreground">
              {hasConsent ? (
                <>
                  <strong className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-success-fg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {justGranted ? "Autorização concedida!" : "Armazenamento autorizado"}
                  </strong>
                  <span className="block mt-1 text-xs text-muted">
                    {justGranted
                      ? "Você autorizou o armazenamento do seu plano de crise. Agora pode preencher e salvar. Pode revogar a qualquer momento em Privacidade."
                      : "Seus dados estão protegidos. Você pode revogar em Privacidade."
                    }
                  </span>
                </>
              ) : (
                <>
                  <strong>Autorizo o armazenamento do meu plano de crise</strong>
                  <span className="block mt-1 text-xs text-muted">
                    Seus dados ficam protegidos e criptografados. Você pode revogar essa autorização a qualquer momento em Privacidade.
                  </span>
                </>
              )}
            </label>
          </div>
        </Card>
      )}
      {message && (
        <Alert variant="success">{message}</Alert>
      )}
      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      {/* Contatos de confiança */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Contatos de confiança</h2>
        <p className="mb-3 text-xs text-muted">
          Pessoas para quem você pode ligar em momentos difíceis.
        </p>
        {contacts.map((contact, i) => (
          <div key={i} className="mb-3 flex gap-2">
            <input
              type="text"
              value={contact.name}
              onChange={(e) => updateContact(i, "name", e.target.value)}
              placeholder="Nome"
              className="flex-1 rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-control-border-focus focus-visible:outline-none"
            />
            <input
              type="tel"
              value={contact.phone}
              onChange={(e) => updateContact(i, "phone", e.target.value)}
              placeholder="Telefone"
              className="flex-1 rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-control-border-focus focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => removeContact(i)}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-bg-subtle"
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addContact}
          className="text-sm text-primary hover:underline"
        >
          + Adicionar contato
        </button>
      </Card>

      {/* Profissional de saúde */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Profissional de saúde</h2>
        <FormField
          label="Nome do profissional"
          name="professionalName"
          value={professionalName}
          onChange={(e) => setProfessionalName(e.target.value)}
          placeholder="Ex: Dra. Maria Silva"
        />
        <FormField
          label="Telefone do profissional"
          name="professionalPhone"
          type="tel"
          value={professionalPhone}
          onChange={(e) => setProfessionalPhone(e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </Card>

      {/* Medicamentos atuais */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Medicamentos atuais</h2>
        <Alert variant="warning" className="mb-3">
          Liste apenas os nomes para referência em emergências. Não altere doses
          sem orientação médica.
        </Alert>
        {medications.map((med, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              type="text"
              value={med}
              onChange={(e) => updateMedication(i, e.target.value)}
              placeholder="Nome do medicamento"
              className="flex-1 rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-control-border-focus focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => removeMedication(i)}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-bg-subtle"
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addMedication}
          className="text-sm text-primary hover:underline"
        >
          + Adicionar medicamento
        </button>
      </Card>

      {/* Hospital de preferência */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Hospital de preferência</h2>
        <FormField
          label="Nome do hospital ou UPA"
          name="preferredHospital"
          value={preferredHospital}
          onChange={(e) => setPreferredHospital(e.target.value)}
          placeholder="Ex: Hospital das Clínicas"
        />
      </Card>

      {/* Estratégias de enfrentamento */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Estratégias de enfrentamento</h2>
        <p className="mb-3 text-xs text-muted">
          O que ajuda você a se acalmar? Adicione ações que funcionam para você.
        </p>
        {strategies.map((strategy, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              type="text"
              value={strategy}
              onChange={(e) => updateStrategy(i, e.target.value)}
              placeholder='Ex: "Ligar para minha mãe", "Respiração 4-7-8"'
              className="flex-1 rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-control-border-focus focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => removeStrategy(i)}
              className="rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-bg-subtle"
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addStrategy}
          className="text-sm text-primary hover:underline"
        >
          + Adicionar estratégia
        </button>
      </Card>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar plano de crise"}
      </button>
    </form>
  );
}
