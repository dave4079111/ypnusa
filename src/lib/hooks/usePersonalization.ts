"use client";

import { useCallback, useState } from "react";
import type { CountyEvents, Lead, PredictiveResult, ZipContext } from "@/lib/agents/predictiveAgent";
import type { PersonalizationSummary } from "@/lib/personalization/personalizationEngine";

interface PersonalizeResponse {
  ok: boolean;
  zipContext?: ZipContext;
  countyEvents?: CountyEvents;
  predictive?: PredictiveResult | null;
  personalization?: PersonalizationSummary;
  error?: string;
}

interface UsePersonalizationState {
  data: PersonalizeResponse | null;
  error: string | null;
  loading: boolean;
}

export function usePersonalization() {
  const [state, setState] = useState<UsePersonalizationState>({ data: null, error: null, loading: false });

  const generate = useCallback(async (zip: string, lead?: Lead) => {
    setState({ data: null, error: null, loading: true });
    try {
      const response = await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, lead }),
        cache: "no-store",
      });
      const result = (await response.json()) as PersonalizeResponse;
      if (result.ok) {
        setState({ data: result, error: null, loading: false });
      } else {
        setState({ data: null, error: result.error ?? "Personalization failed.", loading: false });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Personalization failed.";
      setState({ data: null, error: message, loading: false });
      return null;
    }
  }, []);

  return { ...state, generate };
}
