import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { LifeEventPanel } from "@/components/intelligence/life-event-panel";

export const metadata: Metadata = {
  title: "Life-Event Intelligence",
  robots: { index: false, follow: false },
};

export default async function LifeEventsDashboardPage() {
  await requireSession("/dashboard/life-events");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Life-event intelligence"
      description="Rule-based lead scoring across rental demand, census signals, and county-level life events — divorce, marriage, probate, and migration."
    >
      <LifeEventPanel />
    </DashboardShell>
  );
}
