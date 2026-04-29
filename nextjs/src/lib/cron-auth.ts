import crypto from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Verifies the `Authorization: Bearer <CRON_SECRET>` header on a cron-triggered
 * request using a constant-time comparison.
 *
 * Fails closed (returns 500) when `CRON_SECRET` is unset or empty, so a
 * misconfigured deploy cannot leave the route open to unauthenticated callers.
 *
 * Returns `null` when the request is authorized; otherwise returns the
 * `NextResponse` the caller should return.
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new NextResponse("Cron not configured", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const got = authHeader.slice("Bearer ".length);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return null;
}
