"use client";

import { useState } from "react";

export function Greeting() {
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  });

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
    </div>
  );
}
