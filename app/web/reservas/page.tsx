import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import ReservasClient from "./ReservasClient";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export const dynamic = "force-dynamic";

export default async function WebReservas() {
  const { user, cliente } = await getWebSession();
  if (!user) redirect("/web/login");

  const mesas = await prisma.mesa.findMany({
    where:   { empresaId: EMPRESA_ID, ativo: true },
    orderBy: { numero: "asc" },
    select:  { id: true, numero: true, nome: true },
  });

  return (
    <ReservasClient
      clienteNome={cliente?.nome ?? (user.user_metadata?.full_name as string | undefined) ?? ""}
      clienteWhatsapp={cliente?.whatsapp ?? ""}
      mesas={mesas}
    />
  );
}
