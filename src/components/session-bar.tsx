"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionInfo {
  email: string;
  role: "mlo" | "admin";
}

export function SessionBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((body: { session: SessionInfo | null }) => {
        if (!cancelled) setSession(body.session);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!session) return null;

  const isDark = tone === "dark";

  return (
    <div
      className={`flex items-center gap-3 text-xs font-medium ${isDark ? "text-white/60" : "text-slate-500"}`}
    >
      <span>
        Signed in as{" "}
        <span className={isDark ? "font-semibold text-white/90" : "font-semibold text-slate-700"}>
          {session.email}
        </span>
        {session.role === "admin" ? " · admin" : ""}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className={
          isDark
            ? "rounded-full border border-white/15 px-3 py-1 font-semibold text-white/80 transition hover:bg-white/10"
            : "rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
        }
      >
        Sign out
      </button>
    </div>
  );
}
