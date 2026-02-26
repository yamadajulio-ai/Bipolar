"use client";

import { Alert } from "@/components/Alert";

interface AlertasPadraoProps {
  alerts: string[];
}

export function AlertasPadrao({ alerts }: AlertasPadraoProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <Alert key={i} variant="warning">
          {alert}
        </Alert>
      ))}
    </div>
  );
}
