"use client";

import type { BorrowerAnswers, LoanProgram } from "@/lib/types";
import type { AssistantStep, IntakeTickResponse } from "@/lib/intake-contracts";
import { PROGRAM_LIST } from "@/lib/programs";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type Bubble = { id: string; role: "assistant" | "user" | "system"; body: string };
type IncomingPayload = { field: keyof BorrowerAnswers; rawValue: string };
type BookedAppointment = {
  id: string;
  status?: "reserved" | "booked" | "handoff";
  provider?: string;
  meetingUrl?: string;
  externalBookingUrl?: string;
};

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

type IntakeBrand = "loanpilot" | "ypn";
type IntakeVariant = "fab" | "embed";

export function MortgageIntakeChat(props: {
  funnelSource?: string;
  brand?: IntakeBrand;
  variant?: IntakeVariant;
}) {
  const brand = props.brand ?? "loanpilot";
  const variant = props.variant ?? "fab";
  const funnel =
    props.funnelSource ??
    (brand === "ypn" ? "ypn_embed_canonical" : "loanpilot_ai_surface");

  const STORAGE_KEY = brand === "ypn" ? "ypn_intake_sess_v1" : "loanpilot_session_v2";

  const [loanProgram, setLoanProgram] = useState<LoanProgram>("FHA");
  const [open, setOpen] = useState(variant !== "fab");

  const [sessionIdState, setSessionIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : null,
  );
  const sessionIdRef = useRef<string | null>(null);

  const hasHydratedFsRef = useRef(false);
  const embedBootedRef = useRef(false);

  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [pct, setPct] = useState(8);
  const [counts, setCounts] = useState({ done: 0, total: 1 });
  const [phase, setPhase] = useState<IntakeTickResponse["phase"]>("collecting");
  const [step, setStep] = useState<AssistantStep | null>(null);
  const [crm, setCrm] = useState<IntakeTickResponse["crmArtifacts"]>();
  const [slots, setSlots] = useState<NonNullable<IntakeTickResponse["slotPreview"]>>([]);
  const [draft, setDraft] = useState("");
  const [booked, setBooked] = useState<BookedAppointment | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const surfaceOpen = variant === "embed" || open;

  /** Hydrate persisted session ids after mount without touching SSR */
  useEffect(() => {
    if (hasHydratedFsRef.current) return;
    hasHydratedFsRef.current = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        sessionIdRef.current = stored;
        // Hydrate after SSR so server/client markup stay aligned until mount
        setSessionIdState(stored); // eslint-disable-line react-hooks/set-state-in-effect
      }
    } catch {
      /** noop */
    }
  }, [STORAGE_KEY]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    queueMicrotask(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [msgs, open, phase, busy, variant, lastError]);

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
  }, [STORAGE_KEY]);

  const purgeSession = useCallback(() => {
    sessionIdRef.current = null;
    setSessionIdState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /** noop */
    }
  }, [STORAGE_KEY]);

  async function hydrateSlots(preview?: IntakeTickResponse["slotPreview"], officerId?: string | null) {
    if (preview?.length) {
      setSlots(preview.slice(0, 3));
    }
    if (!officerId) {
      setSlots([]);
      return;
    }
    try {
      const res = await fetch(`/api/calendar/slots?loId=${encodeURIComponent(officerId)}`);
      const payload = (await res.json()) as { slots?: NonNullable<IntakeTickResponse["slotPreview"]> };

      setSlots((payload.slots ?? []).slice(0, 3));
    } catch {
      setSlots([]);
    }
  }

  async function applySnapshot(snapshot: IntakeTickResponse) {
    setLastError(snapshot.ok ? null : snapshot.error ?? "The intake tick could not complete.");
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

      setBooked(null);
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
    setLastError(null);
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

      if (!res.ok) {
        throw new Error("Intake service unavailable.");
      }

      const snapshot = (await res.json()) as IntakeTickResponse;
      await applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      const message =
        brand === "ypn"
          ? "Connection glitch — retry when you’re back online."
          : "Network turbulence—LoanPilot LOS bridge unavailable.";
      setLastError(error instanceof Error && error.message ? `${message} ${error.message}` : message);
      pushSys(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function bootConversation() {
    if (msgs.length > 0) return;
    await postTick();
  }

  /** Embed: start intake once; guard against Strict Mode double-invoke. */
  useEffect(() => {
    if (variant !== "embed") return;
    if (embedBootedRef.current) return;
    embedBootedRef.current = true;
    void (async () => {
      await postTick();
    })();
    // Intentionally once per embed mount; postTick closes over latest state on first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  /** Notify iframe parents when the widget height changes (e.g. resize embed container). */
  useEffect(() => {
    if (variant !== "embed") return;
    const el = rootRef.current;
    if (!el || typeof window === "undefined") return;
    if (window.parent === window) return;

    const notify = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      window.parent.postMessage({ type: "ypn-intake-height", height: h }, "*");
    };

    notify();
    const ro = new ResizeObserver(notify);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, surfaceOpen, msgs.length, phase, open, booked, slots.length]);

  function handleOpen() {
    setOpen(true);
    void bootConversation();
  }

  function handleReset() {
    purgeSession();
    setMsgs([]);
    setDraft("");
    setBooked(null);
    setPhase("collecting");
    setStep(null);
    setCrm(undefined);
    setSlots([]);
    setLastError(null);
    void postTick();
  }

  async function submitAnswer(field: AssistantStep, raw: string, label?: string) {
    pushUser(label ?? raw);
    await postTick({ field: field.field, rawValue: raw });
    setDraft("");
  }

  async function handleBook(startIso: string, loId: string) {
    if (!crm?.borrowerLeadId || !crm?.assignedOfficer?.id || !crm.bookingToken) {
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
          bookingToken: crm.bookingToken,
          notes: "AI intake booking",
        }),
      });

      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        appointment?: BookedAppointment;
      };

      if (!body.ok) {
        pushSys(body.error ?? "Booking blocked—double-check slot availability.");
        return;
      }

      setBooked(body.appointment ?? null);
      pushSys(
        body.appointment?.status === "handoff"
          ? "Continue in Calendly to confirm your consultation."
          : `Consultation locked (${body.appointment?.id ?? "reference pending"}).`,
      );
    } catch {
      pushSys("Booking transport failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputKind = step?.kind === "number" ? "number" : "text";

  const shellPanel =
    variant === "fab"
      ? "shadow-2xl md:h-[min(820px,calc(100vh-48px))] md:rounded-[28px] md:shadow-cyan-200/70 md:border-white md:bg-white"
      : "min-h-[min(720px,94vh)] w-full rounded-none border shadow-xl md:h-[min(820px,calc(100vh-32px))] md:rounded-[28px]";

  const ambientSurface =
    brand === "ypn"
      ? "border-[#09152a]/10 bg-[#fcfcfb] md:border md:bg-[#fdfcf7]"
      : "border-white bg-[#f6fbff] md:bg-white md:border";

  const markBubble =
    brand === "ypn"
      ? "bg-gradient-to-br from-[#c8a84b] to-[#a88935] text-[#09152a] shadow-md shadow-yellow-950/15"
      : "bg-gradient-to-br from-cyan-500 via-sky-500 to-teal-600 text-white shadow-lg shadow-cyan-500/35";

  const progressFillTone =
    brand === "ypn"
      ? "bg-gradient-to-r from-[#09152a] to-[#17335f]"
      : "bg-gradient-to-r from-cyan-500 to-teal-500";

  const labelTone =
    brand === "ypn"
      ? "text-[11px] font-semibold uppercase tracking-[0.16em] text-[#09152a]/60"
      : "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

  const sendGradient =
    brand === "ypn"
      ? "bg-gradient-to-r from-[#09152a] to-[#1c3a66] text-white shadow-xl shadow-black/35"
      : "bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/40";

  const chipHover = brand === "ypn" ? "hover:border-[#c8a84b]" : "hover:border-cyan-400";

  const chipSlot = brand === "ypn" ? "border-[#c8a84b]/55 hover:border-[#c8a84b]" : "border-cyan-200 hover:border-cyan-400";

  const ringFocus =
    brand === "ypn"
      ? "border-slate-200 outline-none ring-[#f3e9c9] focus:ring-2"
      : "border-slate-200 outline-none ring-cyan-200 focus:ring";

  const fabGradient =
    brand === "ypn"
      ? "bg-gradient-to-r from-[#09152a] to-[#1c3a66] shadow-black/40"
      : "bg-gradient-to-r from-cyan-500 to-teal-600 shadow-cyan-500/40";

  const brandMark = brand === "ypn" ? "YPN" : "LP";
  const brandLine = brand === "ypn" ? "YPN AI" : "LoanPilot AI";
  const titleLine = brand === "ypn" ? "Borrower intake" : "Mortgage intake assistant";
  const progressNote =
    phase === "crm_synced"
      ? brand === "ypn"
        ? "Profile synced — team follow-up engaged"
        : "CRM + nurture automations engaged"
      : brand === "ypn"
        ? "Adaptive qualification"
        : "Adaptive LOS questioning";

  const closedFooter =
    brand === "ypn"
      ? "Profile captured. Your loan team can continue by SMS or email when those channels are connected."
      : "LOS + CRM payloads mirrored. Wire Twilio/SendGrid webhooks atop the automation ledger for prod.";

  return (
    <div ref={rootRef} className="relative">
      {variant === "fab" && !surfaceOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-2xl transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 md:bottom-6 md:right-8 ${fabGradient}`}
        >
          <span className="text-lg" aria-hidden>
            {brand === "ypn" ? "✦" : "⚡️"}
          </span>
          {brand === "ypn" ? "Start intake" : "AI intake concierge"}
        </button>
      ) : null}

      {surfaceOpen ? (
        variant === "fab" ? (
          <div className="fixed inset-0 z-50 md:inset-auto md:bottom-6 md:right-6 md:flex md:justify-end">
            <button
              type="button"
              aria-label="Backdrop"
              className="absolute inset-0 bg-black/45 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
              onClick={() => setOpen(false)}
            />

            <section
              className={`relative flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden md:border ${shellPanel} ${ambientSurface}`}
            >
              <InnerChrome
                brandMark={brandMark}
                brandLine={brandLine}
                titleLine={titleLine}
                funnel={funnel}
                variant={variant}
                busy={busy}
                lastError={lastError}
                counts={counts}
                pct={pct}
                phase={phase}
                progressFillTone={progressFillTone}
                labelTone={labelTone}
                progressNote={progressNote}
                loanProgram={loanProgram}
                sessionIdState={sessionIdState}
                onLoanProgram={(p) => setLoanProgram(p)}
                onClose={() => setOpen(false)}
                onReset={handleReset}
                onRetry={() => void postTick()}
                markBubble={markBubble}
                scrollerRef={scrollerRef}
                msgs={msgs}
                slots={slots}
                booked={booked}
                handleBook={handleBook}
                step={step}
                phaseForChips={phase}
                chipSlot={chipSlot}
                chipHover={chipHover}
                busyFlag={busy}
                submitAnswer={submitAnswer}
                inputKind={inputKind}
                draft={draft}
                setDraft={setDraft}
                ringFocus={ringFocus}
                sendGradient={sendGradient}
                closedFooter={closedFooter}
              />
            </section>
          </div>
        ) : (
          <section className={`relative mx-auto flex w-full max-w-lg flex-col overflow-hidden border md:border ${shellPanel} ${ambientSurface}`}>
            <InnerChrome
              brandMark={brandMark}
              brandLine={brandLine}
              titleLine={titleLine}
              funnel={funnel}
              variant={variant}
              busy={busy}
              lastError={lastError}
              counts={counts}
              pct={pct}
              phase={phase}
              progressFillTone={progressFillTone}
              labelTone={labelTone}
              progressNote={progressNote}
              loanProgram={loanProgram}
              sessionIdState={sessionIdState}
              onLoanProgram={(p) => setLoanProgram(p)}
              onClose={() => setOpen(false)}
              onReset={handleReset}
              onRetry={() => void postTick()}
              markBubble={markBubble}
              scrollerRef={scrollerRef}
              msgs={msgs}
              slots={slots}
              booked={booked}
              handleBook={handleBook}
              step={step}
              phaseForChips={phase}
              chipSlot={chipSlot}
              chipHover={chipHover}
              busyFlag={busy}
              submitAnswer={submitAnswer}
              inputKind={inputKind}
              draft={draft}
              setDraft={setDraft}
              ringFocus={ringFocus}
              sendGradient={sendGradient}
              closedFooter={closedFooter}
            />
          </section>
        )
      ) : null}
    </div>
  );
}

function InnerChrome(props: {
  brandMark: string;
  brandLine: string;
  titleLine: string;
  funnel: string;
  variant: IntakeVariant;
  busy: boolean;
  lastError: string | null;
  counts: { done: number; total: number };
  pct: number;
  phase: IntakeTickResponse["phase"];
  progressFillTone: string;
  labelTone: string;
  progressNote: string;
  loanProgram: LoanProgram;
  sessionIdState: string | null;
  onLoanProgram: (p: LoanProgram) => void;
  onClose: () => void;
  onReset: () => void;
  onRetry: () => void;
  markBubble: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  msgs: Bubble[];
  slots: NonNullable<IntakeTickResponse["slotPreview"]>;
  booked: BookedAppointment | null;
  handleBook: (startIso: string, loId: string) => Promise<void>;
  step: AssistantStep | null;
  phaseForChips: IntakeTickResponse["phase"];
  chipSlot: string;
  chipHover: string;
  busyFlag: boolean;
  submitAnswer: (field: AssistantStep, raw: string, label?: string) => Promise<void>;
  inputKind: string;
  draft: string;
  setDraft: (v: string) => void;
  ringFocus: string;
  sendGradient: string;
  closedFooter: string;
}) {
  const {
    brandMark,
    brandLine,
    titleLine,
    funnel,
    variant,
    busy,
    lastError,
    counts,
    pct,
    phase,
    progressFillTone,
    labelTone,
    progressNote,
    loanProgram,
    sessionIdState,
    onLoanProgram,
    onClose,
    onReset,
    onRetry,
    markBubble,
    scrollerRef,
    msgs,
    slots,
    booked,
    handleBook,
    step,
    phaseForChips,
    chipSlot,
    chipHover,
    busyFlag,
    submitAnswer,
    inputKind,
    draft,
    setDraft,
    ringFocus,
    sendGradient,
    closedFooter,
  } = props;

  return (
    <>
      <header className="border-b border-slate-100 px-5 pb-4 pt-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${markBubble}`}>
            {brandMark}
          </div>

          <div className="flex-1 space-y-1">
            <p className={labelTone}>{brandLine}</p>
            <h2 className="text-xl font-semibold text-slate-950">{titleLine}</h2>
            <p className="text-sm text-slate-600">{funnel}</p>
          </div>

          <div className="flex flex-col gap-2 text-[11px] text-slate-500">
            {variant === "fab" ? (
              <button
                type="button"
                className="rounded-full px-3 py-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                onClick={onClose}
              >
                Close
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full px-3 py-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
              onClick={onReset}
              disabled={busy}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <div className={`flex items-center justify-between ${labelTone}`}>
            <span>Progress</span>
            <span>
              {counts.done}/{counts.total} · {pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${progressFillTone}`}
              style={{ width: `${Math.max(6, Math.min(100, pct))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">{progressNote}</p>
        </div>

        <label className={`mt-4 block ${labelTone}`}>
          Program lane
          <select
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner disabled:opacity-55"
            value={loanProgram}
            disabled={Boolean(sessionIdState) || busy}
            onChange={(evt) => onLoanProgram(evt.target.value as LoanProgram)}
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
        {msgs.length === 0 && !lastError && (busy || !step) ? <IntakeSkeleton /> : null}

        {lastError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">The intake assistant paused.</p>
            <p className="mt-1 text-amber-900/80">{lastError}</p>
            <button
              type="button"
              className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:translate-y-0 disabled:opacity-50"
              onClick={onRetry}
              disabled={busy}
            >
              {busy ? "Retrying…" : "Retry intake"}
            </button>
          </div>
        ) : null}

        {msgs.map((bubble) => (
          <article
            key={bubble.id}
            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap transition ${
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
            <p className={labelTone}>Appointment rail</p>
            <div className="flex flex-wrap gap-2">
              {(slots ?? []).map((slot) => (
                <button
                  key={`${slot.loId}-${slot.start}`}
                  type="button"
                  disabled={busyFlag || Boolean(booked)}
                  onClick={() => void handleBook(slot.start, slot.loId)}
                  className={`rounded-full border bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-xs transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 ${chipSlot}`}
                >
                  {slotPretty(slot.start)}
                </button>
              ))}
            </div>
            {booked ? (
              <div className="space-y-1 text-xs text-emerald-700">
                <p>Consultation confirmed through {booked.provider ?? "YPN USA"}.</p>
                {booked.meetingUrl || booked.externalBookingUrl ? (
                  <a
                    className="font-semibold underline underline-offset-2"
                    href={booked.meetingUrl ?? booked.externalBookingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {booked.meetingUrl ? "Open meeting link" : "Continue in calendar"}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step?.chips && step.kind !== "number" ? (
          <div className="flex flex-wrap gap-2">
            {step.chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                disabled={busyFlag || phaseForChips === "crm_synced"}
                className={`rounded-full border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 shadow-xs transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 ${chipHover}`}
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
              disabled={busyFlag || !step}
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
              className={`flex-1 rounded-2xl border bg-white/90 px-3 py-2 text-sm ${ringFocus}`}
              placeholder={step?.placeholder ?? "Answer the LOS AI"}
            />
            <button
              type="button"
              disabled={busyFlag || !step}
              onClick={() => step && submitAnswer(step, draft)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-35 ${sendGradient}`}
            >
              {busyFlag ? "Sending…" : "Send"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">{closedFooter}</p>
        )}
      </footer>
    </>
  );
}

function IntakeSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading intake assistant">
      <div className="max-w-[88%] animate-pulse rounded-2xl rounded-bl-[6px] bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <div className="h-3 w-32 rounded-full bg-slate-200" />
        <div className="mt-3 h-3 w-full rounded-full bg-slate-100" />
        <div className="mt-2 h-3 w-4/5 rounded-full bg-slate-100" />
      </div>
      <div className="ml-auto h-10 w-28 animate-pulse rounded-2xl rounded-br-[6px] bg-slate-200" />
    </div>
  );
}

export function LoanPilotFloatingIntake(props: { funnelSource?: string }) {
  return <MortgageIntakeChat brand="loanpilot" variant="fab" funnelSource={props.funnelSource} />;
}

export function YpnEmbedIntake(props: { funnelSource?: string }) {
  return <MortgageIntakeChat brand="ypn" variant="embed" funnelSource={props.funnelSource} />;
}
