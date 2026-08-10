import Link from "next/link";
import { RevenueBreakdown } from "@/components/admin/revenue-breakdown";
import { summarizeRevenuePulse } from "@/lib/revenue";
import { requireAdminSession } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  await requireAdminSession();
  const revenue = summarizeRevenuePulse();

  return (
    <main className="min-h-full bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/analytics" className="font-semibold text-cyan-700 hover:text-teal-600">
            Back to telemetry
          </Link>
          <Link href="/" className="font-semibold text-slate-500 hover:text-slate-900">
            Homepage
          </Link>
        </nav>
        <RevenueBreakdown initialData={revenue} />
      </div>
    </main>
  );
}
