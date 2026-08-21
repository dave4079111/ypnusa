"use client";

import { useState } from "react";
import { useAgent } from "@/lib/hooks/useAgent";
import { Card, ErrorNote, GenerateButton } from "./dashboard-shell";

type TerritoryAction = "zip-suggest-territory" | "zip-score" | "zip-explain";

export function TerritoryPanel() {
  const [zip, setZip] = useState("");
  const [active, setActive] = useState<TerritoryAction | null>(null);
  const agent = useAgent<Record<string, unknown>>();

  async function run(action: TerritoryAction) {
    if (!/^\d{5}$/.test(zip)) return;
    setActive(action);
    await agent.run({ type: action, zip });
  }

  return (
    <Card title="ZIP territory scoring">
      <p className="text-sm text-slate-600">
        Wraps the same territory logic used by the live ZIP checker — availability, an opportunity score, and a
        plain-language explanation.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="e.g. 93720"
          inputMode="numeric"
          className="w-40 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <GenerateButton onClick={() => run("zip-suggest-territory")} loading={agent.loading && active === "zip-suggest-territory"}>
          Suggest
        </GenerateButton>
        <GenerateButton onClick={() => run("zip-score")} loading={agent.loading && active === "zip-score"}>
          Score
        </GenerateButton>
        <GenerateButton onClick={() => run("zip-explain")} loading={agent.loading && active === "zip-explain"}>
          Explain
        </GenerateButton>
      </div>

      <div className="mt-4">
        <ErrorNote error={agent.error} />
      </div>

      {agent.data ? (
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-cyan-100">
          {JSON.stringify(agent.data, null, 2)}
        </pre>
      ) : null}
    </Card>
  );
}
