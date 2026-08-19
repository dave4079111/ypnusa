"use client";

import { useCallback, useState } from "react";
import type { Pattern } from "@/lib/agents/contentAgent";
import type { FunnelOutput } from "@/lib/content/funnelBuilder";
import type { CtaSet } from "@/lib/cta/ctaEngine";
import type { PersonalizationSummary } from "@/lib/personalization/personalizationEngine";

interface OptimizeFunnelResponse {
  ok: boolean;
  funnel?: FunnelOutput;
  personalization?: PersonalizationSummary | null;
  cta?: CtaSet;
  error?: string;
}

interface UseFunnelOptimizationState {
  data: OptimizeFunnelResponse | null;
  error: string | null;
  loading: boolean;
}

export function useFunnelOptimization() {
  const [state, setState] = useState<UseFunnelOptimizationState>({ data: null, error: null, loading: false });

  const optimize = useCallback(
    async (pattern: Pattern, options?: { brandVoice?: string; audience?: string; zip?: string }) => {
      setState({ data: null, error: null, loading: true });
      try {
        const response = await fetch("/api/funnel/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pattern, ...options }),
          cache: "no-store",
        });
        const result = (await response.json()) as OptimizeFunnelResponse;
        if (result.ok) {
          setState({ data: result, error: null, loading: false });
        } else {
          setState({ data: null, error: result.error ?? "Funnel optimization failed.", loading: false });
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Funnel optimization failed.";
        setState({ data: null, error: message, loading: false });
        return null;
      }
    },
    [],
  );

  return { ...state, optimize };
}
