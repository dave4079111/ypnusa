"use client";

import type { BorrowerAnswers, LoanProgram } from "@/lib/types";
import type { AssistantStep, IntakeTickResponse } from "@/lib/intake-contracts";
import { PROGRAM_LIST } from "@/lib/programs";
import { useCallback, useEffect, useRef, useState } from "react";

type Bubble = { id: string; role: "assistant" | "user" | "system"; body: string };
type IncomingPayload = { field: keyof BorrowerAnswers; rawValue: string };

const STORAGE_KEY = "loanpilot_session_v2";

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function slotPretty(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function LoanPilotFloatingIntake(props: { funnelSource?: string }) {
  const funnel = props.funnelSource ?? "loanpilot_ai_surface";

  const [loanProgram, setLoanProgram] = useState<LoanProgram>("FHA");
  const [open, setOpen] = useState(false);

  const [sessionIdState, setSessionIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : null,
  );
  const sessionIdRef = useRef<string | null>(null);

  const automationSentRef = useRef(false);
  const hasHydratedFsRef = useRef(false);

  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [pct, setPct] = useState(8);
  const [counts, setCounts] = useState({ done: 0, total: 1 });
  const [phase, setPhase] = useState<IntakeTickResponse["phase"]>("collecting");
  const [step, setStep] = useState<AssistantStep | null>(null);
  const [crm, setCrm] = useState<IntakeTickResponse["crmArtifacts"]>();
  const [slots, setSlots] = useState<NonNullable<IntakeTickResponse["slotPreview"]>>([]);
  const [draft, setDraft] = useState("");
  const [booked, setBooked] = useState(false);
  const [busy, setBusy] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);

  /** Hydrate persisted session ids after mount without touching SSR */
  useEffect(() => {
    if (hasHydratedFsRef.current) return;
    hasHydratedFsRef.current = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        sessionIdRef.current = stored;
        setSessionIdState(stored);
      }
    } catch {
      /** noop */
    }
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    queueMicrotask(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [msgs, open, phase, busy]);

  const pushAssistant = useCallback((t: string) => {
    const b = t.trim();
    if (!b) return;

    setMsgs((prev) => [...prev, { id: makeId("as"), role: "assistant", body: b }]);
  }, []);

  const pushUser = useCallback((t: string) => {
    const b = t.trim();
    if (!b) return;

    setMsgs((prev) => [...prev, { id: makeId("us"), role: "user", body: b }]);
  }, []);

  const pushSys = useCallback((t: string) => {
    const b = t.trim();
    if (!b) return;

    setMsgs((prev) => [...prev, { id: makeId("sy"), role: "system", body: b }]);
  }, []);

  const rememberSession = useCallback((id: string) => {
    sessionIdRef.current = id;
    setSessionIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /** noop */
    }
  }, []);

  const purgeSession = useCallback(() => {
    sessionIdRef.current = null;
    setSessionIdState(null);
    automationSentRef.current = false;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /** noop */
    }
  }, []);

  async function hydrateSlots(preview?: IntakeTickResponse["slotPreview"], officerId?: string | null) {
    if (preview?.length) {
      setSlots(preview.slice(0, 14));
      return;
    }
    if (!officerId) {
      setSlots([]);
      return;
    }
    try {
      const res = await fetch(`/api/calendar/slots?loId=${encodeURIComponent(officerId)}`);
      const payload = (await res.json()) as { slots?: NonNullable<IntakeTickResponse["slotPreview"]> };

      setSlots((payload.slots ?? []).slice(0, 14));
    } catch {
      setSlots([]);
    }
  }

  async function applySnapshot(snapshot: IntakeTickResponse) {
    rememberSession(snapshot.sessionId);

    const denominator = Math.max(1, snapshot.progress.totalApplicable);
    const numerator = snapshot.progress.completed;
    const derivedPct =
      snapshot.progress.totalApplicable === 0
        ? snapshot.progress.pct
        : Math.max(6, Math.min(100, Math.round((numerator / denominator) * 100)));

    setPct(derivedPct);
    setCounts({ done: numerator, total: snapshot.progress.totalApplicable || denominator });
    setPhase(snapshot.phase);

    if (snapshot.phase === "crm_synced") {
      setStep(null);
      setCrm(snapshot.crmArtifacts);
      await hydrateSlots(snapshot.slotPreview, snapshot.crmArtifacts?.assignedOfficer?.id);

      if (snapshot.ok && !automationSentRef.current) {
        automationSentRef.current = true;
        fetch("/api/automation/process", { method: "POST" }).catch(() => undefined);
      }

      setBooked(false);
    } else {
      setSlots([]);
      setCrm(undefined);
      setStep(snapshot.activeStep ?? null);
    }

    if (snapshot.ok && snapshot.assistantMessage.trim()) {
      pushAssistant(snapshot.assistantMessage);
    }
    if (!snapshot.ok && snapshot.error) {
      pushSys(snapshot.error);
    }
  }

  async function postTick(payload?: IncomingPayload) {
    setBusy(true);
    try {
      const res = await fetch("/api/intake/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current ?? undefined,
          loanProgram,
          funnelSource: funnel,
          incoming: payload,
        }),
      });

      const snapshot = (await res.json()) as IntakeTickResponse;
      await applySnapshot(snapshot);
      return snapshot;
    } catch {
      pushSys("Network turbulence—LoanPilot LOS bridge unavailable.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function bootConversation() {
    if (msgs.length > 0) return;

    await postTick();
  }

  function handleOpen() {
    setOpen(true);
    void bootConversation();
  }

  function handleReset() {
    purgeSession();
    setMsgs([]);
    setDraft("");
    setBooked(false);
    setPhase("collecting");
    setStep(null);
    setCrm(undefined);
    setSlots([]);
    void postTick();
  }

  async function submitAnswer(field: AssistantStep, raw: string, label?: string) {
    pushUser(label ?? raw);
    await postTick({ field: field.field, rawValue: raw });
    setDraft("");
  }

  async function handleBook(startIso: string, loId: string) {
    if (!crm?.borrowerLeadId || !crm?.assignedOfficer?.id) {
      pushSys("Complete intake routing before booking LOS consultations.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrowerLeadId: crm.borrowerLeadId,
          loId,
          startIso,
          notes: "AI intake booking",
        }),
      });

      const body = (await res.json()) as { ok?: boolean; error?: string; appointment?: { id: string } };

      if (!body.ok) {
        pushSys(body.error ?? "Booking blocked—double-check slot availability.");
        return;
      }

      setBooked(true);
      pushSys(`Consultation locked (${body.appointment?.id ?? "reference pending"}).`);
    } catch {
      pushSys("Booking transport failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputKind = step?.kind === "number" ? "number" : "text";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-6 right-4 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-2xl shadow-cyan-500/40 md:right-8"
      >
        <span className="text-lg" aria-hidden>
          ⚡️
        </span>
        AI intake concierge
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:inset-auto md:bottom-6 md:right-6 md:flex md:justify-end">
          <button
            type="button"
            aria-label="Backdrop"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
            onClick={() => setOpen(false)}
          />

          <section className="relative flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-[#f6fbff] shadow-2xl md:h-[min(820px,calc(100vh-48px))] md:rounded-[28px] md:border md:border-white md:bg-white md:shadow-cyan-200/70">
            <header className="border-b border-slate-100 px-5 pb-4 pt-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-teal-600 text-white shadow-lg shadow-cyan-500/35">
                  LP
                </div>

                <div className="flex-1 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">LoanPilot AI</p>
                  <h2 className="text-xl font-semibold text-slate-950">Mortgage intake assistant</h2>
                  <p className="text-sm text-slate-600">{funnel}</p>
                </div>

                <div className="flex flex-col gap-2 text-[11px] text-slate-500">
                  <button type="button" className="rounded-full px-3 py-1 hover:bg-slate-100" onClick={() => setOpen(false)}>
                    Close
                  </button>
                  <button type="button" className="rounded-full px-3 py-1 hover:bg-slate-100" onClick={handleReset} disabled={busy}>
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Progress</span>
                  <span>
                    {counts.done}/{counts.total} · {pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all"
                    style={{ width: `${Math.max(6, Math.min(100, pct))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {phase === "crm_synced" ? "CRM + nurture automations engaged" : "Adaptive LOS questioning"}
                </p>
              </div>

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Program lane
                <select
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner disabled:opacity-55"
                  value={loanProgram}
                  disabled={Boolean(sessionIdState) || busy}
                  onChange={(evt) => setLoanProgram(evt.target.value as LoanProgram)}
                >
                  {PROGRAM_LIST.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-[11px] text-slate-500">Program locks once the LOS handshake begins.</p>
            </header>

            <div ref={scrollerRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
              {msgs.map((bubble) => (
                <article
                  key={bubble.id}
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    bubble.role === "assistant"
                      ? "self-start bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 rounded-bl-[6px]"
                      : bubble.role === "user"
                        ? "self-end bg-slate-900 text-white shadow-md rounded-br-[6px]"
                        : "self-center text-center text-xs italic text-slate-500"
                  }`}
                >
                  {bubble.body}
                </article>
              ))}
            </div>

            <footer className="space-y-3 border-t border-slate-100 px-5 py-4">
              {phase === "crm_synced" ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Appointment rail</p>
                  <div className="flex flex-wrap gap-2">
                    {(slots ?? []).map((slot) => (
                      <button
                        key={`${slot.loId}-${slot.start}`}
                        type="button"
                        disabled={busy || booked}
                        onClick={() => void handleBook(slot.start, slot.loId)}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-xs hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {slotPretty(slot.start)}
                      </button>
                    ))}
                  </div>
                  {booked ? <p className="text-xs text-emerald-600">Consultation placeholder confirmed.</p> : null}
                </div>
              ) : null}

              {step?.chips && step.kind !== "number" ? (
                <div className="flex flex-wrap gap-2">
                  {step.chips.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      disabled={busy || phase === "crm_synced"}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 shadow-xs hover:border-cyan-400 disabled:opacity-40"
                      onClick={() => step && submitAnswer(step, chip.value, chip.label)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {phase === "collecting" ? (
                <div className="flex gap-2">
                  <input
                    disabled={busy || !step}
                    value={draft}
                    onChange={(evt) => setDraft(evt.target.value)}
                    onKeyDown={(evt) => {
                      if (!step) return;
                      if (evt.key === "Enter" && !evt.shiftKey) {
                        evt.preventDefault();
                        submitAnswer(step, draft);
                      }
                    }}
                    type={inputKind}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring"
                    placeholder={step?.placeholder ?? "Answer the LOS AI"}
                  />
                  <button
                    type="button"
                    disabled={busy || !step}
                    onClick={() => step && submitAnswer(step, draft)}
                    className="rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 disabled:opacity-35"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  LOS + CRM payloads mirrored. Wire Twilio/SendGrid webhooks atop the automation ledger for prod.
                </p>
              )}
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
