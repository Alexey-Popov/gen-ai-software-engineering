/**
 * Next.js Middleware - Rate Limiter for all /api/ routes.
 *
 * Extracts client IP and applies sliding window rate limiting.
 * Returns 429 Too Many Requests if the rate limit is exceeded.
 */

import { NextRequest, NextResponse } from "next/server";
import { check, record } from "@/lib/rate-limiter";

export function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    (request as NextRequest & { ip?: string }).ip ||
    "unknown";

  const { allowed, remaining, resetAt } = check(ip);

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: "Too Many Requests" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetAt),
        },
      }
    );
  }

  // Record the request now that it's allowed
  record(ip);

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(remaining - 1));
  response.headers.set("X-RateLimit-Reset", String(resetAt));

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
