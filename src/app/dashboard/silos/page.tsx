import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { SiloOverviewPanel } from "@/components/intelligence/silo-overview-panel";

export const metadata: Metadata = {
  title: "Content Silos",
  robots: { index: false, follow: false },
};

export default async function SilosDashboardPage() {
  await requireSession("/dashboard/silos");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Content silos"
      description="Ingested patterns classified into Life Events, Predictive Intelligence, Tools, or Guides, each with a recommended funnel type and landing-page structure."
    >
      <SiloOverviewPanel />
    </DashboardShell>
  );
}
