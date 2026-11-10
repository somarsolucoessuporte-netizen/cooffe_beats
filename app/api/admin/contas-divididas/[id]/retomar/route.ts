import { getAdminSession } from "@/lib/admin-auth";
import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tratar } from "@/lib/dividir-conta/http";

export async function POST(_req: Request, context: {params: Promise<{id:string}>}) {
  const {erro,empresaId}=await getAdminSession(["ADMIN","GERENTE"]);
  if(erro) return erro;
  return tratar(async()=>{
    const {id}=await context.params;
    // Rotate; never retrieve/reveal the original capability or place it in a URL.
    return respostaDivisao(await divisao.retomar(id,empresaId));
  });
}
