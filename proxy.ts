import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const rotasProtegidas = ["/painel/pedidos", "/painel/kds", "/painel/dashboard"];
  const pathname = req.nextUrl.pathname;

  const ehRotaProtegida = rotasProtegidas.some((rota) => pathname.startsWith(rota));

  if (ehRotaProtegida) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/painel/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/pedidos/:path*", "/painel/kds/:path*", "/painel/dashboard/:path*"],
};
