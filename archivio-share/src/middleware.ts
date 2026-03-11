import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isLogin = req.nextUrl.pathname === "/admin/login";
  if (isAdmin && !isLogin && !req.auth) {
    const url = new URL("/admin/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
