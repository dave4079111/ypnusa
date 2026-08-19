import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { ContentIngestionPanel } from "@/components/intelligence/content-ingestion-panel";

export const metadata: Metadata = {
  title: "Content Ingestion",
  robots: { index: false, follow: false },
};

export default async function ContentDashboardPage() {
  await requireSession("/dashboard/content");

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="WordPress content ingestion"
      description="Turn raw ypnus.com HTML or Markdown into normalized patterns — headings, sections, CTAs, and offers — ready for silo classification and funnel generation."
    >
      <ContentIngestionPanel />
    </DashboardShell>
  );
}
