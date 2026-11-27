"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { dataHora, duracao, ms, NOME_PRIORIDADE, NOME_STATUS } from "@/lib/chamados-tempo";
import { diaSP, intervaloDias, somaDias } from "@/lib/fuso";

const MOTIVOS = [
  "Pagamento no cartão/maquininha", "Pix", "Dividir conta", "Fechamento de caixa", "Impressão/comanda", "Totem",
  "Site, reservas ou pedido online", "Cardápio/produtos", "Lentidão ou sistema fora do ar", "Dúvida de uso", "Sugestão de melhoria", "Outro",
];
const STATUS = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO", "FECHADO"];
const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

type Chamado = {
  id: string; numero: number; empresaNome?: string; usuarioNome: string; titulo: string; descricao: string; motivo: string;
  prioridade: string; status: string; abertoEm: string; primeiraRespostaEm: string | null; resolvidoEm: string | null; fechadoEm: string | null; reaberturas: number;
};
type Evento = { id: string; tipo: string; autorTipo: "CLIENTE" | "SOMAR"; autorNome: string; mensagem: string | null; valorAnterior: string | null; valorNovo: string | null; anexoNome: string | null; temAnexo: boolean; criadoEm: string };
type Indicadores = { abertos: number; novos: number; urgentes: number; primeiraRespostaSeg: number | null; solucaoSeg: number | null; porMotivo: { motivo: string; total: number }[]; porMes: { mes: string; total: number }[] };

const COR_PRIORIDADE: Record<string, string> = { BAIXA: "bg-gray-100 text-gray-700", MEDIA: "bg-blue-100 text-blue-700", ALTA: "bg-amber-100 text-amber-800", URGENTE: "bg-red-100 text-red-700" };
const COR_STATUS: Record<string, string> = { ABERTO: "bg-blue-100 text-blue-700", EM_ATENDIMENTO: "bg-purple-100 text-purple-700", AGUARDANDO_CLIENTE: "bg-amber-100 text-amber-800", RESOLVIDO: "bg-green-100 text-green-700", FECHADO: "bg-gray-200 text-gray-600" };
const numero = (n: number) => "#" + String(n).padStart(4, "0");

/** fetch com limite de 15 s e erro legível: nunca fica carregando para sempre. */
async function chamar(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const d = await r.json().catch(() => ({ ok: false, error: `Resposta inválida (HTTP ${r.status})` }));
    if (!d.ok) throw new Error(d.error ?? "Erro");
    return d.data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("O servidor demorou mais de 15 segundos. Tente novamente.");
    throw e instanceof Error ? e : new Error("Sem conexão");
  } finally { clearTimeout(t); }
}

function lerImagem(file: File): Promise<string> {
  return new Promise((ok, erro) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return erro(new Error("Envie uma imagem PNG, JPG ou WEBP."));
    if (file.size > 2 * 1024 * 1024) return erro(new Error("A imagem deve ter até 2 MB."));
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = () => erro(new Error("Não foi possível ler a imagem."));
    fr.readAsDataURL(file);
  });
}

