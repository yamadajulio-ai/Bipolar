"use client";

import { useState } from "react";

interface Props {
  masked: string;
  full: string;
  entityType: string; // "user" | "sos_event" | "phq9" | "feedback"
  entityId: string;
}

/**
 * Reveals masked PII on click with audit logging.
 * Used in admin pages to comply with data minimization principle.
 */
export function RevealPII({ masked, full, entityType, entityId }: Props) {
  const [revealed, setRevealed] = useState(false);

  function reveal() {
    setRevealed(true);
    fetch("/api/admin/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reveal_pii",
        metadata: { entityType, entityId },
      }),
    }).catch(() => {});
  }

  if (revealed) {
    return <span className="text-xs text-foreground">{full}</span>;
  }

  return (
    <button
      onClick={reveal}
      className="text-xs text-muted underline hover:text-foreground"
      title="Revelar dado (ação auditada)"
    >
      {masked}
    </button>
  );
}
