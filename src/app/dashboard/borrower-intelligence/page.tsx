import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { BorrowerIntelligencePanel } from "@/components/intelligence/borrower-intelligence-panel";

export const metadata: Metadata = {
  title: "Borrower Intelligence",
  robots: { index: false, follow: false },
};

export default async function BorrowerIntelligenceDashboardPage() {
  await requireSession("/dashboard/borrower-intelligence");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Borrower intelligence"
      description="Borrower persona, intent, and confidence scoring alongside signup/insight-request/conversion/follow-up likelihood predictions."
    >
      <BorrowerIntelligencePanel />
    </DashboardShell>
  );
}
