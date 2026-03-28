"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

interface Schedule {
  id: string;
  timeLocal: string;
}

interface Medication {
  id: string;
  name: string;
  dosageText: string | null;
  instructions: string | null;
  isActive: boolean;
  isAsNeeded: boolean;
  schedules: Schedule[];
}

export default function MedicamentosPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [dosageText, setDosageText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isAsNeeded, setIsAsNeeded] = useState(false);
  const [schedules, setSchedules] = useState<string[]>(["08:00"]);

  const fetchMedications = useCallback(async () => {
    try {
      const res = await fetch("/api/medicamentos");
      if (res.ok) {
        const data = await res.json();
        setMedications(data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMedications(); }, [fetchMedications]);

  function resetForm() {
    setName("");
    setDosageText("");
    setInstructions("");
    setIsAsNeeded(false);
    setSchedules(["08:00"]);
    setShowForm(false);
    setError("");
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Informe o nome do medicamento.");
      return;
    }
    if (!isAsNeeded && schedules.length === 0) {
      setError("Adicione pelo menos um horário.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/medicamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          dosageText: dosageText.trim() || undefined,
          instructions: instructions.trim() || undefined,
          isAsNeeded,
          schedules: isAsNeeded ? [{ timeLocal: "00:00" }] : schedules.map((t) => ({ timeLocal: t })),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Erro ao salvar.");
        return;
      }

      setSuccess("Medicamento adicionado!");
      setTimeout(() => setSuccess(""), 3000);
      resetForm();
      fetchMedications();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      const res = await fetch(`/api/medicamentos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Medicamento desativado.");
        setTimeout(() => setSuccess(""), 3000);
        fetchMedications();
      }
    } catch { /* silent */ }
  }

  async function handleReactivate(id: string) {
    try {
      const res = await fetch(`/api/medicamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        setSuccess("Medicamento reativado.");
        setTimeout(() => setSuccess(""), 3000);
        fetchMedications();
      }
    } catch { /* silent */ }
  }

  function addSchedule() {
    setSchedules([...schedules, "12:00"]);
  }

  function removeSchedule(index: number) {
    setSchedules(schedules.filter((_, i) => i !== index));
  }

  function updateSchedule(index: number, value: string) {
    const updated = [...schedules];
    updated[index] = value;
    setSchedules(updated);
  }

  const activeMeds = medications.filter((m) => m.isActive);
  const inactiveMeds = medications.filter((m) => !m.isActive);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-2xl font-bold">Meus Medicamentos</h1>
        <p className="text-sm text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold">Meus Medicamentos</h1>
      <p className="text-sm text-muted">
        Cadastre seus medicamentos e horários para acompanhar a adesão por dose no check-in.
      </p>
      <p className="mb-6 text-xs text-muted italic">Este recurso não substitui orientação médica.</p>

      {success && <Alert variant="success" className="mb-4">{success}</Alert>}
      {error && !showForm && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Active medications */}
      {activeMeds.length > 0 ? (
        <div className="space-y-3 mb-6">
          {activeMeds.map((med) => (
            <Card key={med.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {med.name}
                    {med.dosageText && <span className="text-muted ml-1">({med.dosageText})</span>}
                  </p>
                  {med.isAsNeeded ? (
                    <p className="text-xs text-warning-fg mt-1">Uso sob demanda (SOS)</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {med.schedules.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {s.timeLocal}
                        </span>
                      ))}
                    </div>
                  )}
                  {med.instructions && (
                    <p className="text-xs text-muted mt-1">{med.instructions}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeactivate(med.id)}
                  className="text-xs text-muted hover:text-danger-fg transition-colors shrink-0 ml-2"
                >
                  Desativar
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : !showForm ? (
        <Card className="mb-6 text-center py-8">
          <p className="text-muted mb-2">Cadastre seus medicamentos para facilitar o acompanhamento.</p>
          <p className="text-xs text-muted">
            Acompanhar a adesão por dose ajuda a manter a estabilidade do tratamento.
          </p>
        </Card>
      ) : null}

      {/* Add medication form */}
      {showForm ? (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Novo Medicamento</h2>

          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

          <div className="space-y-4">
            <div>
              <label htmlFor="med-name" className="block text-sm font-medium text-foreground mb-1">
                Nome do medicamento
              </label>
              <input
                id="med-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Rivotril, Depakote, Latuda"
                className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus"
              />
            </div>

            <div>
              <label htmlFor="med-dosage" className="block text-sm font-medium text-foreground mb-1">
                Dosagem <span className="text-muted font-normal">(opcional)</span>
              </label>
              <input
                id="med-dosage"
                type="text"
                value={dosageText}
                onChange={(e) => setDosageText(e.target.value)}
                placeholder="Ex: 2mg, 500mg"
                className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus"
              />
            </div>

            <div>
              <label htmlFor="med-instructions" className="block text-sm font-medium text-foreground mb-1">
                Observações <span className="text-muted font-normal">(opcional)</span>
              </label>
              <input
                id="med-instructions"
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: Tomar com alimento"
                className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus"
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isAsNeeded}
                onChange={(e) => setIsAsNeeded(e.target.checked)}
                className="rounded border-control-border"
              />
              <span className="text-foreground">Uso sob demanda (SOS/se necessário)</span>
            </label>

            {!isAsNeeded && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Horários
                </label>
                <div className="space-y-2">
                  {schedules.map((time, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => updateSchedule(i, e.target.value)}
                        className="flex-1 rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus"
                      />
                      {schedules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSchedule(i)}
                          className="text-xs text-muted hover:text-danger-fg min-h-[44px]"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSchedule}
                  className="mt-2 text-xs text-primary hover:underline min-h-[44px]"
                >
                  + Adicionar horário
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-dark mb-6"
        >
          + Adicionar medicamento
        </button>
      )}

      {/* Inactive medications */}
      {inactiveMeds.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Desativados
          </h2>
          <div className="space-y-2">
            {inactiveMeds.map((med) => (
              <Card key={med.id} className="opacity-60">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">
                    {med.name}
                    {med.dosageText && ` (${med.dosageText})`}
                  </p>
                  <button
                    onClick={() => handleReactivate(med.id)}
                    className="text-xs text-primary hover:underline min-h-[44px]"
                  >
                    Reativar
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-muted">
        Seus medicamentos são dados sensíveis protegidos pela LGPD (art. 11).
        Eles são usados apenas para acompanhamento pessoal de adesão.
      </p>
    </div>
  );
}
