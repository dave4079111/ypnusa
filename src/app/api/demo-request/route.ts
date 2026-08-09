import { appendAnalytics } from "@/lib/db";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { generateId } from "@/lib/id";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { appendDemoRequestWithTerritoryCheck, isValidZip, normalizeZip } from "@/lib/territory";
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
  try {
    const limited = rateLimit(`demo:${clientKey(request)}`, 5, 60_000);
    if (!limited.ok) {
      return jsonError(
        "Too many requests — please slow down and try again shortly.",
        429,
        "RATE_LIMITED",
        { headers: { "Retry-After": String(limited.retryAfter) } },
      );
    }

    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400, parsed.code);
    }

    if (!isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const body = parsed.data;
    const name = str(body.name, 120);
    const workEmail = str(body.workEmail, 160);
    const company = str(body.company, 160);

    if (!name || !workEmail || !company) {
      return jsonError("Name, work email, and company are required.", 400, "MISSING_FIELDS");
    }

    if (!EMAIL_RE.test(workEmail)) {
      return jsonError("Enter a valid work email address.", 400, "INVALID_EMAIL");
    }

    const zip = normalizeZip(body.zip);
    if (zip && !isValidZip(zip)) {
      return jsonError("Enter a valid 5-digit ZIP code.", 400, "INVALID_ZIP");
    }

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

    return jsonOk({
      id: record.id,
      territory: territory
        ? { zip: territory.zip, available: territory.available }
        : null,
      message:
        territory && !territory.available
          ? "We've logged your request and added you to the waitlist for that territory."
          : "You're in — a YPN USA specialist will reach out within one business day to activate your territory.",
    });
  } catch (error) {
    logApiError("/api/demo-request", error);
    return jsonError("Demo request could not be saved.", 500, "DEMO_REQUEST_FAILED");
  }
}
