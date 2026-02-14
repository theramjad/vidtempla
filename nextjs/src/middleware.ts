import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Check authentication for dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    // Better Auth stores the session token in this cookie
    const sessionToken = request.cookies.get("better-auth.session_token");

    if (!sessionToken) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set(
        "returnTo",
        encodeURIComponent(request.nextUrl.pathname)
      );
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
