/**
 * HojeSafetyGate — Client wrapper for SafetyInterstitial on /hoje.
 *
 * Manages the safety screening flow state (show/hide/defer)
 * on the server-rendered /hoje page.
 */

"use client";

import { useState, useEffect } from "react";
import { SafetyInterstitial } from "./SafetyInterstitial";

interface Props {
  source: "phq9_item9" | "warning_sign" | "manual_help_now";
  sourceAssessmentId?: string;
}

export function HojeSafetyGate({ source, sourceAssessmentId }: Props) {
  const [show, setShow] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [deferUntil, setDeferUntil] = useState<number | null>(null);

  // Check if deferred
  useEffect(() => {
    try {
      const deferred = localStorage.getItem("safety-screen-defer");
      if (deferred && Date.now() < parseInt(deferred, 10)) {
        setShow(false);
      }
    } catch { /* ignore */ }
  }, []);

  if (!show || completed) return null;

  return (
    <SafetyInterstitial
      source={source}
      sourceAssessmentId={sourceAssessmentId}
      onComplete={(result) => {
        setCompleted(true);
        // Refresh page to re-evaluate risk
        window.location.reload();
      }}
      onDefer={() => {
        // Defer for 15 minutes
        const until = Date.now() + 15 * 60 * 1000;
        setDeferUntil(until);
        try { localStorage.setItem("safety-screen-defer", String(until)); } catch { /* ignore */ }
        setShow(false);
      }}
    />
  );
}
