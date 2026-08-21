"use client";

import { useCallback, useState } from "react";
import type { AgentResult } from "@/lib/agents/coreAgent";
import type { OutcomeSignals } from "@/lib/predictive/outcomeEngine";
import type { Lead } from "@/lib/agents/predictiveAgent";

interface UseOutcomePredictionState {
  data: OutcomeSignals | null;
  error: string | null;
  loading: boolean;
}

export function useOutcomePrediction() {
  const [state, setState] = useState<UseOutcomePredictionState>({ data: null, error: null, loading: false });

  const predict = useCallback(async (lead: Lead, zip: string) => {
    setState({ data: null, error: null, loading: true });
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "predict-outcome-by-zip", lead, zip }),
        cache: "no-store",
      });
      const result = (await response.json()) as AgentResult<OutcomeSignals>;
      if (result.ok && result.data) {
        setState({ data: result.data, error: null, loading: false });
      } else {
        setState({ data: null, error: result.error ?? "Outcome prediction failed.", loading: false });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Outcome prediction failed.";
      setState({ data: null, error: message, loading: false });
      return null;
    }
  }, []);

  return { ...state, predict };
}
