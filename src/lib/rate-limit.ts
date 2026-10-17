export const RATE_LIMIT_MAX = 5;
export const RATE_WINDOW_MS = 30 * 60 * 1000;
export const GLOBAL_RATE_LIMIT_MAX = 60;
export const GLOBAL_RATE_WINDOW_MS = 60 * 60 * 1000;

type Bucket = number[];

const buckets = new Map<string, Bucket>();
const globalHits: Bucket = [];

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number; scope: "ip" | "global" };

function prune(bucket: Bucket, now: number, windowMs: number) {
  while (bucket.length > 0 && now - bucket[0] >= windowMs) bucket.shift();
}

export function checkRateLimit(ip: string, now = Date.now()): RateLimitResult {
  const key = ip.trim().slice(0, 80) || "unknown";
  const bucket = buckets.get(key) ?? [];
  prune(bucket, now, RATE_WINDOW_MS);
  prune(globalHits, now, GLOBAL_RATE_WINDOW_MS);

  if (globalHits.length >= GLOBAL_RATE_LIMIT_MAX) {
    buckets.set(key, bucket);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((globalHits[0] + GLOBAL_RATE_WINDOW_MS - now) / 1000),
    );
    return { ok: false, retryAfterSec, scope: "global" };
  }

  if (bucket.length >= RATE_LIMIT_MAX) {
    buckets.set(key, bucket);
    const retryAfterSec = Math.max(1, Math.ceil((bucket[0] + RATE_WINDOW_MS - now) / 1000));
    return { ok: false, retryAfterSec, scope: "ip" };
  }

  bucket.push(now);
  globalHits.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

export function resetRateLimits() {
  buckets.clear();
  globalHits.length = 0;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}
