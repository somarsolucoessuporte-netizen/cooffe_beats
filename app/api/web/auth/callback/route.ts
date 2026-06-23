import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-web";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/web/cardapio";
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/web/login?erro=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/web/login`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll()  { return cookieStore.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        cookiesToSet.forEach(function ({ name, value, options }) {
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
        });
      },
    },
  });

  const { data, error: trocaErro } = await supabase.auth.exchangeCodeForSession(code);

  if (trocaErro || !data.session) {
    return NextResponse.redirect(`${origin}/web/login`);
  }

  const user = data.session.user;
  const supabaseUserId = user.id;
  const nomeGoogle     = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário";
  const wppGoogle      = user.user_metadata?.whatsapp as string | undefined;

  try {
    // Tenta encontrar cliente por supabaseUserId
    const existente = await prisma.cliente.findUnique({ where: { supabaseUserId } });

    if (existente) {
      // Retornou → atualiza visita
      await prisma.cliente.update({
        where: { id: existente.id },
        data: { ultimaVisita: new Date(), totalVisitas: { increment: 1 } },
      });
    } else {
      // Primeiro acesso Google → cria com whatsapp opcional
      await prisma.cliente.upsert({
        where: { supabaseUserId },
        create: {
          empresaId: EMPRESA_ID,
          nome:      nomeGoogle,
          whatsapp:  wppGoogle ?? null,
          supabaseUserId,
        },
        update: {
          ultimaVisita: new Date(),
          totalVisitas: { increment: 1 },
        },
      });
    }
  } catch {
    // Falha no upsert não bloqueia o login — o cliente acessa o sistema mesmo assim
  }

  return NextResponse.redirect(`${origin}${next}`);
}
