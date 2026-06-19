import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import CanaisClient from "./CanaisClient";

const CANAIS_PADRAO = [
  { id: "canal-totem",    nome: "Totem",     tipo: "interno",          ativo: true  },
  { id: "canal-mesa",     nome: "Mesa",      tipo: "interno",          ativo: true  },
  { id: "canal-ifood",    nome: "iFood",     tipo: "delivery_externo", ativo: false },
  { id: "canal-99food",   nome: "99Food",    tipo: "delivery_externo", ativo: false },
  { id: "canal-ubereats", nome: "Uber Eats", tipo: "delivery_externo", ativo: false },
];

export default async function CanaisPage() {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) redirect("/login");

  let canais = await prisma.canalVenda.findMany({ orderBy: { criadoEm: "asc" } });

  if (canais.length === 0) {
    await prisma.canalVenda.createMany({ data: CANAIS_PADRAO, skipDuplicates: true });
    canais = await prisma.canalVenda.findMany({ orderBy: { criadoEm: "asc" } });
  }

  return <CanaisClient canais={canais} />;
}
