import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase-web";

export async function getWebSession() {
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll()  { return cookieStore.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(function ({ name, value, options }) {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
          });
        } catch {
          // cookieStore read-only em Server Components — token será refreshado na próxima requisição
        }
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return { user: null, cliente: null };

  const cliente = await prisma.cliente.findUnique({ where: { supabaseUserId: user.id } });

  return { user, cliente };
}
