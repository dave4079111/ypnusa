import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { ContentGeneratorPanel } from "@/components/intelligence/content-generator-panel";

export const metadata: Metadata = {
  title: "Content Intelligence",
  robots: { index: false, follow: false },
};

export default async function IntelligenceDashboardPage() {
  await requireSession("/dashboard/intelligence");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Content generators"
      description="Deterministic, template-based marketing copy, Google Business Profile content, and website page specs — no external API calls."
    >
      <ContentGeneratorPanel />
    </DashboardShell>
  );
}
