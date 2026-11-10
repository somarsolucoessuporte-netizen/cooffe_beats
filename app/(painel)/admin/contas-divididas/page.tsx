"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIVISAO_STORAGE } from "@/lib/dividir-conta/domain";
import { formatarMoeda } from "@/lib/utils";

type Conta={id:string;senha:string;total:number;pago:number;status:string};
export default function ContasDivididas() {
  const router=useRouter();
  const [contas,setContas]=useState<Conta[]>([]);
  const [erro,setErro]=useState("");
  const [ocupado,setOcupado]=useState(false);
  const [leases,setLeases]=useState(0);
  const carregar=useCallback(async()=>{
    const r=await fetch("/api/admin/contas-divididas",{cache:"no-store"}); const d=await r.json();
    if(!d.ok) throw new Error(d.error ?? "Não foi possível consultar as contas");
    setContas(d.data.contas);setLeases(d.data.operacoesLegadasPendentes);
  },[]);
  useEffect(()=>{carregar().catch(e=>setErro(e.message));},[carregar]);
  async function executar(id?:string) {
    if(ocupado)return;setOcupado(true);setErro("");
    try {
      if(id && !window.confirm("Retomar neste aparelho? A sessão anterior deixará de ter acesso à conta. Nenhuma nova cobrança será criada.")) return;
      // Check storage before rotating the capability.
      if(id) {sessionStorage.setItem("cb_storage_check","1");sessionStorage.removeItem("cb_storage_check");}
      const r=await fetch(id?`/api/admin/contas-divididas/${id}/retomar`:"/api/admin/contas-divididas/recuperar",{method:"POST"});
      const d=await r.json();if(!d.ok)throw new Error(d.error ?? "Não foi possível recuperar");
      if(id){sessionStorage.setItem(DIVISAO_STORAGE,JSON.stringify(d.data));router.push("/pagamento");}
      else await carregar();
    } catch(e){setErro(e instanceof Error?e.message:"Não foi possível recuperar a conta");}
    finally{setOcupado(false);}
  }
  return <main className="max-w-3xl mx-auto p-6 flex flex-col gap-5 text-cb-marrom">
    <div><h1 className="text-2xl font-bold">Contas divididas</h1><p className="text-sm mt-2">Acompanhe saldos e retome uma conta quando o cliente perder a sessão.</p></div>
    <button disabled={ocupado} onClick={()=>executar()} className="self-start rounded-xl bg-cb-marrom text-white px-5 py-3 disabled:opacity-50">Consultar pagamentos pendentes</button>
    {erro&&<p role="alert" className="text-red-700 bg-red-50 p-4 rounded-xl">{erro}</p>}
    {leases>0&&<p role="alert">Há {leases} operação(ões) integrais que precisam de conferência antes de iniciar novas parcelas. Verifique a situação no Mercado Pago; não repita a cobrança.</p>}
    <ul className="flex flex-col gap-3">{contas.map(c=><li key={c.id} className="bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-bold">Pedido {c.senha}</p><p>Total {formatarMoeda(c.total/100)} · Recebido {formatarMoeda(c.pago/100)}</p><p className="text-sm">{c.status==="QUITADA"?"Quitada":c.status==="REVISAO"?"Precisa de conferência":c.status==="CANCELADA"?"Cancelada":"Em aberto"}</p></div>
      {c.status!=="CANCELADA"&&<button disabled={ocupado} onClick={()=>executar(c.id)} className="border border-cb-marrom rounded-xl px-4 py-3 disabled:opacity-50">Retomar acompanhamento</button>}
    </li>)}</ul>
    {contas.length===0&&!erro&&<p>Nenhuma divisão registrada.</p>}
  </main>;
}
