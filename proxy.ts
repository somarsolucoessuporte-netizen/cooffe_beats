import { getToken } from "next-auth/jwt";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-web";

// ── Rotas do painel operacional (staff, NextAuth JWT) ─────────────────────
const PAINEL_PREFIXES = ["/dashboard", "/pedidos", "/kds", "/admin", "/clientes", "/caixa"];

// ── Rotas do totem → equivalente web (para redirecionar clientes web) ──────
// Se um usuário com sessão Supabase acessar uma rota do totem,
// é redirecionado para a rota equivalente no portal web.
const TOTEM_PARA_WEB: [prefix: string, webRoute: string][] = [
  ["/identificacao", "/web/login"],
  ["/cardapio",      "/web/cardapio"],
  ["/produto",       "/web/cardapio"],
  ["/carrinho",      "/web/carrinho"],
  ["/pagamento",     "/web/carrinho"],
  ["/confirmacao",   "/web/conta"],
  ["/mesa",          "/web/comanda"],
  ["/agendar",       "/web/reservas"],
];

// Domínios de origem do site marketing (para roteamento inteligente da raiz)
// Configure com NEXT_PUBLIC_WEB_ORIGINS="coffeebeats.com.br,somar.ia.br"
const WEB_ORIGINS = (process.env.NEXT_PUBLIC_WEB_ORIGINS ?? "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

// ── Helper: verifica sessão Supabase a partir dos cookies da requisição ────
// Usa getSession() (leitura local de cookie, sem chamada ao servidor Supabase)
// para manter o proxy rápido.
async function getSupabaseSession(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        cookiesToSet.forEach(function ({ name, value }) { req.cookies.set(name, value); });
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(function ({ name, value, options }) {
          res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
        });
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();
  return { session, res };
}

// ── Helper: verifica se o acesso vem de um contexto web externo ───────────
// Retorna true se: Referer está em WEB_ORIGINS OU host não é local
function isWebContext(req: NextRequest): boolean {
  const referer = req.headers.get("referer") ?? "";
  const host    = req.headers.get("host")    ?? "";

  if (WEB_ORIGINS.length > 0 && referer) {
    if (WEB_ORIGINS.some((d) => referer.includes(d))) return true;
  }

  // Host local = totem (localhost, IP 192.168.x.x, 10.x.x.x, 172.x.x.x)
  const isLocal =
    host.includes("localhost") ||
    /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host);

  return !isLocal;
}

// ═══════════════════════════════════════════════════════════════════════════
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Rotas sempre públicas ─────────────────────────────────────────────
  if (
    pathname.startsWith("/instalar") ||
    pathname === "/fila"             ||
    pathname === "/diagnostico"
  ) {
    return NextResponse.next();
  }

  // ── 2. Rotas do portal web do cliente (/web/*) → Supabase Auth ───────────
  if (pathname.startsWith("/web")) {
    // Páginas públicas do portal web (não precisam de sessão)
    if (pathname === "/web/login" || pathname === "/web/termos") {
      return NextResponse.next();
    }

    const { session, res } = await getSupabaseSession(req);

    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/web/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    return res; // passa com cookies de sessão atualizados
  }

  // ── 3. Rota raiz / → roteamento inteligente ──────────────────────────────
  // Prioridade:
  //   a) Sessão Supabase ativa → cliente web logado → /web/cardapio
  //   b) Acesso vindo de contexto web externo → /web/login
  //   c) Acesso direto sem sessão (totem físico) → comportamento atual
  if (pathname === "/") {
    const { session } = await getSupabaseSession(req);

    if (session) {
      return NextResponse.redirect(new URL("/web/cardapio", req.url));
    }

    if (isWebContext(req)) {
      return NextResponse.redirect(new URL("/web/login", req.url));
    }

    return NextResponse.next(); // totem
  }

  // ── 4. Rotas do totem → bloquear clientes web logados ─────────────────────
  // Um usuário com sessão Supabase que tenta acessar uma rota do totem
  // é redirecionado para a rota equivalente no portal web.
  const totemEntry = TOTEM_PARA_WEB.find(([prefix]) => pathname.startsWith(prefix));
  if (totemEntry) {
    const { session } = await getSupabaseSession(req);
    if (session) {
      return NextResponse.redirect(new URL(totemEntry[1], req.url));
    }
    return NextResponse.next(); // totem físico sem sessão → passa normalmente
  }

  // ── 5. Rotas do painel operacional → NextAuth JWT (staff) ─────────────────
  // Clientes web NÃO têm token NextAuth, portanto nunca passam aqui.
  const isPainel = PAINEL_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPainel) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login"; // login do painel (rota do NextAuth)
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Portal web do cliente
    "/web/:path*",
    // Raiz do totem (roteamento inteligente)
    "/",
    // Rotas do totem que precisam de proteção contra clientes web
    "/identificacao",
    "/cardapio",
    "/produto/:path*",
    "/carrinho",
    "/pagamento",
    "/confirmacao",
    "/mesa/:path*",
    "/agendar",
    // Painel operacional (staff)
    "/dashboard/:path*",
    "/pedidos/:path*",
    "/kds/:path*",
    "/admin/:path*",
    "/clientes/:path*",
    "/caixa/:path*",
  ],
};
