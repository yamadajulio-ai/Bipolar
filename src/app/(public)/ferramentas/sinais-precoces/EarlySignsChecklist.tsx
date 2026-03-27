"use client";

import { useState } from "react";

interface Sign {
  key: string;
  label: string;
}

const MANIA_SIGNS: Sign[] = [
  { key: "m1", label: "Dormindo menos do que o habitual sem sentir cansaço" },
  { key: "m2", label: "Falando mais rápido ou mais do que o normal" },
  { key: "m3", label: "Ideias aceleradas ou dificuldade em manter o foco" },
  { key: "m4", label: "Sentindo-se invencível, grandioso ou com poderes especiais" },
  { key: "m5", label: "Gastando mais dinheiro do que o habitual" },
  { key: "m6", label: "Irritabilidade desproporcional a situações pequenas" },
  { key: "m7", label: "Assumindo muitos projetos ao mesmo tempo" },
  { key: "m8", label: "Comportamento impulsivo (dirigir rápido, decisões precipitadas)" },
  { key: "m9", label: "Aumento de energia ou agitação sem motivo claro" },
  { key: "m10", label: "Diminuição da necessidade de descanso entre atividades" },
];

const DEPRESSION_SIGNS: Sign[] = [
  { key: "d1", label: "Dormindo muito mais do que o habitual" },
  { key: "d2", label: "Dificuldade em sair da cama ou iniciar atividades" },
  { key: "d3", label: "Perda de interesse em coisas que normalmente gosta" },
  { key: "d4", label: "Sentindo-se sem esperança ou pessimista sobre o futuro" },
  { key: "d5", label: "Isolamento social — evitando pessoas e compromissos" },
  { key: "d6", label: "Dificuldade de concentração ou esquecimentos" },
  { key: "d7", label: "Mudanças no apetite (comer muito mais ou muito menos)" },
  { key: "d8", label: "Fadiga constante mesmo após dormir" },
  { key: "d9", label: "Choro frequente ou vontade de chorar" },
  { key: "d10", label: "Pensamentos negativos recorrentes sobre si mesmo" },
];

const MIXED_SIGNS: Sign[] = [
  { key: "x1", label: "Agitação intensa junto com tristeza ou desespero" },
  { key: "x2", label: "Energia alta mas humor muito baixo" },
  { key: "x3", label: "Insônia com pensamentos depressivos acelerados" },
  { key: "x4", label: "Irritabilidade extrema com choro" },
];

export function EarlySignsChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const maniaCount = MANIA_SIGNS.filter((s) => checked.has(s.key)).length;
  const depressionCount = DEPRESSION_SIGNS.filter((s) => checked.has(s.key)).length;
  const mixedCount = MIXED_SIGNS.filter((s) => checked.has(s.key)).length;
  const totalChecked = checked.size;

  function renderCategory(title: string, signs: Sign[], count: number, color: string) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {count > 0 && (
            <span className={`text-xs font-medium ${color}`}>
              {count} de {signs.length}
            </span>
          )}
        </div>
        <div className="space-y-1">
          {signs.map((s) => (
            <label
              key={s.key}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                checked.has(s.key)
                  ? "border-primary bg-primary/5"
                  : "border-border/50 bg-surface hover:border-primary/30"
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(s.key)}
                onChange={() => toggle(s.key)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground/80">{s.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {renderCategory("Sinais de mania/hipomania", MANIA_SIGNS, maniaCount, "text-amber-600")}
      {renderCategory("Sinais de depressão", DEPRESSION_SIGNS, depressionCount, "text-blue-600")}
      {renderCategory("Sinais de episódio misto", MIXED_SIGNS, mixedCount, "text-purple-600")}

      {totalChecked > 0 && (
        <div className={`rounded-lg border p-4 ${
          totalChecked >= 5 ? "border-red-200 bg-red-50" :
          totalChecked >= 3 ? "border-amber-200 bg-amber-50" :
          "border-blue-200 bg-blue-50"
        }`}>
          <p className="text-sm font-semibold text-foreground mb-1">
            {totalChecked} sinal(is) marcado(s)
          </p>
          <p className="text-xs text-muted">
            {totalChecked >= 5
              ? "Vários sinais identificados. Considere conversar com seu profissional de saúde."
              : totalChecked >= 3
              ? "Alguns sinais presentes. Continue observando e registre no app."
              : "Poucos sinais — continue monitorando regularmente."}
          </p>
          {maniaCount >= 3 && depressionCount >= 2 && (
            <p className="text-xs text-purple-700 mt-2 font-medium">
              Sinais de mania e depressão simultâneos podem indicar um episódio misto. Procure orientação profissional.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => window.print()}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-alt"
        >
          Imprimir
        </button>
        <button
          onClick={() => setChecked(new Set())}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-alt"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
