"use client";

import { useState, useEffect } from "react";

export function Greeting() {
  const [greeting, setGreeting] = useState("Bem-vindo");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
    </div>
  );
}
