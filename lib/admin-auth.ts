import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

type Perfil = "ADMIN" | "GERENTE" | "BARISTA" | "ATENDENTE";

export async function getAdminSession(perfisPermitidos: Perfil[] = ["ADMIN"]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      erro: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
      empresaId: null as null,
      perfil: null as null,
    };
  }

  const user = session.user as { perfil?: string; empresaId?: string };
  const perfil = user.perfil as Perfil | undefined;
  const empresaId = user.empresaId;

  if (!perfil || !perfisPermitidos.includes(perfil)) {
    return {
      erro: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }),
      empresaId: null as null,
      perfil: null as null,
    };
  }

  return { erro: null, empresaId: empresaId!, perfil };
}
