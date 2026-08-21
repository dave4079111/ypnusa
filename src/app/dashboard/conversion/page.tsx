import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { ConversionInsightsPanel } from "@/components/intelligence/conversion-insights-panel";

export const metadata: Metadata = {
  title: "Conversion Insights",
  robots: { index: false, follow: false },
};

export default async function ConversionDashboardPage() {
  await requireSession("/dashboard/conversion");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Conversion insights"
      description="ZIP demand, life-event likelihood, and CTA output from the personalization and CTA engines that power the homepage territory claim flow."
    >
      <ConversionInsightsPanel />
    </DashboardShell>
  );
}
