"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app-error-boundary]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto flex max-w-2xl flex-col gap-6 rounded-3xl border border-cyan-400/25 bg-slate-900/90 p-8 shadow-2xl shadow-cyan-950/30">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          YPN USA
        </p>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-white">We hit a temporary snag.</h1>
          <p className="text-base leading-7 text-slate-300">
            Your app session is protected. Try again, or return to the dashboard in a moment.
          </p>
        </div>
        {error.digest ? (
          <p className="text-xs text-slate-500">Reference: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="w-fit rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
