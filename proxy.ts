import { getToken } from "next-auth/jwt";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-web";

const PAINEL_PREFIXES = ["/dashboard", "/pedidos", "/kds", "/admin", "/clientes", "/caixa"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas sempre públicas
  if (
    pathname.startsWith("/instalar") ||
    pathname === "/fila" ||
    pathname === "/diagnostico"
  ) {
    return NextResponse.next();
  }

  // ── Rotas web do cliente (/web/*) → Supabase Auth ──────────────────────
  if (pathname.startsWith("/web")) {
    if (pathname === "/web/login") return NextResponse.next();

    let response = NextResponse.next({ request: req });

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(function ({ name, value }) { req.cookies.set(name, value); });
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(function ({ name, value, options }) {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    });

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/web/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    return response;
  }

  // ── Rotas do painel operacional → NextAuth JWT ──────────────────────────
  const isProtected = PAINEL_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

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
    "/clientes/:path*",
    "/caixa/:path*",
    "/web/:path*",
  ],
};
