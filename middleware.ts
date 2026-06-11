import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ROTAS_PROTEGIDAS = ["/pedidos", "/kds", "/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/pedidos", req.url));
  }

  const ehProtegida = ROTAS_PROTEGIDAS.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  if (ehProtegida && !token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token && ehProtegida) {
    const perfil = token.perfil as string;

    if ((pathname === "/admin" || pathname.startsWith("/admin/")) && perfil !== "ADMIN") {
      return NextResponse.redirect(new URL("/pedidos", req.url));
    }

    if (
      pathname.startsWith("/dashboard") &&
      perfil !== "ADMIN" &&
      perfil !== "GERENTE"
    ) {
      return NextResponse.redirect(new URL("/pedidos", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/pedidos/:path*",
    "/kds/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};
