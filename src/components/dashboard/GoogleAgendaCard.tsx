"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";

interface Block {
  title: string;
  startAt: Date | string;
}

interface Props {
  todayBlocks: Block[];
  hasGoogleCal: boolean;
  googleNeedsReauth: boolean;
  /** ISO string — used to compare "isPast" client-side */
  nowIso: string;
}

type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "success"; pulled: number; todayEvents: number }
  | { kind: "empty-calendar" }
  | { kind: "reauth" }
  | { kind: "error"; message: string };

function formatBlockTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function GoogleAgendaCard({ todayBlocks, hasGoogleCal, googleNeedsReauth, nowIso }: Props) {
  const [state, setState] = useState<SyncState>(
    googleNeedsReauth ? { kind: "reauth" } : { kind: "idle" },
  );
  const router = useRouter();
  const now = new Date(nowIso);

  // Normalize block dates (they come as strings when serialized from Server Component)
  const blocks = todayBlocks.map((b) => ({
    title: b.title,
    startAt: b.startAt instanceof Date ? b.startAt : new Date(b.startAt),
  }));

  async function triggerSync(full = true) {
    setState({ kind: "syncing" });
    try {
      const res = await fetch(`/api/google/sync${full ? "?full=1" : ""}`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        pulled?: number;
        errors?: number;
        error?: string;
        reauth?: boolean;
      };

      if (res.status === 401 && body.reauth) {
        setState({ kind: "reauth" });
        return;
      }
      if (res.status === 429) {
        setState({ kind: "error", message: "Muitas sincronizações recentes. Tente em alguns minutos." });
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          message: body.error ?? `Erro ${res.status} ao sincronizar`,
        });
        return;
      }

      const pulled = body.pulled ?? 0;
      if (pulled === 0) {
        setState({ kind: "empty-calendar" });
        return;
      }
      setState({ kind: "success", pulled, todayEvents: 0 });
      // Force RSC re-fetch so /hoje re-runs its DB query and shows the new events.
      router.refresh();
    } catch {
      setState({
        kind: "error",
        message: "Sem conexão. Verifique sua internet e tente novamente.",
      });
    }
  }

  // Has events → show them
  if (blocks.length > 0) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">Agenda de hoje</h2>
          <Link href="/agenda-rotina" className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px]">
            Ver tudo
          </Link>
        </div>
        <div className="space-y-1.5">
          {blocks.map((b, i) => {
            const isPast = b.startAt < now;
            return (
              <div key={i} className={`flex items-center gap-2 text-sm ${isPast ? "opacity-50" : ""}`}>
                <span className="text-xs font-medium text-muted w-12">{formatBlockTime(b.startAt)}</span>
                <span className={isPast ? "text-muted line-through" : "text-foreground"}>{b.title}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // No events AND no Google connection — don't render at all
  if (!hasGoogleCal) return null;

  // Has Google connected but no events for today — smart recovery UI
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-foreground">Agenda de hoje</h2>
        <Link href="/agenda-rotina" className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px]">
          Ver tudo
        </Link>
      </div>

      {state.kind === "reauth" ? (
        <>
          <p className="text-xs text-muted mb-3">
            A conexão com o Google Agenda expirou ou foi revogada.
          </p>
          <a
            href="/api/auth/google"
            className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90"
          >
            Reconectar com Google
          </a>
        </>
      ) : state.kind === "syncing" ? (
        <>
          <p className="text-xs text-muted mb-2">Sincronizando com o Google Agenda…</p>
          <div className="h-1 w-full overflow-hidden rounded bg-surface-alt">
            <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
          </div>
        </>
      ) : state.kind === "success" ? (
        <>
          <p className="text-xs text-success-fg mb-2">
            ✓ Sincronizado: {state.pulled} evento{state.pulled === 1 ? "" : "s"} atualizado{state.pulled === 1 ? "" : "s"}.
          </p>
          <p className="text-xs text-muted">Carregando sua agenda de hoje…</p>
        </>
      ) : state.kind === "empty-calendar" ? (
        <>
          <p className="text-xs text-muted mb-2">
            Sincronização concluída. Seu Google Agenda não tem eventos para hoje.
          </p>
          <p className="text-[11px] text-muted mb-3">
            Se você tem eventos mas não aparecem aqui, pode ser o calendário errado conectado.
          </p>
          <Link
            href="/integracoes#google-agenda"
            className="inline-flex items-center min-h-[44px] text-xs font-medium text-primary hover:underline"
          >
            Gerenciar Google Agenda →
          </Link>
        </>
      ) : state.kind === "error" ? (
        <>
          <p className="text-xs text-danger-fg mb-2">{state.message}</p>
          <button
            onClick={() => triggerSync(true)}
            className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-surface-alt"
          >
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted mb-3">Nenhum evento carregado para hoje.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerSync(true)}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90"
            >
              Sincronizar agora
            </button>
            <Link
              href="/integracoes#google-agenda"
              className="inline-flex items-center min-h-[44px] text-xs text-muted hover:text-primary"
            >
              Trocar calendário
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
