"use client";

import { useCallback, useState } from "react";
import type { CtaContext, CtaSet } from "@/lib/cta/ctaEngine";

interface UseCTAEngineState {
  data: CtaSet | null;
  error: string | null;
  loading: boolean;
}

export function useCTAEngine() {
  const [state, setState] = useState<UseCTAEngineState>({ data: null, error: null, loading: false });

  const generate = useCallback(async (context: CtaContext) => {
    setState({ data: null, error: null, loading: true });
    try {
      const response = await fetch("/api/cta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        cache: "no-store",
      });
      const result = (await response.json()) as { ok: boolean; cta?: CtaSet; error?: string };
      if (result.ok && result.cta) {
        setState({ data: result.cta, error: null, loading: false });
      } else {
        setState({ data: null, error: result.error ?? "CTA generation failed.", loading: false });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "CTA generation failed.";
      setState({ data: null, error: message, loading: false });
      return null;
    }
  }, []);

  return { ...state, generate };
}
