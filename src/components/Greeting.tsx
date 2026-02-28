"use client";

import { useState, useEffect } from "react";

export function Greeting() {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  return <h1 className="text-2xl font-bold">{greeting}</h1>;
}
