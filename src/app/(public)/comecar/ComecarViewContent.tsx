"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/components/MetaPixel";

/** Dispara o evento ViewContent do Meta Pixel ao montar a landing page */
export function ComecarViewContent() {
  useEffect(() => {
    trackViewContent({ content_name: "landing_comecar" });
  }, []);

  return null;
}
