"use client";

import { useEffect, useState } from "react";
import type { AgentResult } from "@/lib/agents/coreAgent";
import type { Lead, PredictiveResult } from "@/lib/agents/predictiveAgent";

/**
 * Auto-runs when lead/zip are present, via the /api/agent "predict-lead-by-zip"
 * convenience task (server-side builds ZipContext + CountyEvents from the ZIP
 * and calls coreAgent.runPredictLeadForZip).
 */

interface UsePredictLeadState {
  data: PredictiveResult | null;
  error: string | null;
  loading: boolean;
}

export function usePredictLead(lead: Lead | null, zip: string | null) {
  const [state, setState] = useState<UsePredictLeadState>({ data: null, error: null, loading: false });
  const leadKey = lead ? JSON.stringify(lead) : null;

  useEffect(() => {
    if (!lead || !zip) return;
    let cancelled = false;

    async function run() {
      setState({ data: null, error: null, loading: true });
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "predict-lead-by-zip", lead, zip }),
          cache: "no-store",
        });
        const result = (await response.json()) as AgentResult<PredictiveResult>;
        if (cancelled) return;
        if (result.ok) {
          setState({ data: result.data ?? null, error: null, loading: false });
        } else {
          setState({ data: null, error: result.error ?? "Prediction failed.", loading: false });
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          data: null,
          error: error instanceof Error ? error.message : "Prediction failed.",
          loading: false,
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadKey, zip]);

  return state;
}
