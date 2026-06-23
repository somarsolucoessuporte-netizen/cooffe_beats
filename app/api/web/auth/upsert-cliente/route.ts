import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-web";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export async function POST(req: NextRequest) {
  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return erroResposta("Não autenticado", 401);
    }

    const body = await req.json() as { nome?: string; whatsapp?: string };
    const nome     = (body.nome ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário").trim();
    const whatsapp = body.whatsapp ?? user.user_metadata?.whatsapp ?? null;

    const cliente = await prisma.cliente.upsert({
      where: { supabaseUserId: user.id },
      create: {
        empresaId:     EMPRESA_ID,
        nome,
        whatsapp,
        supabaseUserId: user.id,
      },
      update: {
        nome,
        ...(whatsapp ? { whatsapp } : {}),
        ultimaVisita:  new Date(),
        totalVisitas:  { increment: 1 },
      },
    });

    return resposta({ id: cliente.id, nome: cliente.nome }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar cliente";
    return erroResposta(msg, 500);
  }
}