export default function CentralChamados({ modo }: { modo: "cliente" | "somar" }) {
  const somar = modo === "somar";
  const { data: session } = useSession();
  const empresaId = (session?.user as { empresaId?: string } | undefined)?.empresaId;
  const [lista, setLista] = useState<Chamado[] | null>(null);
  const [erro, setErro] = useState("");
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [filtro, setFiltro] = useState({ status: "", motivo: "", periodo: "" });
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [, setTick] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (filtro.status) p.set("status", filtro.status);
      if (filtro.motivo) p.set("motivo", filtro.motivo);
      if (filtro.periodo) p.set("inicio", intervaloDias(somaDias(diaSP(), 1 - Number(filtro.periodo))).inicio.toISOString());
      setLista(await chamar("/api/chamados?" + p.toString()));
      if (somar) setInd(await chamar("/api/somar/chamados/indicadores"));
      setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar"); }
  }, [filtro, somar]);

  // Tempo real: broadcast do Supabase + atualização automática a cada 10 s (garantia)
  useEffect(() => {
    void carregar();
    const t = setInterval(carregar, 10000);
    const canal = somar ? "chamados-somar" : empresaId ? `chamados-empresa-${empresaId}` : null;
    const ch = canal ? supabase.channel(canal).on("broadcast", { event: "chamado:novo" }, carregar).on("broadcast", { event: "chamado:atualizado" }, carregar).subscribe() : null;
    return () => { clearInterval(t); if (ch) void supabase.removeChannel(ch); };
  }, [carregar, somar, empresaId]);

  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);

  const agora = Date.now();
  const tempoSolucao = (c: Chamado) => c.resolvidoEm ? duracao(ms(c.resolvidoEm)! - ms(c.abertoEm)!) : "—";
  const decorrido = (c: Chamado) => duracao((c.resolvidoEm && ["RESOLVIDO", "FECHADO"].includes(c.status) ? ms(c.resolvidoEm)! : agora) - ms(c.abertoEm)!);

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-cb-marrom">{somar ? "Central de Chamados — Somar" : "Suporte"}</h1>
          <p className="text-sm text-cb-marrom/60">{somar ? "Fila de todos os clientes, atualizada em tempo real." : "Abra chamados para a equipe da Somar e acompanhe o andamento."}</p>
        </div>
        {!somar && <button onClick={() => setNovo(true)} className="px-5 py-2.5 rounded-xl bg-cb-amber text-white font-bold text-sm hover:opacity-90">+ Abrir chamado</button>}
      </div>

      {somar && ind && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Abertos agora", String(ind.abertos)], ["Novos sem resposta", String(ind.novos)], ["Urgentes abertos", String(ind.urgentes)],
            ["Tempo médio 1ª resposta", ind.primeiraRespostaSeg == null ? "—" : duracao(ind.primeiraRespostaSeg * 1000)],
            ["Tempo médio de solução", ind.solucaoSeg == null ? "—" : duracao(ind.solucaoSeg * 1000)],
          ].map(([r, v]) => <div key={r} className="bg-white rounded-2xl border border-cb-marrom/10 p-4"><p className="text-xs text-cb-marrom/50">{r}</p><p className="text-xl font-bold text-cb-marrom">{v}</p></div>)}
          <div className="col-span-2 md:col-span-3 bg-white rounded-2xl border border-cb-marrom/10 p-4"><p className="text-xs text-cb-marrom/50 mb-1">Por motivo</p>
            {ind.porMotivo.length === 0 ? <p className="text-sm text-cb-marrom/40">Sem chamados.</p> : ind.porMotivo.map(m => <div key={m.motivo} className="flex justify-between text-sm"><span>{m.motivo}</span><b>{m.total}</b></div>)}</div>
          <div className="col-span-2 bg-white rounded-2xl border border-cb-marrom/10 p-4"><p className="text-xs text-cb-marrom/50 mb-1">Por mês</p>
            {ind.porMes.length === 0 ? <p className="text-sm text-cb-marrom/40">Sem chamados.</p> : ind.porMes.map(m => <div key={m.mes} className="flex justify-between text-sm"><span>{m.mes.slice(5)}/{m.mes.slice(0, 4)}</span><b>{m.total}</b></div>)}</div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <select value={filtro.status} onChange={e => setFiltro(f => ({ ...f, status: e.target.value }))} className="border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm bg-white">
          <option value="">Todos os status</option>{STATUS.map(s => <option key={s} value={s}>{NOME_STATUS[s]}</option>)}</select>
        <select value={filtro.motivo} onChange={e => setFiltro(f => ({ ...f, motivo: e.target.value }))} className="border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm bg-white">
          <option value="">Todos os motivos</option>{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select>
        <select value={filtro.periodo} onChange={e => setFiltro(f => ({ ...f, periodo: e.target.value }))} className="border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm bg-white">
          <option value="">Todo o período</option><option value="1">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select>
      </div>

      {erro && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{erro} <button onClick={carregar} className="underline font-bold ml-2">Tentar novamente</button></p>}

      <div className="bg-white rounded-2xl border border-cb-marrom/10 overflow-auto">
        <table className="w-full text-sm text-cb-marrom">
          <thead className="bg-cb-marrom/5 text-left text-xs">
            <tr><th className="px-3 py-2">Nº</th>{somar && <th className="px-3 py-2">Loja</th>}<th className="px-3 py-2">Título / motivo</th><th className="px-3 py-2">Prioridade</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aberto em</th><th className="px-3 py-2">Decorrido</th><th className="px-3 py-2">Solução</th></tr>
          </thead>
          <tbody>
            {lista === null ? <tr><td colSpan={8} className="px-3 py-6 text-center text-cb-marrom/50">Carregando…</td></tr>
              : lista.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-cb-marrom/50">Nenhum chamado encontrado.</td></tr>
              : lista.map(c => (
                <tr key={c.id} onClick={() => setAbertoId(c.id)} className="border-t border-cb-marrom/5 hover:bg-cb-marrom/5 cursor-pointer">
                  <td className="px-3 py-2 font-mono font-bold">{numero(c.numero)}</td>
                  {somar && <td className="px-3 py-2">{c.empresaNome}</td>}
                  <td className="px-3 py-2"><p className="font-medium">{c.titulo}</p><p className="text-xs text-cb-marrom/50">{c.motivo}</p></td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${COR_PRIORIDADE[c.prioridade]}`}>{NOME_PRIORIDADE[c.prioridade]?.split(" ")[0]}</span></td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${COR_STATUS[c.status]}`}>{NOME_STATUS[c.status]}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap">{dataHora(c.abertoEm)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{decorrido(c)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{tempoSolucao(c)}</td>
                </tr>))}
          </tbody>
        </table>
      </div>

      {novo && <NovoChamado onFechar={() => setNovo(false)} onCriado={(id) => { setNovo(false); void carregar(); setAbertoId(id); }} />}
      {abertoId && <Detalhe id={abertoId} somar={somar} onFechar={() => { setAbertoId(null); void carregar(); }} />}
    </div>
  );
}

