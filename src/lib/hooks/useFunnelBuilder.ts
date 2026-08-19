"use client";

import { useCallback, useState } from "react";
import type { Pattern } from "@/lib/agents/contentAgent";
import type { GmbProfile } from "@/lib/agents/gmbAgent";
import { buildFunnel, type FunnelOutput } from "@/lib/content/funnelBuilder";

/** Pure/synchronous composition over the other agents — no /api/agent round trip needed. */
export function useFunnelBuilder() {
  const [funnel, setFunnel] = useState<FunnelOutput | null>(null);

  const generate = useCallback((pattern: Pattern, brandVoice: string, audience: string, gmbProfile?: GmbProfile) => {
    const result = buildFunnel(pattern, brandVoice, audience, gmbProfile);
    setFunnel(result);
    return result;
  }, []);

  return { funnel, generate };
}
