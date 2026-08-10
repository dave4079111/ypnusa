import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

interface BookingCapability {
  borrowerLeadId: string;
  loId: string;
  exp: number;
  nonce: string;
}

function secret(): string | null {
  const value = process.env.BOOKING_TOKEN_SECRET?.trim();
  return value && Buffer.byteLength(value) >= 32 ? value : null;
}

export function createBookingToken(
  borrowerLeadId: string,
  loId: string,
  now = Date.now(),
): string | undefined {
  const signingSecret = secret();
  if (!signingSecret) return undefined;
  const payload: BookingCapability = {
    borrowerLeadId,
    loId,
    exp: Math.floor(now / 1000) + 30 * 60,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyBookingToken(
  token: string | undefined,
  borrowerLeadId: string,
  loId: string,
  now = Date.now(),
): boolean {
  const signingSecret = secret();
  if (!signingSecret || !token || token.length > 2_048) return false;
  const segments = token.split(".");
  if (segments.length !== 2) return false;
  const [encoded, supplied] = segments;
  const expected = createHmac("sha256", signingSecret).update(encoded).digest();
  const candidate = Buffer.from(supplied, "base64url");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    return false;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as BookingCapability;
    return (
      payload.borrowerLeadId === borrowerLeadId &&
      payload.loId === loId &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(now / 1000) &&
      typeof payload.nonce === "string" &&
      payload.nonce.length >= 16
    );
  } catch {
    return false;
  }
}
