"use client";

import { useState, useCallback } from "react";

type JournalType = "DIARY" | "QUICK_INSIGHT";

export interface JournalEntry {
  id: string;
  type: JournalType;
  content: string;
  maniaScore: number | null;
  depressionScore: number | null;
  energyScore: number | null;
  zoneAtCapture: string | null;
  mixedAtCapture: boolean | null;
  snapshotSource: string;
  entryDateLocal: string;
  aiUseAllowed: boolean;
  editedAt: string | null;
  createdAt: string;
}

export interface ReflectionData {
  periodStart: string;
  periodEnd: string;
  stats: {
    totalEntries: number;
    diaryCount: number;
    insightCount: number;
    daysWithEntries: number;
    avgMood: number | null;
    avgSleep: number | null;
    medicationAdherence: number | null;
  };
  moodJourney: {
    zone: string;
    label: string;
    count: number;
    excerpts: string[];
  }[];
  highlights: string[];
}

export function useJournalEntries(initialEntries: JournalEntry[]) {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialEntries.length >= 20
      ? initialEntries[initialEntries.length - 1]?.id
      : null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<JournalType | "ALL">("ALL");
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loadingReflection, setLoadingReflection] = useState(false);

  // ── Save entry ─────────────────────────────────────────────

  const handleSave = useCallback(
    async (
      tab: JournalType,
      content: string,
      onSuccess: () => void,
    ) => {
      if (!content.trim() || saving) return;

      setSaving(true);
      try {
        const res = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: tab,
            content: content.trim(),
            idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error || "Erro ao salvar.");
          return;
        }

        const data = await res.json();

        // Show SOS if crisis detected — never block
        if (data.crisisDetected) {
          setShowSOS(true);
        }

        // Reload entries to get full data
        onSuccess();
        const listRes = await fetch("/api/journal?limit=20");
        if (listRes.ok) {
          const listData = await listRes.json();
          setEntries(listData.items);
          setNextCursor(listData.nextCursor);
        }
      } catch {
        alert("Erro de conexão.");
      } finally {
        setSaving(false);
      }
    },
    [saving],
  );

  // ── Edit entry ─────────────────────────────────────────────

  const handleEdit = useCallback(
    async (id: string) => {
      if (!editContent.trim()) return;

      try {
        const res = await fetch(`/api/journal/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent.trim() }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error || "Erro ao editar.");
          return;
        }

        const data = await res.json();
        if (data.crisisDetected) setShowSOS(true);

        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  content: editContent.trim(),
                  editedAt: new Date().toISOString(),
                }
              : e,
          ),
        );
        setEditingId(null);
        setEditContent("");
      } catch {
        alert("Erro de conexão.");
      }
    },
    [editContent],
  );

  // ── Delete entry ───────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Tem certeza? Esta ação é permanente.")) return;

    try {
      const res = await fetch(`/api/journal/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      alert("Erro ao excluir.");
    }
  }, []);

  // ── Load more ──────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        limit: "20",
      });
      if (filter !== "ALL") params.set("type", filter);

      const res = await fetch(`/api/journal?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, filter]);

  // ── Load weekly reflection ──────────────────────────────────

  const loadReflection = useCallback(async () => {
    if (loadingReflection) return;
    setLoadingReflection(true);
    try {
      const res = await fetch("/api/journal/reflection");
      if (res.ok) {
        const data = await res.json();
        setReflection(data.reflection);
      }
    } finally {
      setLoadingReflection(false);
    }
  }, [loadingReflection]);

  // ── Filtered entries ───────────────────────────────────────

  const filteredEntries =
    filter === "ALL" ? entries : entries.filter((e) => e.type === filter);

  return {
    entries,
    filteredEntries,
    editingId,
    setEditingId,
    editContent,
    setEditContent,
    saving,
    showSOS,
    setShowSOS,
    nextCursor,
    loadingMore,
    filter,
    setFilter,
    reflection,
    setReflection,
    loadingReflection,
    handleSave,
    handleEdit,
    handleDelete,
    loadMore,
    loadReflection,
  };
}
