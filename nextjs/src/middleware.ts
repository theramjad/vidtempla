import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Check authentication for dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    return await updateSession(request);
  }

  // For all other routes, just continue without auth check
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
