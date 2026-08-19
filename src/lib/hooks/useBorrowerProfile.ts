"use client";

import { useCallback, useState } from "react";
import type { AgentResult } from "@/lib/agents/coreAgent";
import type { BorrowerProfile, BorrowerProfileBasics } from "@/lib/borrower/profileEngine";
import type { Lead } from "@/lib/agents/predictiveAgent";

interface UseBorrowerProfileState {
  data: BorrowerProfile | null;
  error: string | null;
  loading: boolean;
}

export function useBorrowerProfile() {
  const [state, setState] = useState<UseBorrowerProfileState>({ data: null, error: null, loading: false });

  const generate = useCallback(async (borrower: BorrowerProfileBasics, lead?: Lead) => {
    setState({ data: null, error: null, loading: true });
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "borrower-profile-by-zip", borrower, lead }),
        cache: "no-store",
      });
      const result = (await response.json()) as AgentResult<BorrowerProfile>;
      if (result.ok && result.data) {
        setState({ data: result.data, error: null, loading: false });
      } else {
        setState({ data: null, error: result.error ?? "Borrower profile generation failed.", loading: false });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Borrower profile generation failed.";
      setState({ data: null, error: message, loading: false });
      return null;
    }
  }, []);

  return { ...state, generate };
}
