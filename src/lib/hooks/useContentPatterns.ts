"use client";

import { useCallback, useState } from "react";
import { parseContent, type Pattern } from "@/lib/agents/contentAgent";

/**
 * parseContent is pure/synchronous (no fetch, no fs) — this runs entirely
 * client-side, no /api/agent round trip needed.
 */
export function useContentPatterns() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);

  const addPattern = useCallback((raw: string) => {
    const pattern = parseContent(raw);
    setPatterns((prev) => [...prev, pattern]);
    return pattern;
  }, []);

  const reset = useCallback(() => setPatterns([]), []);

  return { patterns, addPattern, reset };
}
