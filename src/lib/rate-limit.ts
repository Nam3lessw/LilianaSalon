import { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * In-memory rate limiter per IP / token
 * @param req NextRequest
 * @param limit Max requests allowed in the window
 * @param windowMs Window duration in milliseconds (default 60 seconds)
 */
export function checkRateLimit(
  req: NextRequest,
  limit: number = 20,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; reset: number } {
  // Extract client IP from headers
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  const path = req.nextUrl.pathname;
  const key = `${ip}:${path}`;

  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, reset: Math.ceil((now + windowMs) / 1000) };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, reset: Math.ceil(current.resetTime / 1000) };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, reset: Math.ceil(current.resetTime / 1000) };
}
