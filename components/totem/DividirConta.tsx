"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemCarrinho } from "@/contexts/CarrinhoContext";
import { centavos, dividirIgualmente, DIVISAO_STORAGE } from "@/lib/dividir-conta/domain";
import { formatarMoeda } from "@/lib/utils";

type Resumo = { id: string; pedidoId: string; senha: string; total: number; pago: number; saldo: number; reservado: number; status: string; habilitada: boolean; parcelas: { id: string; ordem: number; valor: number; status: string; tentativas: { id: string; status: string }[] }[] };
type Sessao = { id?: string; token: string; request?: unknown };
class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const moeda = (c: number) => formatarMoeda(c / 100);
const estados: Record<string,string> = { CRIANDO: "Enviando à maquininha", PENDENTE: "Aguardando pagamento", DESCONHECIDO: "Aguardando confirmação", APROVADO: "Pago", RECUSADO: "Pagamento não aprovado", REVISAO: "Solicite ajuda ao atendente" };
function novoToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join(""); }
function novaChave() {
  // randomUUID is unavailable on some Sunmi WebViews; getRandomValues is older.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export default function DividirConta({ itens, total, onVoltar, onQuitada }: {
  itens: ItemCarrinho[]; total: number; onVoltar: () => void;
  onQuitada: (pedido: { id: string; senha: string; total: number }) => Promise<void>;
}) {
  const [pessoas, setPessoas] = useState(2);
  const [valores, setValores] = useState(() => dividirIgualmente(Math.round(total * 100) || 2, 2).map(v => (v / 100).toFixed(2)));
  const [conta, setConta] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const sessao = useRef<Sessao | null>(null);
  const cobrando = useRef(false);
  const falhaFinalizacao = useRef(false);
  const quitada = useRef(onQuitada);
  quitada.current = onQuitada;

  async function request(path: string, body?: unknown) {
    const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.current?.token ?? ""}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store" });
    const json = await res.json();
    if (!json.ok) throw new RequestError(json.error ?? "Não foi possível consultar a conta", res.status);
    return json.data as Resumo;
  }
  function guardar(s: Sessao) {
    // Persist BEFORE sending a charge/order. Without storage, fail closed.
    sessionStorage.setItem(DIVISAO_STORAGE, JSON.stringify(s));
    sessao.current = s;
  }
  async function atualizar() {
    const s = sessao.current;
    if (!s) return;
    const data = s.id ? await request(`/api/pagamentos/dividir/${s.id}`) : await request("/api/pagamentos/dividir", s.request);
    if (data.status === "CANCELADA") {
      sessionStorage.removeItem(DIVISAO_STORAGE); sessao.current = null; onVoltar();
      return data;
    }
    if (!s.id) guardar({ ...s, id: data.id });
    setConta(data);
    setErro("");
    return data;
  }
  function liberarCriacaoRecusada(e: unknown) {
    // Explicit validation/disabled response proves no draft was created. A timeout,
    // 409 or 5xx does not: keep the capability and recover the SAME operation.
    if (e instanceof RequestError && [400, 403].includes(e.status) && !sessao.current?.id) {
      sessionStorage.removeItem(DIVISAO_STORAGE);
      sessao.current = null;
    }
  }

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { if (sessao.current) await atualizar(); }
      catch (e) { liberarCriacaoRecusada(e); if (!stop) setErro(e instanceof Error ? e.message : "Falha de conexão. A conta permanece reservada."); }
      finally { if (!stop) { setPronto(true); timer = setTimeout(poll, 4000); } }
    }
    try {
      const saved = sessionStorage.getItem(DIVISAO_STORAGE);
      if (saved) sessao.current = JSON.parse(saved);
    } catch { setErro("Não foi possível recuperar a sessão. Solicite ajuda ao atendente."); }
    void poll();
    return () => { stop = true; clearTimeout(timer); };
  // The recursive timeout prevents overlapping status requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!conta || conta.status !== "QUITADA" || conta.saldo !== 0 || conta.reservado !== 0 || finalizando || falhaFinalizacao.current) return;
    setFinalizando(true);
    quitada.current({ id: conta.pedidoId, senha: conta.senha, total: conta.total / 100 })
      .then(() => { sessionStorage.removeItem(DIVISAO_STORAGE); })
      .catch(() => { falhaFinalizacao.current = true; setErro("Conta quitada. Não foi possível abrir o comprovante; consulte o atendente."); setFinalizando(false); });
  }, [conta, finalizando]);

  async function iniciar() {
    if (cobrando.current) return;
    cobrando.current = true; setOcupado(true); setErro("");
    try {
      const valoresCentavos = valores.map(centavos);
      if (valoresCentavos.reduce((s, v) => s + v, 0) !== Math.round(total * 100)) throw new Error("A soma das parcelas deve ser igual ao total.");
      const body = { valores: valoresCentavos, itens: itens.map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade, observacao: i.observacao, adicionais: i.adicionais.map(a => ({ adicionalId: a.adicionalId })) })), clienteId: sessionStorage.getItem("clienteId") || undefined, mesaId: sessionStorage.getItem("mesaId") || undefined };
      guardar({ token: novoToken(), request: body });
      await atualizar();
    } catch (e) { liberarCriacaoRecusada(e); setErro(e instanceof Error ? e.message : "Não foi possível criar a divisão"); }
    finally { cobrando.current = false; setOcupado(false); }
  }

  async function pagar(parcelaId: string) {
    if (cobrando.current || !conta) return;
    cobrando.current = true; setOcupado(true); setErro("");
    try {
      const key = `cb_divisao_tentativa_${parcelaId}`;
      const parte = conta.parcelas.find(p => p.id === parcelaId)!;
      const ultima = parte.tentativas[parte.tentativas.length - 1];
      const anterior = sessionStorage.getItem(key);
      const saved = anterior ? JSON.parse(anterior) as { chave: string; ultima: string | null } : null;
      // A confirmed rejection permits a NEW operation; network errors reuse the key.
      const ultimaRecusada = ultima?.status === "RECUSADO" ? ultima.id : null;
      const chave = saved && saved.ultima === ultimaRecusada ? saved.chave : novaChave();
      sessionStorage.setItem(key, JSON.stringify({ chave, ultima: ultimaRecusada }));
      setConta(await request(`/api/pagamentos/dividir/${conta.id}/cobrar`, { parcelaId, chave }));
    } catch (e) { setErro(e instanceof Error ? e.message : "Consulte o estado da conta antes de tentar novamente."); }
    finally { cobrando.current = false; setOcupado(false); }
  }

  async function cancelar() {
    if (!conta || cobrando.current) return;
    cobrando.current=true; setOcupado(true);
    try {
      const res=await fetch(`/api/pagamentos/dividir/${conta.id}/cancelar`,{method:"POST",headers:{Authorization:`Bearer ${sessao.current?.token}`}});
      const json=await res.json(); if(!json.ok) throw new Error(json.error);
      sessionStorage.removeItem(DIVISAO_STORAGE); sessao.current=null; onVoltar();
    } catch(e) {setErro(e instanceof Error ? e.message : "Não foi possível cancelar");}
    finally {cobrando.current=false; setOcupado(false);}
  }

  const valorPendente = conta?.parcelas.some(p => p.tentativas.some(t => ["CRIANDO", "PENDENTE", "DESCONHECIDO"].includes(t.status)));
  return <section className="flex-1 overflow-y-auto p-5 flex flex-col items-center gap-5" aria-label="Dividir conta">
    <h1 className="text-3xl font-extrabold text-cb-marrom">Dividir conta</h1>
    {!pronto ? <p>Recuperando conta…</p> : conta ? <>
      <dl className="w-full max-w-xl grid grid-cols-2 gap-3 bg-white rounded-2xl p-5 text-cb-marrom" aria-live="polite">
        <dt>Total da conta</dt><dd className="text-right font-bold">{moeda(conta.total)}</dd>
        <dt>Já pago</dt><dd className="text-right font-bold">{moeda(conta.pago)}</dd>
        <dt>Em processamento</dt><dd className="text-right">{moeda(conta.reservado)}</dd>
        <dt>Saldo restante</dt><dd className="text-right font-extrabold">{moeda(conta.saldo)}</dd>
      </dl>
      {!conta.habilitada && <p>Novas cobranças desativadas. Pagamentos iniciados continuam sendo acompanhados.</p>}
      {conta.status === "REVISAO" && <p role="alert">Conta em revisão. Não efetue outro pagamento; chame o atendente.</p>}
      <ol className="w-full max-w-xl flex flex-col gap-3">
        {conta.parcelas.map(p => {
          const ultima = p.tentativas[p.tentativas.length - 1];
          const estado = p.status === "APROVADO" ? "Pago" : estados[ultima?.status ?? ""] ?? "A pagar";
          return <li key={p.id} className="bg-white rounded-xl p-4 flex items-center justify-between gap-3">
            <div><p className="font-bold">Pessoa {p.ordem} · {moeda(p.valor)}</p><p className="text-sm" aria-live="polite">{estado}</p>{ultima?.status === "DESCONHECIDO" && <p className="text-sm">Aguardando confirmação. Não repita o pagamento.</p>}</div>
            {p.status === "ABERTA" && <button className="bg-cb-marrom text-white rounded-xl px-5 py-3 disabled:opacity-40" disabled={ocupado || valorPendente || !conta.habilitada || conta.status !== "ABERTA"} onClick={() => pagar(p.id)}>Pagar parcela</button>}
          </li>;
        })}
      </ol>
      {conta.status === "ABERTA" && conta.parcelas.every(p=>p.tentativas.length===0) && <button disabled={ocupado} onClick={cancelar} className="border rounded-xl px-6 py-3">Cancelar divisão e voltar</button>}
      <p className="text-sm text-cb-marrom/70">A conta só será concluída após todas as confirmações. Mantenha esta sessão aberta; ela permite recuperar o acompanhamento.</p>
    </> : sessao.current ? <p>A criação está sendo recuperada com a mesma chave. Não inicie um pagamento integral.</p> : <>
      <p className="text-xl">Total: <strong>{formatarMoeda(total)}</strong></p>
      <label className="flex items-center gap-3">Quantidade de pessoas
        <select value={pessoas} className="p-3 rounded-xl border" onChange={e => { const n = Number(e.target.value); setPessoas(n); setValores(dividirIgualmente(Math.round(total * 100), n).map(v => (v / 100).toFixed(2))); }}>
          {Array.from({ length: Math.min(20, Math.round(total * 100)) - 1 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="w-full max-w-md flex flex-col gap-3">{valores.map((v, i) => <label key={i} className="flex justify-between items-center gap-3">Pessoa {i + 1} (R$)<input aria-label={`Valor da pessoa ${i + 1}`} className="w-36 rounded-xl border p-3" inputMode="decimal" value={v} onChange={e => setValores(prev => prev.map((a, j) => j === i ? e.target.value : a))} /></label>)}</div>
      <button onClick={()=>setValores(dividirIgualmente(Math.round(total*100),pessoas).map(v=>(v/100).toFixed(2)))} className="text-cb-marrom underline">Dividir igualmente</button>
      <button disabled={ocupado || itens.length === 0} onClick={iniciar} className="bg-cb-marrom text-white font-bold rounded-xl px-8 py-4 disabled:opacity-40">{ocupado ? "Criando…" : "Confirmar divisão"}</button>
      <button onClick={onVoltar} className="border rounded-xl px-6 py-3">Voltar ao pagamento integral</button>
    </>}
    {erro && <p role="alert" className="max-w-xl text-red-700 bg-red-50 rounded-xl p-4">{erro}</p>}
    {finalizando && <p>Conta quitada. Abrindo confirmação…</p>}
  </section>;
}
