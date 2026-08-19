"use client";

import { useCallback, useEffect, useState } from "react";
import { parseContent, type Pattern } from "@/lib/agents/contentAgent";

const STORAGE_KEY = "ypnus_content_patterns_v1";

function loadStored(): Pattern[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Pattern[]) : [];
  } catch {
    return [];
  }
}

/**
 * parseContent is pure/synchronous (no fetch, no fs) — this runs entirely
 * client-side, no /api/agent round trip needed. Patterns persist to
 * localStorage so /dashboard/content, /dashboard/silos, and
 * /dashboard/funnels share the same working set across navigation.
 */
export function useContentPatterns() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount hydration from localStorage; the initial render must stay [] to match SSR output.
    setPatterns(loadStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch {
      /** noop — storage unavailable or quota exceeded */
    }
  }, [patterns, hydrated]);

  const addPattern = useCallback((raw: string) => {
    const pattern = parseContent(raw);
    setPatterns((prev) => [...prev, pattern]);
    return pattern;
  }, []);

  const removePattern = useCallback((index: number) => {
    setPatterns((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => setPatterns([]), []);

  return { patterns, addPattern, removePattern, reset, hydrated };
}
