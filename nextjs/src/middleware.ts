import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect org-scoped routes
  if (pathname.startsWith("/org/")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Legacy dashboard routes → redirect to org resolve
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users to org resolver
    const url = request.nextUrl.clone();
    // Map /dashboard/youtube → youtube, /dashboard/api-keys → api-keys, etc.
    const subPath = pathname.replace(/^\/dashboard\/?/, "") || "dashboard/youtube";
    url.pathname = "/org/resolve";
    url.searchParams.set("returnTo", subPath);
    return NextResponse.redirect(url);
  }

  // Protect invite routes
  if (pathname.startsWith("/invite/")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
