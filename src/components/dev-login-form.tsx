"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DevLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"mlo" | "admin">("mlo");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Dev login failed.");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-2xl border border-dashed border-amber-400/60 bg-amber-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
        Dev-only session (disabled in production)
      </p>
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
      <select
        value={role}
        onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "mlo")}
        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
      >
        <option value="mlo">MLO</option>
        <option value="admin">Admin</option>
      </select>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in for local testing"}
      </button>
    </form>
  );
}
