import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { FunnelBuilderPanel } from "@/components/intelligence/funnel-builder-panel";

export const metadata: Metadata = {
  title: "Funnel Builder",
  robots: { index: false, follow: false },
};

export default async function FunnelsDashboardPage() {
  await requireSession("/dashboard/funnels");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Funnel builder"
      description="Turn a single content pattern into a full funnel: landing page JSON, a 3-step email sequence, social posts, a GMB post, and CTA blocks."
    >
      <FunnelBuilderPanel />
    </DashboardShell>
  );
}
