import { NextResponse } from "next/server";
import { appendAnalytics } from "@/lib/db";
import { generateId } from "@/lib/id";
import { appendDemoRequestWithTerritoryCheck, normalizeZip } from "@/lib/territory";
import type { DemoRequestRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }

  const name = str(body.name, 120);
  const workEmail = str(body.workEmail, 160);
  const company = str(body.company, 160);

  if (!name || !workEmail || !company) {
    return NextResponse.json(
      { ok: false, error: "Name, work email, and company are required." },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(workEmail)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid work email address." },
      { status: 400 },
    );
  }

  const zip = normalizeZip(body.zip);

  const record: DemoRequestRecord = {
    id: generateId("demo"),
    createdAt: new Date().toISOString(),
    name,
    workEmail,
    company,
    phone: str(body.phone, 40),
    role: str(body.role, 80),
    zip: zip || undefined,
    monthlyLeadVolume: str(body.monthlyLeadVolume, 40),
    message: str(body.message, 1000),
    source: str(body.source, 80) ?? "marketing_site",
    status: "new",
  };

  const territory = appendDemoRequestWithTerritoryCheck(record);

  appendAnalytics({
    type: "demo_requested",
    payload: {
      demoRequestId: record.id,
      company: record.company,
      zip: record.zip,
      territoryAvailable: territory?.available ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    id: record.id,
    territory: territory
      ? { zip: territory.zip, available: territory.available }
      : null,
    message:
      territory && !territory.available
        ? "We've logged your request and added you to the waitlist for that territory."
        : "You're in — a YPN USA specialist will reach out within one business day to activate your territory.",
  });
}
