"use client";

import { useCallback, useState } from "react";
import type { FunnelStage } from "@/lib/funnel/stageTracker";

interface UseStageTrackingState {
  error: string | null;
  loading: boolean;
}

interface TrackResponse {
  ok: boolean;
  error?: string;
}

/** Calls the PUBLIC /api/funnel/track route — safe to use from anonymous pages. */
export function useStageTracking(id: string) {
  const [state, setState] = useState<UseStageTrackingState>({ error: null, loading: false });

  const send = useCallback(
    async (body: { stage?: FunnelStage; ctaLabel?: string }) => {
      setState({ error: null, loading: true });
      try {
        const response = await fetch("/api/funnel/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIdOrAnonId: id, ...body }),
          cache: "no-store",
        });
        const result = (await response.json()) as TrackResponse;
        setState({ error: result.ok ? null : result.error ?? "Tracking failed.", loading: false });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tracking failed.";
        setState({ error: message, loading: false });
        return null;
      }
    },
    [id],
  );

  const trackStage = useCallback((stage: FunnelStage) => send({ stage }), [send]);
  const trackCtaClick = useCallback((ctaLabel: string) => send({ ctaLabel }), [send]);

  return { ...state, trackStage, trackCtaClick };
}
