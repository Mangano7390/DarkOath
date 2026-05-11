// In-memory token bucket per user. Swap for Upstash/Redis in prod multi-instance.
type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();

const RATE = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 30);
const INTERVAL_MS = 60_000;

export function rateLimit(key: string, limit = RATE): { ok: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: limit, lastRefill: now };
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const refill = (elapsed / INTERVAL_MS) * limit;
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return { ok: true, remaining: Math.floor(bucket.tokens), resetMs: INTERVAL_MS };
  }
  buckets.set(key, bucket);
  return { ok: false, remaining: 0, resetMs: INTERVAL_MS - elapsed };
}
