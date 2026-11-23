import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import CentralChamados from "@/components/chamados/CentralChamados";

export const dynamic = "force-dynamic";

/** Painel da Somar: só o perfil SOMAR. (A API também exige o perfil: esta checagem só evita mostrar a tela.) */
export default async function SomarChamadosPage() {
  const session = await getServerSession(authOptions);
  const perfil = (session?.user as { perfil?: string } | undefined)?.perfil;
  if (perfil !== "SOMAR") redirect("/suporte");
  return <CentralChamados modo="somar" />;
}
