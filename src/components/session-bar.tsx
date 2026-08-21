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
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Session lookup failed with HTTP ${response.status}.`);
        }
        return (await response.json()) as { session: SessionInfo | null };
      })
      .then((body) => {
        if (!cancelled) setSession(body.session ?? null);
      })
      .catch((error: unknown) => {
        console.error("[session-bar] Could not load the current session.", error);
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Logout failed with HTTP ${response.status}.`);
      }
    } catch (error) {
      // Still send the user to /login: the cookie may already be cleared, and the
      // login page re-checks the session either way.
      console.error("[session-bar] Logout request failed.", error);
    }
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
