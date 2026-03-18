"use client";

import { useState } from "react";

interface Props {
  masked: string;
  full: string;
  feedbackId: string;
}

export function RevealEmail({ masked, full, feedbackId }: Props) {
  const [revealed, setRevealed] = useState(false);

  function reveal() {
    setRevealed(true);
    // Log the reveal action (fire-and-forget for audit)
    fetch("/api/admin/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reveal_email", feedbackId }),
    }).catch(() => {});
  }

  if (revealed) {
    return <span className="text-xs text-foreground">{full}</span>;
  }

  return (
    <button
      onClick={reveal}
      className="text-xs text-muted underline hover:text-foreground"
      title="Revelar email (ação auditada)"
    >
      {masked}
    </button>
  );
}
