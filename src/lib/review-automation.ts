import { buildGoogleReviewUrl, type PublicBusinessProfile } from "./local-seo";

export interface ReviewRequestInput {
  closingId: string;
  customerFirstName?: string;
  destination?: string;
}

export interface ReviewRequestMessage {
  closingId: string;
  customerFirstName?: string;
  destination?: string;
  businessName: string;
  reviewUrl: string;
  message: string;
}

function cleanOptionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : undefined;
}

export function parseReviewRequestInput(payload: unknown): ReviewRequestInput | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const closingId = cleanOptionalString(record.closingId, 100);
  if (!closingId) return undefined;

  return {
    closingId,
    customerFirstName: cleanOptionalString(record.customerFirstName, 80),
    destination: cleanOptionalString(record.destination, 200),
  };
}

export function buildReviewRequestMessage(
  input: ReviewRequestInput,
  business: PublicBusinessProfile,
): ReviewRequestMessage | undefined {
  const reviewUrl = buildGoogleReviewUrl(business.placeId);
  if (!reviewUrl) return undefined;
  const greeting = input.customerFirstName ? `${input.customerFirstName}, thank` : "Thank";

  return {
    closingId: input.closingId,
    customerFirstName: input.customerFirstName,
    destination: input.destination,
    businessName: business.name,
    reviewUrl,
    message: `${greeting} you for trusting ${business.name} with your mortgage. If you would like to share an honest review, use this Google link: ${reviewUrl}`,
  };
}
