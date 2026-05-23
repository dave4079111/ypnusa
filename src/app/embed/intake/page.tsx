import Link from "next/link";
import { YpnEmbedIntake } from "@/components/loanpilot-floating-assistant";

export default function EmbedIntakePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center gap-3 overflow-y-auto px-2 py-3 md:px-4 md:py-5">
      <nav aria-label="Embed page links" className="flex flex-wrap justify-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        <Link href="/" className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200 hover:text-teal-700">
          Conversion home
        </Link>
        <Link href="/analytics" className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200 hover:text-teal-700">
          Analytics
        </Link>
      </nav>
      <YpnEmbedIntake />
    </main>
  );
}
