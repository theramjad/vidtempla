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

    // Redirect authenticated users to org resolver.
    // Org pages live at /org/[slug]/dashboard/youtube, so preserve the full
    // path as returnTo instead of stripping the /dashboard/ prefix.
    const url = request.nextUrl.clone();
    const rel = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    const subPath = rel === "" || rel === "dashboard" ? "dashboard/youtube" : rel;
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
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
