import { NextRequest, NextResponse } from "next/server";

const PUBLIC = new Set(["/login", "/signup"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (process.env.DEMO_MODE === "1") {
    return NextResponse.next();
  }
  if (PUBLIC.has(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  // Better Auth uses `${cookiePrefix}.session_token` (or its secure variant).
  // We do a coarse cookie-presence check here; getSession does full validation later.
  const cookies = req.cookies.getAll();
  const hasSession = cookies.some(
    (c) =>
      c.name === "fold.session_token" ||
      c.name === "__Secure-fold.session_token" ||
      c.name === "fold-session_token"
  );
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
