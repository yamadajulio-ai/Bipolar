"use client";

import { useState } from "react";

const layouts = [
  {
    id: "aurora",
    name: "1. Aurora",
    tag: "Moderno / Gradiente",
    description:
      "Gradientes vibrantes, glassmorphism e silhuetas abstratas. Visual premium e acolhedor.",
  },
  {
    id: "terra",
    name: "2. Terra",
    tag: "Orgânico / Quente",
    description:
      "Tons terrosos profundos, formas orgânicas suaves e textura de acolhimento. Chão firme.",
  },
  {
    id: "noite",
    name: "3. Noite Serena",
    tag: "Dark / Intimista",
    description:
      "Modo escuro elegante com acentos de luz. Calmo, seguro, sem estímulo excessivo.",
  },
  {
    id: "jardim",
    name: "4. Jardim",
    tag: "Fresco / Vivo",
    description:
      "Verde vibrante com toques de coral e dourado. Sensação de crescimento e cuidado.",
  },
  {
    id: "editorial",
    name: "5. Editorial",
    tag: "Minimalista / Sofisticado",
    description:
      "Tipografia marcante, muito espaço, acento em uma cor. Inspirado em revistas de bem-estar.",
  },
];

/* ===== 1. AURORA ===== */
function PreviewAurora() {
  return (
    <div className="overflow-hidden rounded-xl text-[11px]" style={{ background: "linear-gradient(160deg, #fdf2f8 0%, #ede9fe 35%, #dbeafe 70%, #f0fdf4 100%)" }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(12px)" }}>
        <span className="font-bold text-xs" style={{ background: "linear-gradient(135deg, #a855f7, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Empresa Bipolar</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-[#6b7280]">Entrar</span>
          <span className="rounded-full px-3 py-0.5 text-white font-medium" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>Criar conta</span>
        </div>
      </div>

      <div className="relative px-5 pt-8 pb-5 text-center">
        {/* Blobs decorativos */}
        <div className="absolute top-4 left-8 w-24 h-24 rounded-full opacity-25 blur-xl" style={{ background: "#c084fc" }} />
        <div className="absolute top-10 right-6 w-20 h-20 rounded-full opacity-20 blur-xl" style={{ background: "#60a5fa" }} />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full opacity-15 blur-xl" style={{ background: "#f472b6" }} />

        {/* Silhuetas abstratas — dois círculos juntos (cabeças) + forma de abraço */}
        <div className="relative mx-auto mb-5 w-24 h-20">
          <div className="absolute left-3 top-0 w-10 h-10 rounded-full" style={{ background: "linear-gradient(135deg, #c084fc, #818cf8)" }} />
          <div className="absolute right-3 top-1 w-9 h-9 rounded-full" style={{ background: "linear-gradient(135deg, #818cf8, #60a5fa)" }} />
          {/* Corpo/conexão — forma oval unindo */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-10 rounded-full opacity-40" style={{ background: "linear-gradient(90deg, #c084fc, #60a5fa)" }} />
        </div>

        <h2 className="relative font-bold text-[15px] mb-1.5 text-[#1e1b4b] leading-tight">
          Você não precisa passar<br/>por isso sozinho
        </h2>
        <p className="relative text-[10px] text-[#6b7280] mb-4 max-w-[220px] mx-auto leading-relaxed">
          Ferramentas de cuidado para quem convive com TAB tipo 1 e suas famílias
        </p>

        <div className="relative rounded-2xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.6)" }}>
          <p className="text-[9px] text-[#7c3aed] mb-2.5">Conteúdo educacional — não substitui seu profissional</p>
          <div className="flex justify-center gap-2">
            <span className="rounded-full px-5 py-1.5 text-[10px] font-medium text-white shadow-md" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>Criar conta gratuita</span>
            <span className="rounded-full px-5 py-1.5 text-[10px] text-[#6366f1] border border-[#c4b5fd]" style={{ background: "rgba(255,255,255,0.5)" }}>Entrar</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
        {[
          { icon: "📅", label: "Calendário" },
          { icon: "📊", label: "Insights" },
          { icon: "💛", label: "Apoio" },
        ].map((f) => (
          <div key={f.label} className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)" }}>
            <span className="text-sm">{f.icon}</span>
            <p className="text-[9px] font-medium text-[#4b5563] mt-0.5">{f.label}</p>
          </div>
        ))}
      </div>
      <div className="py-1.5 text-center text-[9px] text-[#a78bfa]" style={{ background: "rgba(255,255,255,0.4)" }}>CVV 188 · SAMU 192 · UPA 24h</div>
    </div>
  );
}

/* ===== 2. TERRA ===== */
function PreviewTerra() {
  return (
    <div className="overflow-hidden rounded-xl text-[11px]" style={{ background: "linear-gradient(180deg, #e8d5b8 0%, #f5ebe0 40%, #faf6f1 100%)" }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "rgba(93,64,55,0.08)" }}>
        <span className="font-bold text-xs text-[#5d4037]">Empresa Bipolar</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-[#8d6e63]">Entrar</span>
          <span className="bg-[#5d4037] text-white rounded-full px-3 py-0.5">Criar conta</span>
        </div>
      </div>

      <div className="relative px-5 pt-6 pb-5 text-center">
        {/* Formas orgânicas de fundo */}
        <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden">
          <div className="absolute -top-4 -left-6 w-28 h-28 rounded-full opacity-15" style={{ background: "#a1887f" }} />
          <div className="absolute top-8 -right-4 w-20 h-20 rounded-full opacity-10" style={{ background: "#8d6e63" }} />
        </div>

        {/* Silhuetas: duas formas humanas lado a lado, conectadas */}
        <div className="relative mx-auto mb-5 flex justify-center items-end gap-1">
          {/* Pessoa 1 */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-[#a1887f]" />
            <div className="w-6 h-12 rounded-full bg-[#a1887f] mt-1 opacity-80" />
          </div>
          {/* Braço/conexão */}
          <div className="w-3 h-6 rounded-full bg-[#bcaaa4] opacity-50 self-center -mx-1.5 mb-3" />
          {/* Pessoa 2 */}
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-[#8d6e63]" />
            <div className="w-5 h-11 rounded-full bg-[#8d6e63] mt-1 opacity-80" />
          </div>
        </div>

        <h2 className="relative font-bold text-[15px] mb-1.5 text-[#3e2723] leading-tight">
          Juntos, um passo de cada vez
        </h2>
        <p className="relative text-[10px] text-[#795548] mb-3 leading-relaxed">
          Educação e ferramentas para o dia a dia com TAB tipo 1. No seu ritmo.
        </p>

        <div className="relative inline-block rounded-full bg-[#efebe9] border border-[#d7ccc8] px-4 py-1.5 text-[10px] text-[#6d4c41] mb-3">
          Educacional · Consulte seu profissional
        </div>

        <div className="relative flex justify-center gap-2">
          <span className="bg-[#5d4037] text-white rounded-full px-6 py-2 text-[10px] font-medium shadow-sm">Criar conta gratuita</span>
          <span className="rounded-full px-5 py-2 text-[10px] text-[#5d4037] border border-[#bcaaa4]">Entrar</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 px-4 pb-3">
        {["Diário", "Biblioteca", "Exercícios", "Família"].map((f) => (
          <span key={f} className="rounded-full bg-white/80 border border-[#d7ccc8] px-3 py-1 text-[9px] font-medium text-[#5d4037]">{f}</span>
        ))}
      </div>
      <div className="py-1.5 text-center text-[9px] text-[#a1887f] bg-[#efebe9]">CVV 188 · SAMU 192 · UPA 24h</div>
    </div>
  );
}

/* ===== 3. NOITE SERENA ===== */
function PreviewNoite() {
  return (
    <div className="overflow-hidden rounded-xl text-[11px]" style={{ background: "linear-gradient(180deg, #0c1222 0%, #162036 60%, #1a2744 100%)" }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="font-bold text-xs text-[#93c5fd]">Empresa Bipolar</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-[#64748b]">Entrar</span>
          <span className="rounded-full px-3 py-0.5 text-white" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>Criar conta</span>
        </div>
      </div>

      <div className="relative px-5 pt-8 pb-5 text-center overflow-hidden">
        {/* Estrelas com CSS */}
        <div className="absolute inset-0">
          {[
            { t: 8, l: 12, s: 2, o: 0.5 }, { t: 15, l: 45, s: 1.5, o: 0.3 }, { t: 5, l: 75, s: 2, o: 0.4 },
            { t: 22, l: 30, s: 1, o: 0.25 }, { t: 10, l: 88, s: 1.5, o: 0.35 }, { t: 30, l: 60, s: 1, o: 0.2 },
            { t: 18, l: 8, s: 1.5, o: 0.3 }, { t: 35, l: 80, s: 2, o: 0.4 }, { t: 28, l: 50, s: 1, o: 0.15 },
          ].map((s, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{ top: `${s.t}%`, left: `${s.l}%`, width: s.s, height: s.s, opacity: s.o }} />
          ))}
        </div>

        {/* Lua */}
        <div className="absolute top-4 right-6 w-8 h-8 rounded-full" style={{ background: "radial-gradient(circle at 65% 40%, #e2e8f0 0%, #94a3b8 50%, transparent 70%)", opacity: 0.25 }} />

        {/* Silhuetas — duas pessoas sentadas juntas */}
        <div className="relative mx-auto mb-5 flex justify-center items-end">
          <div className="relative">
            {/* Brilho atrás */}
            <div className="absolute -inset-3 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #93c5fd, transparent)" }} />
            <div className="flex items-end gap-0.5">
              {/* Pessoa 1 sentada */}
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-[#93c5fd] opacity-60" />
                <div className="w-5 h-8 rounded-t-full bg-[#93c5fd] mt-0.5 opacity-40" />
                <div className="w-8 h-3 rounded-full bg-[#93c5fd] opacity-30 -mt-0.5" />
              </div>
              {/* Pessoa 2, encostada */}
              <div className="flex flex-col items-center -ml-1.5">
                <div className="w-6 h-6 rounded-full bg-[#a5b4fc] opacity-55" />
                <div className="w-4 h-7 rounded-t-full bg-[#a5b4fc] mt-0.5 opacity-35" />
                <div className="w-7 h-3 rounded-full bg-[#a5b4fc] opacity-25 -mt-0.5" />
              </div>
            </div>
          </div>
        </div>

        <h2 className="relative font-bold text-[15px] mb-1.5 text-white leading-tight">
          Calma. Você está seguro.
        </h2>
        <p className="relative text-[10px] text-[#94a3b8] mb-4 max-w-[220px] mx-auto leading-relaxed">
          Ferramentas gentis para o dia a dia com TAB tipo 1
        </p>

        <div className="relative inline-block rounded-xl px-3 py-1.5 text-[9px] text-[#93c5fd] mb-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
          Educacional · Consulte seu profissional
        </div>

        <div className="relative flex justify-center gap-2">
          <span className="rounded-xl px-5 py-1.5 text-[10px] font-medium text-white" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>Criar conta</span>
          <span className="rounded-xl px-5 py-1.5 text-[10px] text-[#93c5fd]" style={{ border: "1px solid rgba(59,130,246,0.25)" }}>Entrar</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
        {[
          { icon: "📝", label: "Check-in" },
          { icon: "📖", label: "Leituras" },
          { icon: "🫁", label: "Respirar" },
        ].map((f) => (
          <div key={f.label} className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-sm">{f.icon}</span>
            <p className="text-[9px] text-[#64748b] mt-0.5">{f.label}</p>
          </div>
        ))}
      </div>
      <div className="py-1.5 text-center text-[9px] text-[#334155]" style={{ background: "rgba(0,0,0,0.15)" }}>CVV 188 · SAMU 192 · UPA 24h</div>
    </div>
  );
}

/* ===== 4. JARDIM ===== */
function PreviewJardim() {
  return (
    <div className="overflow-hidden rounded-xl bg-white text-[#14532d] text-[11px]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#dcfce7]">
        <span className="font-bold text-xs text-[#15803d]">Empresa Bipolar</span>
        <div className="flex gap-2 text-[10px]">
          <span className="text-[#6b7280]">Entrar</span>
          <span className="bg-[#15803d] text-white rounded-xl px-3 py-0.5 font-medium">Criar conta</span>
        </div>
      </div>

      <div className="relative px-5 pt-6 pb-5 text-center" style={{ background: "linear-gradient(180deg, #f0fdf4 0%, white 100%)" }}>
        {/* Elementos decorativos */}
        <div className="absolute top-3 left-6 w-16 h-16 rounded-full opacity-30" style={{ background: "#86efac" }} />
        <div className="absolute top-8 right-4 w-12 h-12 rounded-full opacity-20" style={{ background: "#4ade80" }} />

        {/* Ícone: duas mãos segurando um broto */}
        <div className="relative mx-auto mb-5 w-20 h-16 flex items-center justify-center">
          {/* Mão esquerda — forma de concha */}
          <div className="absolute left-0 bottom-1 w-9 h-7 rounded-b-full rounded-tr-full bg-[#d4a574] opacity-60 rotate-[15deg]" />
          {/* Mão direita */}
          <div className="absolute right-0 bottom-1 w-9 h-7 rounded-b-full rounded-tl-full bg-[#a1887f] opacity-60 -rotate-[15deg]" />
          {/* Broto */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#4ade80]" />
            <div className="w-2 h-2 rounded-full bg-[#22c55e] -mt-0.5 ml-2 opacity-80" />
            <div className="w-2 h-2 rounded-full bg-[#22c55e] -mt-1 -ml-1.5 opacity-80" />
            <div className="w-0.5 h-4 bg-[#15803d] rounded-full" />
          </div>
        </div>

        <h2 className="relative font-bold text-[15px] mb-1.5 text-[#14532d] leading-tight">
          Cultive sua estabilidade
        </h2>
        <p className="relative text-[10px] text-[#6b7280] mb-3 max-w-[220px] mx-auto leading-relaxed">
          Cada dia é uma semente. Educação e ferramentas para o dia a dia com TAB tipo 1.
        </p>

        <div className="relative inline-block rounded-xl bg-[#fef3c7] border border-[#fde68a] px-3 py-1 text-[10px] text-[#92400e] mb-3">
          Educacional · Consulte seu profissional
        </div>

        <div className="relative flex justify-center gap-2">
          <span className="bg-[#15803d] text-white rounded-xl px-5 py-2 text-[10px] font-medium shadow-sm">Criar conta gratuita</span>
          <span className="rounded-xl px-5 py-2 text-[10px] text-[#15803d] border border-[#86efac]">Entrar</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
        {[
          { icon: "📅", label: "Calendário", color: "#dcfce7" },
          { icon: "📊", label: "Insights", color: "#fef3c7" },
          { icon: "🫁", label: "Respirar", color: "#dbeafe" },
        ].map((f) => (
          <div key={f.label} className="rounded-xl p-2 text-center border border-[#f0f0f0]">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg text-sm" style={{ background: f.color }}>{f.icon}</div>
            <p className="text-[9px] font-medium text-[#374151]">{f.label}</p>
          </div>
        ))}
      </div>
      <div className="py-1.5 text-center text-[9px] text-[#6b7280] bg-[#f9fafb] border-t border-[#f0f0f0]">CVV 188 · SAMU 192 · UPA 24h</div>
    </div>
  );
}

/* ===== 5. EDITORIAL ===== */
function PreviewEditorial() {
  return (
    <div className="overflow-hidden rounded-xl bg-[#fafaf9] text-[#111] text-[11px]">
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#e5e5e5]">
        <span className="font-black text-xs tracking-tight">EMPRESA BIPOLAR</span>
        <div className="flex gap-3 text-[10px]">
          <span className="text-[#a3a3a3] font-medium">Entrar</span>
          <span className="font-bold text-[#ea580c]">Criar conta</span>
        </div>
      </div>

      {/* Hero split */}
      <div className="flex">
        {/* Lado visual — bloco de cor com forma humana abstrata */}
        <div className="w-[38%] relative overflow-hidden" style={{ background: "linear-gradient(160deg, #fed7aa, #fdba74, #fb923c)" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Silhueta abstrata minimalista */}
            <div className="flex flex-col items-center opacity-30">
              <div className="w-10 h-10 rounded-full bg-white" />
              <div className="w-7 h-16 rounded-full bg-white mt-1" />
            </div>
          </div>
          {/* Frase lateral */}
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-[8px] text-white/70 font-medium leading-tight">
              cuidado ·<br/>educação ·<br/>acolhimento
            </p>
          </div>
        </div>

        {/* Lado texto */}
        <div className="w-[62%] px-4 py-5 bg-white flex flex-col justify-center">
          <div className="w-8 h-0.5 bg-[#ea580c] rounded-full mb-3" />
          <h2 className="font-black text-[14px] leading-[1.12] mb-2 tracking-tight">
            Você não<br/>precisa passar<br/>por isso sozinho.
          </h2>
          <p className="text-[9px] text-[#737373] mb-3 leading-relaxed">
            Ferramentas de cuidado para quem convive com TAB tipo 1.
          </p>
          <div className="border-l-2 border-[#ea580c] pl-2 mb-3">
            <p className="text-[8px] text-[#a3a3a3] italic">Educacional — não substitui profissional</p>
          </div>
          <span className="bg-[#111] text-white rounded-lg py-1.5 text-[9px] font-bold tracking-wide text-center">
            CRIAR CONTA GRATUITA
          </span>
        </div>
      </div>

      <div className="border-t border-[#f0f0f0]" />
      <div className="px-5 py-2.5 flex justify-between text-[9px]">
        {["Calendário", "Insights", "Apoio"].map((f) => (
          <span key={f} className="font-bold text-[#404040]">{f}</span>
        ))}
      </div>
      <div className="py-1.5 text-center text-[9px] text-[#d4d4d4] bg-white border-t border-[#f0f0f0]">CVV 188 · SAMU 192 · UPA 24h</div>
    </div>
  );
}

const previewComponents: Record<string, () => React.ReactNode> = {
  aurora: PreviewAurora,
  terra: PreviewTerra,
  noite: PreviewNoite,
  jardim: PreviewJardim,
  editorial: PreviewEditorial,
};

export default function EscolherVisualPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-4xl font-black tracking-tight">Escolha o Visual</h1>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            5 estilos visuais. Formas abstratas, cores e tipografia que transmitem acolhimento. Clique no favorito.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {layouts.map((layout) => {
            const PreviewComponent = previewComponents[layout.id];
            const isSelected = selected === layout.id;
            const isHovered = hovered === layout.id;
            return (
              <div
                key={layout.id}
                onClick={() => setSelected(layout.id)}
                onMouseEnter={() => setHovered(layout.id)}
                onMouseLeave={() => setHovered(null)}
                className={`cursor-pointer rounded-2xl transition-all duration-200 ${
                  isSelected
                    ? "ring-[3px] ring-amber-400 scale-[1.02]"
                    : isHovered
                      ? "ring-2 ring-neutral-500 scale-[1.01]"
                      : "ring-1 ring-neutral-800"
                }`}
              >
                <div className="rounded-2xl bg-neutral-900/80 p-4">
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-sm font-bold">{layout.name}</h2>
                      {isSelected && (
                        <span className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full">ESCOLHIDO</span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500 font-medium">{layout.tag}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">{layout.description}</p>
                  <div className="rounded-xl overflow-hidden shadow-2xl">
                    <PreviewComponent />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="sticky bottom-4 mt-10 mx-auto max-w-lg">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/90 backdrop-blur-xl p-4 text-center shadow-2xl">
              <p className="text-sm">
                Visual escolhido:{" "}
                <strong className="text-amber-400">{layouts.find((l) => l.id === selected)?.name}</strong>
              </p>
              <p className="text-xs text-amber-300/60 mt-1">Me diga o número ou nome e eu aplico em todo o projeto.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
