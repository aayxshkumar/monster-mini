import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const cafeSlug = process.env.NEXT_PUBLIC_CAFE_SLUG;
    if (cafeSlug) {
      const url = request.nextUrl.clone();
      url.pathname = `/${cafeSlug}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
