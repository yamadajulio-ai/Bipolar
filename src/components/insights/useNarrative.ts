"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { NarrativeResultV2 } from "@/lib/ai/narrative-types";

interface RawEvidenceChip {
  text: string;
  domain: string;
  kind: string;
  confidence: string;
}

export interface NarrativeResponse {
  cached: boolean;
  narrativeId?: string;
  narrative?: NarrativeResultV2;
  evidenceMap?: Record<string, RawEvidenceChip>;
  shareWithProfessional?: boolean;
  createdAt?: string;
  latestAttemptFailed?: boolean;
}

export function useNarrative() {
  const [data, setData] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCache, setLoadingCache] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryCooldown, setRetryCooldown] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<
    "useful" | "not_useful" | null
  >(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentPersisted, setConsentPersisted] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load cached narrative + check persisted consent on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch consent status and cached narrative in parallel
        const [consentRes, narrativeRes] = await Promise.all([
          fetch("/api/consentimentos").catch(() => null),
          fetch("/api/insights-narrative").catch(() => null),
        ]);

        if (!cancelled && consentRes?.ok) {
          const consentData = await consentRes.json();
          const hasAiConsent = (consentData.consents ?? []).some(
            (c: { scope: string }) => c.scope === "ai_narrative",
          );
          if (hasAiConsent) {
            setConsentChecked(true);
            setConsentPersisted(true);
          }
        }

        if (!cancelled && narrativeRes?.ok) {
          const json: NarrativeResponse = await narrativeRes.json();
          if (json.cached && json.narrative) {
            setData(json);
          } else if (json.latestAttemptFailed) {
            setData(json);
          }
        }
      } catch {
        /* ignore load errors */
      }
      if (!cancelled) setLoadingCache(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(async () => {
    if (retryCooldown) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setFeedbackSent(null);

    // Persist consent server-side on first generation (if not already persisted)
    if (consentChecked && !consentPersisted) {
      try {
        await fetch("/api/consentimentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "ai_narrative", action: "grant" }),
        });
        setConsentPersisted(true);
      } catch {
        /* consent persistence is best-effort — generation proceeds */
      }
    }

    try {
      const res = await fetch("/api/insights-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: consentChecked }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errorMsg = "Erro ao gerar narrativa";
        try {
          const body = JSON.parse(text);
          if (body.error) errorMsg = body.error;
        } catch {
          // Response is not JSON (possibly Cloudflare WAF page)
          errorMsg = `Erro ${res.status}: ${res.statusText || "resposta inesperada"}`;
        }
        throw new Error(errorMsg);
      }
      const json: NarrativeResponse = await res.json();
      setData(json);
      setRetryCount(0);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      const delay = Math.min(5000 * Math.pow(2, retryCount), 30_000);
      setRetryCount((c) => c + 1);
      setRetryCooldown(true);
      cooldownTimer.current = setTimeout(
        () => setRetryCooldown(false),
        delay,
      );
    } finally {
      setLoading(false);
    }
  }, [retryCooldown, retryCount, consentChecked, consentPersisted]);

  const submitFeedback = useCallback(
    async (rating: "useful" | "not_useful") => {
      if (!data?.narrativeId) return;
      setFeedbackSent(rating);
      try {
        await fetch("/api/insights-narrative/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narrativeId: data.narrativeId, rating }),
        });
      } catch {
        /* silent — feedback is best-effort */
      }
    },
    [data?.narrativeId],
  );

  return {
    data,
    loading,
    loadingCache,
    error,
    retryCooldown,
    feedbackSent,
    consentChecked,
    setConsentChecked,
    consentPersisted,
    generate,
    submitFeedback,
  };
}
