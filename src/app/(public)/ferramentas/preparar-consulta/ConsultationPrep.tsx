"use client";

import { useState } from "react";

interface FormData {
  period: string;
  moodSummary: string;
  sleepSummary: string;
  medications: string;
  sideEffects: string;
  adherence: string;
  significantEvents: string;
  questions: string;
  otherNotes: string;
}

const INITIAL: FormData = {
  period: "",
  moodSummary: "",
  sleepSummary: "",
  medications: "",
  sideEffects: "",
  adherence: "",
  significantEvents: "",
  questions: "",
  otherNotes: "",
};

const FIELDS: { key: keyof FormData; label: string; placeholder: string; rows: number }[] = [
  {
    key: "period",
    label: "Período desde a última consulta",
    placeholder: "Ex: Últimas 4 semanas (20/02 a 20/03)",
    rows: 1,
  },
  {
    key: "moodSummary",
    label: "Como esteve seu humor?",
    placeholder: "Ex: Nas primeiras 2 semanas estava bem, estável. Na terceira semana comecei a sentir mais irritabilidade e dificuldade de concentração.",
    rows: 3,
  },
  {
    key: "sleepSummary",
    label: "Como esteve seu sono?",
    placeholder: "Ex: Dormindo em média 7h, mas na última semana reduziu para 5h. Dificuldade para pegar no sono. Acordando antes do despertador.",
    rows: 3,
  },
  {
    key: "medications",
    label: "Medicamentos atuais",
    placeholder: "Ex: Lítio 900mg (manhã e noite), Quetiapina 100mg (noite), Lamotrigina 200mg (manhã)",
    rows: 2,
  },
  {
    key: "adherence",
    label: "Adesão à medicação",
    placeholder: "Ex: Tomei regularmente, exceto 3 dias que esqueci o lítio da manhã. Não parei nenhum por conta própria.",
    rows: 2,
  },
  {
    key: "sideEffects",
    label: "Efeitos colaterais",
    placeholder: "Ex: Tremor nas mãos (leve, começou há 2 semanas). Ganho de peso (3kg no último mês). Sede excessiva.",
    rows: 3,
  },
  {
    key: "significantEvents",
    label: "Eventos significativos",
    placeholder: "Ex: Mudança de emprego, conflito familiar, viagem com troca de fuso, parei de fazer exercício...",
    rows: 3,
  },
  {
    key: "questions",
    label: "Perguntas para o profissional",
    placeholder: "Ex: Posso reduzir a quetiapina? O tremor é esperado? Devo fazer exame de litemia? Posso dirigir com essa medicação?",
    rows: 3,
  },
  {
    key: "otherNotes",
    label: "Outras observações",
    placeholder: "Qualquer outra informação que queira compartilhar...",
    rows: 2,
  },
];

export function ConsultationPrep() {
  const [form, setForm] = useState<FormData>(INITIAL);

  function update(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filledCount = Object.values(form).filter((v) => v.trim().length > 0).length;

  return (
    <div className="space-y-4">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key} className="block text-sm font-medium text-foreground mb-1">
            {f.label}
          </label>
          {f.rows === 1 ? (
            <input
              id={f.key}
              type="text"
              value={form[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/50"
            />
          ) : (
            <textarea
              id={f.key}
              value={form[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.rows}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/50 resize-y"
            />
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted">
          {filledCount} de {FIELDS.length} campos preenchidos
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setForm(INITIAL)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-alt"
          >
            Limpar
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Imprimir
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted italic">
        Nenhum dado é salvo — tudo fica apenas no seu navegador. Para salvar dados permanentemente,
        crie uma conta no Suporte Bipolar.
      </p>
    </div>
  );
}
