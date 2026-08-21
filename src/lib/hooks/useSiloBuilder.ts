"use client";

import { useMemo } from "react";
import type { Pattern } from "@/lib/agents/contentAgent";
import { groupPatternsBySilo, recommendForPattern, type SiloRecommendation } from "@/lib/content/siloBuilder";

/** Pure/synchronous classification — no /api/agent round trip needed. */
export function useSiloBuilder(patterns: Pattern[]) {
  const groups = useMemo(() => groupPatternsBySilo(patterns), [patterns]);
  const recommendations = useMemo<SiloRecommendation[]>(
    () => patterns.map((pattern) => recommendForPattern(pattern)),
    [patterns],
  );

  return { groups, recommendations, recommend: recommendForPattern };
}
