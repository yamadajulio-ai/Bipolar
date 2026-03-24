"use client";

import { useState, useEffect } from "react";

type JournalType = "DIARY" | "QUICK_INSIGHT";

const DRAFT_KEY = "journal_draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Draft {
  tab: JournalType;
  content: string;
  savedAt: number;
}

function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft: Draft = JSON.parse(raw);
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraftToStorage(tab: JournalType, content: string) {
  try {
    if (!content.trim()) {
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: Draft = { tab, content, savedAt: Date.now() };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function useJournalDraft() {
  // Load draft once on mount
  const [initialDraft] = useState(() => loadDraft());
  const [tab, setTab] = useState<JournalType>(initialDraft?.tab ?? "DIARY");
  const [content, setContent] = useState(initialDraft?.content ?? "");
  const [draftRestored, setDraftRestored] = useState(
    initialDraft !== null && initialDraft.content.trim().length > 0,
  );

  // Auto-save draft to sessionStorage on content/tab change
  useEffect(() => {
    saveDraftToStorage(tab, content);
    if (draftRestored && content.trim().length === 0) {
      setDraftRestored(false);
    }
  }, [tab, content, draftRestored]);

  const discardDraft = () => {
    setContent("");
    setDraftRestored(false);
    clearDraft();
  };

  return {
    tab,
    setTab,
    content,
    setContent,
    draftRestored,
    setDraftRestored,
    discardDraft,
  };
}
