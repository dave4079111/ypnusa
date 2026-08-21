"use client";

import { useMemo, useState } from "react";
import type { NurtureDashboardRow } from "@/lib/nurture-dashboard";

interface NurturePipelineProps {
  rows: NurtureDashboardRow[];
}

const ALL = "all";

function dateTime(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function stateTone(state: NurtureDashboardRow["state"]): string {
  if (state === "Appointment booked") return "bg-emerald-100 text-emerald-800";
  if (state === "Outreach failed") return "bg-rose-100 text-rose-800";
  if (state === "Nurture active") return "bg-violet-100 text-violet-800";
  return "bg-amber-100 text-amber-800";
}

function urgencyTone(urgency: NurtureDashboardRow["urgency"]): string {
  if (urgency === "critical") return "border-rose-400/40 bg-rose-400/15 text-rose-200";
  if (urgency === "high") return "border-amber-400/40 bg-amber-400/15 text-amber-100";
  if (urgency === "standard") return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  return "border-white/15 bg-white/5 text-white/55";
}

export function NurturePipeline({ rows }: NurturePipelineProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState(ALL);
  const [program, setProgram] = useState(ALL);
  const [urgency, setUrgency] = useState(ALL);

  const states = useMemo(
    () => Array.from(new Set(rows.map((row) => row.state))).sort(),
    [rows],
  );
  const programs = useMemo(
    () => Array.from(new Set(rows.map((row) => row.loanProgram))).sort(),
    [rows],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = rows.filter(
    (row) =>
      (!normalizedQuery ||
        row.borrowerName.toLocaleLowerCase().includes(normalizedQuery) ||
        row.officerName.toLocaleLowerCase().includes(normalizedQuery)) &&
      (state === ALL || row.state === state) &&
      (program === ALL || row.loanProgram === program) &&
      (urgency === ALL || row.urgency === urgency),
  );
  const hasFilters =
    normalizedQuery.length > 0 || state !== ALL || program !== ALL || urgency !== ALL;

  function clearFilters() {
    setQuery("");
    setState(ALL);
    setProgram(ALL);
    setUrgency(ALL);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06]">
      <div className="border-b border-white/10 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Borrower priority queue</h2>
            <p className="mt-1 text-sm text-white/50">
              Highest urgency and strongest scores rise first. Names remain abbreviated.
            </p>
          </div>
          <p className="text-sm font-medium text-white/55" aria-live="polite">
            Showing {filteredRows.length} of {rows.length}
          </p>
        </div>

        {rows.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,0.55fr))_auto]">
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
              Search
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Borrower or MLO"
                className="h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-white/30 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
              State
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-[#15132b] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              >
                <option value={ALL}>All states</option>
                {states.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
              Program
              <select
                value={program}
                onChange={(event) => setProgram(event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-[#15132b] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              >
                <option value={ALL}>All programs</option>
                {programs.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
              Urgency
              <select
                value={urgency}
                onChange={(event) => setUrgency(event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-[#15132b] px-3 text-sm font-normal capitalize tracking-normal text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              >
                <option value={ALL}>All urgency</option>
                {(["critical", "high", "standard", "low"] as const).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-11 self-end rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/75 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-semibold">No borrower conversations yet</p>
          <p className="mt-2 text-sm text-white/50">
            Complete the AI intake or post a lead webhook to populate this panel.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-semibold">No leads match these filters</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm font-semibold text-violet-300 hover:text-violet-200"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-black/15 text-xs uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Borrower</th>
                <th className="px-5 py-3 font-medium">Qualification</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Conversation</th>
                <th className="px-5 py-3 font-medium">Next action</th>
                <th className="px-5 py-3 font-medium">AI activity</th>
                <th className="px-5 py-3 font-medium">Assigned MLO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredRows.map((row) => (
                <tr key={row.leadId} className="transition hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${urgencyTone(row.urgency)}`}
                    >
                      {row.urgency}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{row.borrowerName}</p>
                    <p className="mt-1 text-xs text-white/45">{row.loanProgram}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="capitalize">{row.quality}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {row.creditTier} · {row.timeline}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-semibold">
                      {row.score}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stateTone(row.state)}`}
                    >
                      {row.state}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/75">
                    {row.appointmentStart ? (
                      <div>
                        <p>{dateTime(row.appointmentStart)}</p>
                        {row.meetingUrl ? (
                          <a
                            href={row.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-semibold text-violet-300 hover:text-violet-200"
                          >
                            Open meeting
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        <p>{dateTime(row.nextFollowUp)}</p>
                        <p className="mt-1 text-xs uppercase text-white/40">
                          {row.nextChannel ?? "Offer appointment"}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {row.aiEscalation ? (
                      <div>
                        <span className="inline-flex rounded-full border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200">
                          Escalated
                        </span>
                        <p className="mt-1 max-w-[16rem] text-xs text-white/60">{row.aiEscalation.reason}</p>
                      </div>
                    ) : row.latestAgentNote ? (
                      <p className="max-w-[16rem] text-xs text-white/50">
                        {row.latestAgentNote.replace(/^Agent ▸ /, "")}
                      </p>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-white/70">{row.officerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
