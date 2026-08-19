"use client";

import { useCallback, useState } from "react";
import type { AgentResult, AgentTask } from "@/lib/agents/coreAgent";

/**
 * Generic POST /api/agent caller. Every other agent-specific hook in this
 * directory is a thin typed wrapper around this one.
 */

interface UseAgentState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useAgent<T = unknown>() {
  const [state, setState] = useState<UseAgentState<T>>({ data: null, error: null, loading: false });

  const run = useCallback(async (task: AgentTask): Promise<AgentResult<T> | null> => {
    setState({ data: null, error: null, loading: true });
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
        cache: "no-store",
      });
      const result = (await response.json()) as AgentResult<T>;
      if (result.ok) {
        setState({ data: result.data ?? null, error: null, loading: false });
      } else {
        setState({ data: null, error: result.error ?? "Agent task failed.", loading: false });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent task failed.";
      setState({ data: null, error: message, loading: false });
      return null;
    }
  }, []);

  return { ...state, run };
}
