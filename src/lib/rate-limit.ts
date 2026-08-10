/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Process-scoped (per instance) — enough to blunt casual abuse / accidental
 * double-submits of the write endpoints on a single Node host. For a
 * multi-instance production deployment, back this with a shared store (Redis,
 * Upstash, etc.).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000;
  const safeKey = key.trim() || "unknown";

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    while (buckets.size > 5000) {
      const oldest = buckets.keys().next().value;
      if (typeof oldest !== "string") break;
      buckets.delete(oldest);
    }
  }

  const existing = buckets.get(safeKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(safeKey, { count: 1, resetAt: now + safeWindowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (existing.count >= safeLimit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}

export async function distributedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!endpoint || !token) {
    return process.env.NODE_ENV === "production"
      ? { ok: false, retryAfter: 60 }
      : rateLimit(key, limit, windowMs);
  }

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000;
  const redisKey = `ypnus:rate:${key.trim() || "unknown"}`;
  try {
    const response = await fetch(`${endpoint}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, safeWindowMs, "NX"],
        ["PTTL", redisKey],
      ]),
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`Rate-limit store returned ${response.status}.`);
    const result = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(result[0]?.result);
    const ttl = Number(result[2]?.result);
    if (!Number.isFinite(count)) throw new Error("Rate-limit store returned an invalid count.");
    return {
      ok: count <= safeLimit,
      retryAfter: count <= safeLimit ? 0 : Math.max(1, Math.ceil(ttl / 1000)),
    };
  } catch (error) {
    console.error("[rate-limit] Shared limiter unavailable", error);
    return { ok: false, retryAfter: Math.ceil(safeWindowMs / 1000) };
  }
}

/** Best-effort client identifier from proxy headers. */
export function clientKey(request: Request): string {
  const mode = process.env.TRUSTED_PROXY_MODE?.trim().toLowerCase();
  if (mode === "cloudflare") {
    return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  }
  if (mode === "hostinger" || mode === "render") {
    const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return first || request.headers.get("x-real-ip")?.trim() || "unknown";
  }
  if (process.env.NODE_ENV !== "production") {
    const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
    if (cloudflare) return cloudflare;
    const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (first) return first;
    return request.headers.get("x-real-ip")?.trim() || "unknown";
  }
  return "unknown";
}
