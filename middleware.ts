import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/pedidos", "/kds", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pedidos/:path*",
    "/kds/:path*",
    "/admin/:path*",
  ],
};