function NovoChamado({ onFechar, onCriado }: { onFechar: () => void; onCriado: (id: string) => void }) {
  const [f, setF] = useState({ motivo: MOTIVOS[0], prioridade: "MEDIA", titulo: "", descricao: "" });
  const [anexo, setAnexo] = useState<{ nome: string; dados: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar() {
    setEnviando(true); setErro("");
    try {
      const d = await chamar("/api/chamados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, ...(anexo ? { anexo: anexo.dados, anexoNome: anexo.nome } : {}) }) });
      onCriado(d.id);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao abrir o chamado"); } finally { setEnviando(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-auto flex flex-col gap-3 shadow-2xl">
        <h3 className="font-bold text-lg text-cb-marrom">Abrir chamado</h3>
        <label className="text-sm font-medium">Motivo
          <select value={f.motivo} onChange={e => setF({ ...f, motivo: e.target.value })} className="mt-1 w-full border border-cb-marrom/20 rounded-xl px-3 py-2">{MOTIVOS.map(m => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm font-medium">Prioridade
          <select value={f.prioridade} onChange={e => setF({ ...f, prioridade: e.target.value })} className="mt-1 w-full border border-cb-marrom/20 rounded-xl px-3 py-2">{PRIORIDADES.map(p => <option key={p} value={p}>{NOME_PRIORIDADE[p]}</option>)}</select></label>
        <label className="text-sm font-medium">Título
          <input value={f.titulo} maxLength={150} onChange={e => setF({ ...f, titulo: e.target.value })} className="mt-1 w-full border border-cb-marrom/20 rounded-xl px-3 py-2" /></label>
        <label className="text-sm font-medium">Descrição
          <textarea value={f.descricao} rows={5} maxLength={5000} onChange={e => setF({ ...f, descricao: e.target.value })} className="mt-1 w-full border border-cb-marrom/20 rounded-xl px-3 py-2" placeholder="O que aconteceu? Em que tela? Que horas?" /></label>
        <label className="text-sm font-medium">Print da tela (opcional, até 2 MB)
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-1 block w-full text-sm"
            onChange={async e => { const file = e.target.files?.[0]; if (!file) return setAnexo(null); try { setAnexo({ nome: file.name, dados: await lerImagem(file) }); setErro(""); } catch (x) { setAnexo(null); e.target.value = ""; setErro(x instanceof Error ? x.message : "Imagem inválida"); } }} /></label>
        {erro && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
        <div className="flex gap-2 mt-1">
          <button onClick={onFechar} disabled={enviando} className="flex-1 py-2.5 rounded-xl border border-cb-marrom/20 font-medium text-sm">Cancelar</button>
          <button onClick={enviar} disabled={enviando || f.titulo.trim().length < 3 || f.descricao.trim().length < 5} className="flex-1 py-2.5 rounded-xl bg-cb-amber text-white font-bold text-sm disabled:opacity-50">{enviando ? "Enviando…" : erro ? "Tentar novamente" : "Abrir chamado"}</button>
        </div>
      </div>
    </div>
  );
}

function Detalhe({ id, somar, onFechar }: { id: string; somar: boolean; onFechar: () => void }) {
  const [dados, setDados] = useState<{ chamado: Chamado; eventos: Evento[] } | null>(null);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [anexo, setAnexo] = useState<{ nome: string; dados: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [, setTick] = useState(0);
  const fim = useRef<HTMLDivElement>(null);
  const total = useRef(0);

  const carregar = useCallback(async () => {
    try { setDados(await chamar(`/api/chamados/${id}`)); setErro(""); } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar"); }
  }, [id]);
  useEffect(() => { void carregar(); const t = setInterval(carregar, 10000); return () => clearInterval(t); }, [carregar]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (dados && dados.eventos.length !== total.current) { total.current = dados.eventos.length; fim.current?.scrollIntoView({ behavior: "smooth" }); } }, [dados]);

  async function acao(corpo: unknown) {
    setOcupado(true); setErro("");
    try { await chamar(`/api/chamados/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }); await carregar(); return true; }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro"); return false; } finally { setOcupado(false); }
  }
  async function responder() {
    if (!msg.trim()) return;
    if (await acao({ acao: "responder", mensagem: msg, ...(anexo ? { anexo: anexo.dados, anexoNome: anexo.nome } : {}) })) { setMsg(""); setAnexo(null); }
  }

  const c = dados?.chamado;
  const encerrado = c ? ["RESOLVIDO", "FECHADO"].includes(c.status) : false;
  const agora = Date.now();
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-cb-marrom/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-cb-marrom/50">{c ? numero(c.numero) : ""} {somar && c?.empresaNome ? `· ${c.empresaNome}` : ""}</p>
            <h3 className="font-bold text-lg text-cb-marrom break-words">{c?.titulo ?? "Carregando…"}</h3>
            {c && <p className="text-xs text-cb-marrom/60">{c.motivo} · aberto por {c.usuarioNome} em {dataHora(c.abertoEm)}</p>}
          </div>
          <button onClick={onFechar} className="text-2xl leading-none px-2" aria-label="Fechar">×</button>
        </div>

        {c && <div className="px-5 py-3 border-b border-cb-marrom/10 flex flex-wrap gap-x-5 gap-y-2 text-xs items-center">
          <span className={`px-2 py-0.5 rounded-full font-bold ${COR_STATUS[c.status]}`}>{NOME_STATUS[c.status]}</span>
          <span className={`px-2 py-0.5 rounded-full font-bold ${COR_PRIORIDADE[c.prioridade]}`}>{NOME_PRIORIDADE[c.prioridade]}</span>
          <span>Decorrido: <b>{duracao((encerrado && c.resolvidoEm ? ms(c.resolvidoEm)! : agora) - ms(c.abertoEm)!)}</b></span>
          <span>1ª resposta: <b>{c.primeiraRespostaEm ? duracao(ms(c.primeiraRespostaEm)! - ms(c.abertoEm)!) : "aguardando"}</b></span>
          <span>Solução: <b>{c.resolvidoEm ? duracao(ms(c.resolvidoEm)! - ms(c.abertoEm)!) : "—"}</b></span>
          {c.reaberturas > 0 && <span>Reaberto {c.reaberturas}×</span>}
          {somar && <>
            <select value={c.status} disabled={ocupado} onChange={e => acao({ acao: "status", status: e.target.value })} className="border rounded-lg px-2 py-1 bg-white">{STATUS.filter(s => s !== "FECHADO" || c.status !== "FECHADO").map(s => <option key={s} value={s}>{NOME_STATUS[s]}</option>)}</select>
            <select value={c.prioridade} disabled={ocupado} onChange={e => acao({ acao: "prioridade", prioridade: e.target.value })} className="border rounded-lg px-2 py-1 bg-white">{PRIORIDADES.map(p => <option key={p} value={p}>{NOME_PRIORIDADE[p]}</option>)}</select>
          </>}
          {c.status === "FECHADO" || c.status === "RESOLVIDO" ? <button disabled={ocupado} onClick={() => acao({ acao: "reabrir" })} className="border border-cb-marrom/30 rounded-lg px-3 py-1 font-bold">Reabrir</button> : null}
          {!somar && c.status === "RESOLVIDO" && <button disabled={ocupado} onClick={() => acao({ acao: "status", status: "FECHADO" })} className="bg-green-600 text-white rounded-lg px-3 py-1 font-bold">Confirmar solução (fechar)</button>}
        </div>}

        <div className="flex-1 overflow-auto p-5 flex flex-col gap-3 bg-cb-bege/40">
          {dados?.eventos.map(e => e.tipo === "MENSAGEM" || e.tipo === "ABERTURA" ? (
            <div key={e.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${e.autorTipo === "SOMAR" ? "self-start bg-white border border-cb-amber/40" : "self-end bg-cb-amber/15"}`}>
              <p className="text-xs font-bold text-cb-marrom/60">{e.autorNome} {e.autorTipo === "SOMAR" ? "(Somar)" : ""} · {dataHora(e.criadoEm)}{e.tipo === "ABERTURA" ? " · abertura" : ""}</p>
              <p className="whitespace-pre-wrap break-words">{e.mensagem}</p>
              {e.temAnexo && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={`/api/chamados/${id}/anexo/${e.id}`} target="_blank" rel="noopener noreferrer"><img src={`/api/chamados/${id}/anexo/${e.id}`} alt={e.anexoNome ?? "anexo"} className="mt-2 max-h-48 rounded-lg border" /></a>)}
            </div>
          ) : (
            <p key={e.id} className="self-center text-xs text-cb-marrom/60 bg-white/70 rounded-full px-3 py-1 text-center">
              {dataHora(e.criadoEm)} · {e.autorNome}{" "}
              {e.tipo === "STATUS" && `mudou o status: ${NOME_STATUS[e.valorAnterior ?? ""] ?? e.valorAnterior} → ${NOME_STATUS[e.valorNovo ?? ""] ?? e.valorNovo}`}
              {e.tipo === "PRIORIDADE" && `mudou a prioridade: ${NOME_PRIORIDADE[e.valorAnterior ?? ""]?.split(" ")[0]} → ${NOME_PRIORIDADE[e.valorNovo ?? ""]?.split(" ")[0]}`}
              {e.tipo === "REABERTURA" && `reabriu o chamado${e.mensagem ? `: ${e.mensagem}` : ""}`}
            </p>
          ))}
          <div ref={fim} />
        </div>

        <div className="p-4 border-t border-cb-marrom/10 flex flex-col gap-2">
          {erro && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro} <button onClick={carregar} className="underline font-bold ml-2">Tentar novamente</button></p>}
          <textarea value={msg} rows={2} maxLength={5000} onChange={e => setMsg(e.target.value)} placeholder={encerrado && !somar ? "Responder reabre o chamado…" : "Escreva uma resposta…"} className="w-full border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm" />
          <div className="flex items-center gap-2 flex-wrap">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="text-xs flex-1 min-w-0"
              onChange={async e => { const file = e.target.files?.[0]; if (!file) return setAnexo(null); try { setAnexo({ nome: file.name, dados: await lerImagem(file) }); setErro(""); } catch (x) { setAnexo(null); e.target.value = ""; setErro(x instanceof Error ? x.message : "Imagem inválida"); } }} />
            <button onClick={responder} disabled={ocupado || !msg.trim()} className="px-5 py-2 rounded-xl bg-cb-amber text-white font-bold text-sm disabled:opacity-50">{ocupado ? "Enviando…" : "Enviar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
