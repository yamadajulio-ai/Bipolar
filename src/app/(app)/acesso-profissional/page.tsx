"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

interface AccessLog {
  createdAt: string;
}

interface AccessLink {
  id: string;
  token: string;
  label: string | null;
  expiresAt: string;
  lastAccessedAt: string | null;
  createdAt: string;
  accessLogs?: AccessLog[];
}

interface NewAccess {
  token: string;
  pin: string;
  label: string | null;
  expiresAt: string;
}

export default function AcessoProfissionalPage() {
  const [accesses, setAccesses] = useState<AccessLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newAccess, setNewAccess] = useState<NewAccess | null>(null);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [shareSosEvents, setShareSosEvents] = useState(false);

  const loadAccesses = useCallback(async () => {
    try {
      const res = await fetch("/api/acesso-profissional");
      if (res.ok) {
        const data = await res.json();
        setAccesses(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccesses();
  }, [loadAccesses]);

  async function handleCreate() {
    if (!consentChecked) {
      setError("Você precisa concordar com o compartilhamento de dados.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/acesso-profissional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
          expiresInDays,
          shareSosEvents,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewAccess(data);
        setLabel("");
        setConsentChecked(false);
        loadAccesses();
      } else {
        const err = await res.json();
        setError(err.error || "Erro ao criar acesso.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await fetch(`/api/acesso-profissional?id=${id}`, { method: "DELETE" });
      loadAccesses();
    } catch {
      // silently fail
    }
  }

  function getAccessUrl(token: string): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/profissional/${token}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="py-12 text-center text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Acesso do Profissional</h1>
      <p className="mb-6 text-sm text-muted">
        Crie um link seguro para que seu profissional de saúde acesse seus dados
        de forma somente leitura. Você pode revogar o acesso a qualquer momento.
      </p>

      {/* New access just created — show PIN */}
      {newAccess && (
        <Alert variant="info" className="mb-6">
          <p className="mb-2 font-semibold">Acesso criado com sucesso!</p>
          <p className="mb-2 text-sm">
            Envie o link e o PIN para seu profissional. O PIN só será exibido
            esta vez.
          </p>
          <div className="space-y-2 rounded-lg bg-white/10 p-3 text-sm">
            <div>
              <span className="font-medium">Link:</span>{" "}
              <code className="break-all text-xs">
                {getAccessUrl(newAccess.token)}
              </code>
            </div>
            <div>
              <span className="font-medium">PIN:</span>{" "}
              <code className="text-2xl font-bold tracking-widest">
                {newAccess.pin}
              </code>
            </div>
            <div>
              <span className="font-medium">Expira em:</span>{" "}
              {formatDate(newAccess.expiresAt)}
            </div>
          </div>
          <button
            onClick={() => {
              const text = `Link: ${getAccessUrl(newAccess.token)}\nPIN: ${newAccess.pin}`;
              navigator.clipboard.writeText(text).catch(() => {});
            }}
            className="mt-3 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30"
          >
            Copiar link e PIN
          </button>
        </Alert>
      )}

      {/* Create new access */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Criar novo acesso</h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted">
            Nome do profissional (opcional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Dr. Silva"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            maxLength={100}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-muted">
            Validade do acesso
          </label>
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </div>

        {/* LGPD Consent */}
        <label className="mb-4 flex items-start gap-2">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-1 accent-primary"
          />
          <span className="text-xs text-muted">
            Autorizo o compartilhamento dos meus dados de humor, sono,
            medicação, sinais de alerta e métricas de saúde com o profissional
            indicado, de forma somente leitura, pelo período selecionado. Posso
            revogar este acesso a qualquer momento. (LGPD Art. 11, I — dados
            sensíveis de saúde com consentimento específico do titular)
          </span>
        </label>

        <details className="mb-4 rounded-lg bg-muted/10 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
            Saiba mais sobre privacidade e seus direitos (LGPD)
          </summary>
          <div className="mt-2 space-y-2 text-xs text-muted">
            <p>
              <strong>Controlador:</strong> Rede Bipolar. Para exercer seus
              direitos de titular (acesso, correção, exclusão, portabilidade),
              entre em contato pelo e-mail{" "}
              <a href="mailto:privacidade@redebipolar.com.br" className="underline">
                privacidade@redebipolar.com.br
              </a>.
            </p>
            <p>
              <strong>Finalidade:</strong> Permitir que o profissional de saúde
              indicado por você visualize seus dados clínicos de forma somente
              leitura, para apoiar seu acompanhamento terapêutico.
            </p>
            <p>
              <strong>Dados compartilhados:</strong> Registros de humor, sono,
              energia, medicação, sinais de alerta, ritmos sociais e métricas
              calculadas (insights). Eventos SOS somente se você optar acima.
            </p>
            <p>
              <strong>Retenção:</strong> O acesso expira automaticamente no prazo
              selecionado. Após expiração ou revogação, o profissional não terá
              mais acesso aos dados. Logs de auditoria são mantidos por 90 dias
              para sua segurança.
            </p>
            <p>
              <strong>Base legal:</strong> Consentimento específico do titular
              para dados sensíveis de saúde (LGPD Art. 11, I). Você pode revogar
              este consentimento a qualquer momento sem prejuízo.
            </p>
          </div>
        </details>

        <label className="mb-4 flex items-start gap-2">
          <input
            type="checkbox"
            checked={shareSosEvents}
            onChange={(e) => setShareSosEvents(e.target.checked)}
            className="mt-1 accent-primary"
          />
          <span className="text-xs text-muted">
            Também compartilhar registros de uso do botão SOS (opcional — ajuda
            o profissional a entender momentos de crise)
          </span>
        </label>

        {error && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {creating ? "Criando..." : "Gerar link de acesso"}
        </button>
      </Card>

      {/* Active accesses */}
      {accesses.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Acessos ativos</h2>
          <div className="space-y-3">
            {accesses.map((acc) => {
              const expired = new Date(acc.expiresAt) < new Date();
              return (
                <Card
                  key={acc.id}
                  className={expired ? "opacity-60" : ""}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {acc.label || "Profissional"}
                      </p>
                      <p className="text-xs text-muted">
                        Criado em {formatDate(acc.createdAt)}
                        {" · "}
                        {expired
                          ? "Expirado"
                          : `Expira em ${formatDate(acc.expiresAt)}`}
                      </p>
                      {acc.lastAccessedAt && (
                        <p className="text-xs text-muted">
                          Último acesso: {formatDate(acc.lastAccessedAt)}
                        </p>
                      )}
                      {acc.accessLogs && acc.accessLogs.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
                            Histórico de acessos ({acc.accessLogs.length})
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {acc.accessLogs.map((log, i) => (
                              <li key={i} className="text-xs text-muted">
                                {new Date(log.createdAt).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    {!expired && (
                      <button
                        onClick={() => handleRevoke(acc.id)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Alert variant="info" className="mt-6">
        <strong>Como funciona:</strong> Ao gerar um link, você recebe uma URL e
        um PIN de 6 dígitos. Envie ambos ao seu profissional. Ele poderá ver
        seus dados de humor, sono, medicação e métricas dos últimos 30 dias.
        Seus dados são somente leitura e o acesso pode ser revogado a qualquer
        momento.
      </Alert>
    </div>
  );
}
