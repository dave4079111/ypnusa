import type { ReactNode } from "react";
import Link from "next/link";
import { SessionBar } from "@/components/session-bar";

export function DashboardShell({
  eyebrow,
  title,
  description,
  backHref = "/dashboard",
  backLabel = "Dashboard",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-full bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header>
          <div className="flex items-center justify-between">
            <Link href={backHref} className="text-sm font-semibold text-violet-700">
              ← {backLabel}
            </Link>
            <SessionBar />
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
        </header>

        <div className="mt-10 space-y-8">{children}</div>
      </div>
    </main>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-6 ${className}`}>
      {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function GenerateButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-full bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Working…" : children}
    </button>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
      {error}
    </p>
  );
}
