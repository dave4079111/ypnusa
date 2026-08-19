import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { TerritoryPanel } from "@/components/intelligence/territory-panel";

export const metadata: Metadata = {
  title: "Territory Intelligence",
  robots: { index: false, follow: false },
};

export default async function TerritoriesDashboardPage() {
  await requireSession("/dashboard/territories");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Territory intelligence"
      description="ZIP-level availability, opportunity scoring, and plain-language explanations, powered by the same territory logic behind the live ZIP checker."
    >
      <TerritoryPanel />
    </DashboardShell>
  );
}
