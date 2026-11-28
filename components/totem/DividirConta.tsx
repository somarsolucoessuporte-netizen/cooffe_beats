"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ItemCarrinho } from "@/contexts/CarrinhoContext";
import { centavos, dividirIgualmente, DIVISAO_STORAGE } from "@/lib/dividir-conta/domain";
import { cobrarComReconsulta, encerrarAtendimentoDivisao, RequestError } from "@/lib/dividir-conta/client";
import { gerarPixEstatico, pixEstaticoVisivel } from "@/lib/pix-estatico";
import { formatarMoeda } from "@/lib/utils";

type Tentativa = { id: string; status: string; meio?: string; criadoEm?: string | null; temCobranca?: boolean; motivo?: string | null };
type Resumo = {
  id: string; pedidoId: string; senha: string; total: number; pago: number; saldo: number; reservado: number; status: string; habilitada: boolean;
  bloqueioCobranca?: string | null;
  maquininha?: { parcelaId: string; ordem: number } | null;
  minimoCartao?: number;
  aviso?: string;
  naoCancelados?: number;
  pix?: { tentativaId: string; parcelaId: string; qrData: string; valor: number }[];
  parcelas: { id: string; ordem: number; valor: number; status: string; tentativas: Tentativa[] }[];
};
type Sessao = { id?: string; token: string; request?: unknown };
type Parcial = { pago: number; saldo: number };
type PixPainel = { parcelaId: string; chavePix: string; desde: number; dinamico: "gerando" | "pronto" | "erro"; erro?: string; confirmando?: boolean };

const TIMEOUT_REDE_MS = 15000;
const VALIDADE_POINT_MS = 8 * 60 * 1000;
const mmss = (ms: number) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const ATIVOS = ["CRIANDO", "PENDENTE", "DESCONHECIDO"];
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
async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* WebView sem clipboard API */ }
  try {
    const ta = document.createElement("textarea"); ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
  } catch { return false; }
}

export default function DividirConta({ itens, total, onVoltar, onAtendimento, onQuitada }: {
  itens: ItemCarrinho[]; total: number; onVoltar: (parcial?: Parcial) => void; onAtendimento: () => void;
  onQuitada: (pedido: { id: string; senha: string; total: number }) => Promise<void>;
}) {
  const [pessoas, setPessoas] = useState(2);
  const [valores, setValores] = useState(() => dividirIgualmente(Math.round(total * 100) || 2, 2).map(v => (v / 100).toFixed(2)));
  const [conta, setConta] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [painel, setPainel] = useState<PixPainel | null>(null);
  const [copiado, setCopiado] = useState("");
  const [avisoSaida, setAvisoSaida] = useState("");
  const [, setTick] = useState(0);
  const sessao = useRef<Sessao | null>(null);
  const saiu = useRef(false);
  const cobrando = useRef(false);
  const falhaFinalizacao = useRef(false);
  const quitada = useRef(onQuitada);
  quitada.current = onQuitada;

  // Toda chamada de rede tem timeout: nada fica carregando para sempre.
  async function request(path: string, body?: unknown, ms = TIMEOUT_REDE_MS) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessao.current?.token ?? ""}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", signal: ctl.signal });
      const json = await res.json();
      if (!json.ok) throw new RequestError(json.error ?? "Não foi possível consultar a conta", res.status);
      return json.data as Resumo;
    } catch (e) {
      if (e instanceof RequestError) throw e;
      throw new RequestError("Sem resposta do servidor. Verifique a conexão e tente novamente.", 0);
    } finally { clearTimeout(t); }
  }
  function guardar(s: Sessao) {
    if (saiu.current) return;
    // Persist BEFORE sending a charge/order. Without storage, fail closed.
    sessionStorage.setItem(DIVISAO_STORAGE, JSON.stringify(s));
    sessao.current = s;
  }
  async function atualizar() {
    const s = sessao.current;
    if (!s) return;
    const data = s.id ? await request(`/api/pagamentos/dividir/${s.id}`) : await request("/api/pagamentos/dividir", s.request);
    if (saiu.current) return data;
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

  // Re-renderiza a cada segundo enquanto há painel Pix (regra dos 10 s do Pix reserva)
  useEffect(() => {
    if (!painel && !conta?.maquininha) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [painel, conta?.maquininha]);

  useEffect(() => {
    if (!conta || conta.status !== "QUITADA" || conta.saldo !== 0 || conta.reservado !== 0 || finalizando || falhaFinalizacao.current) return;
    setFinalizando(true);
    quitada.current({ id: conta.pedidoId, senha: conta.senha, total: conta.total / 100 })
      .then(() => { if (!saiu.current) sessionStorage.removeItem(DIVISAO_STORAGE); })
      .catch(() => { falhaFinalizacao.current = true; setErro("Conta quitada. Não foi possível abrir o comprovante; consulte o atendente."); setFinalizando(false); });
  }, [conta, finalizando]);

  // Parcela paga (ou sem tentativa ativa): fecha o painel Pix
  useEffect(() => {
    if (!painel || !conta) return;
    const p = conta.parcelas.find(x => x.id === painel.parcelaId);
    if (!p || p.status === "APROVADO") setPainel(null);
  }, [conta, painel]);

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

  function chaveDaParcela(parcelaId: string, ultimaRecusada: string | null, sufixo: string) {
    const key = `cb_divisao_tentativa_${sufixo}${parcelaId}`;
    const anterior = sessionStorage.getItem(key);
    const saved = anterior ? JSON.parse(anterior) as { chave: string; ultima: string | null } : null;
    // A confirmed rejection permits a NEW operation; network errors reuse the key.
    const chave = saved && saved.ultima === ultimaRecusada ? saved.chave : novaChave();
    sessionStorage.setItem(key, JSON.stringify({ chave, ultima: ultimaRecusada }));
    return chave;
  }

  async function pagar(parcelaId: string) {
    if (cobrando.current || !conta) return;
    cobrando.current = true; setOcupado(true); setErro("");
    try {
      const parte = conta.parcelas.find(p => p.id === parcelaId)!;
      const ultima = parte.tentativas[parte.tentativas.length - 1];
      const chave = chaveDaParcela(parcelaId, ultima && ["RECUSADO", "DESCONHECIDO"].includes(ultima.status) ? ultima.id : null, "");
      const resultado = await cobrarComReconsulta(
        () => request(`/api/pagamentos/dividir/${conta.id}/cobrar`, { parcelaId, chave }),
        () => request(`/api/pagamentos/dividir/${conta.id}`),
      );
      if (saiu.current) return;
      setConta(resultado.conta);
      if (resultado.conflito) setErro(resultado.mensagem || "Estado atualizado após conflito. Nenhuma cobrança foi reenviada automaticamente.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Aguardando confirmação do estado da conta. Não repita o pagamento."); }
    finally { cobrando.current = false; setOcupado(false); }
  }

  // Pix da parcela: QR estático aparece na hora (valor da parcela vindo do banco, via resumo) e o dinâmico
  // do Mercado Pago é gerado em paralelo — o estático vira reserva se o dinâmico falhar ou passar de 10 s.
  async function abrirPix(parcelaId: string) {
    if (!conta) return;
    const parte = conta.parcelas.find(p => p.id === parcelaId)!;
    let chavePix = "";
    try { chavePix = gerarPixEstatico({ valor: parte.valor / 100, referencia: `DC${conta.senha}P${parte.ordem}` }); } catch { /* sem estático */ }
    setPainel({ parcelaId, chavePix, desde: Date.now(), dinamico: "gerando" });
    setErro("");
    await gerarDinamico(parcelaId);
  }
  async function gerarDinamico(parcelaId: string) {
    if (!conta) return;
    setPainel(p => p && p.parcelaId === parcelaId ? { ...p, desde: Date.now(), dinamico: "gerando", erro: undefined } : p);
    try {
      const parte = conta.parcelas.find(p => p.id === parcelaId)!;
      const ultima = parte.tentativas[parte.tentativas.length - 1];
      const chave = chaveDaParcela(parcelaId, ultima?.status === "RECUSADO" ? ultima.id : null, "pix_");
      const data = await request(`/api/pagamentos/dividir/${conta.id}/pix`, { parcelaId, chave });
      if (saiu.current) return;
      setConta(data);
      setPainel(p => p && p.parcelaId === parcelaId ? { ...p, dinamico: data.pix?.some(x => x.parcelaId === parcelaId) ? "pronto" : "erro", erro: undefined } : p);
    } catch (e) {
      console.warn("[Divisão] Pix dinâmico falhou:", e instanceof Error ? e.message : e);
      setPainel(p => p && p.parcelaId === parcelaId ? { ...p, dinamico: "erro", erro: e instanceof Error ? e.message : "erro" } : p);
    }
  }
  async function confirmarPixManual(parcelaId: string) {
    if (!conta || cobrando.current) return;
    cobrando.current = true; setOcupado(true); setErro("");
    try {
      const chave = novaChave();
      const data = await request(`/api/pagamentos/dividir/${conta.id}/pix-manual`, { parcelaId, chave });
      if (saiu.current) return;
      setConta(data); setPainel(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível confirmar o Pix."); setPainel(p => p ? { ...p, confirmando: false } : p); }
    finally { cobrando.current = false; setOcupado(false); }
  }
  // Cartão -> Pix: libera a maquininha (espera no máximo 4 s; o cancelamento no MP segue em segundo plano) e abre o Pix
  async function trocarParaPix(parcelaId: string) {
    if (!conta || cobrando.current) return;
    cobrando.current = true; setOcupado(true); setErro("");
    try {
      const cancelamento = request(`/api/pagamentos/dividir/${conta.id}/cancelar-pagamento`, {}).catch(() => null);
      const d = await Promise.race([cancelamento, new Promise<null>(ok => setTimeout(() => ok(null), 4000))]);
      if (saiu.current) return;
      if (d) { setConta(d); if (d.aviso) setErro(d.aviso); }
    } finally { cobrando.current = false; setOcupado(false); }
    await abrirPix(parcelaId);
  }
  // Fecha o painel e cancela (em segundo plano) o QR dinâmico pendente
  function fecharPainel() {
    setPainel(null);
    if (conta && conta.pix?.length) void request(`/api/pagamentos/dividir/${conta.id}/cancelar-pagamento`, {}).then(d => { if (!saiu.current) setConta(d); }).catch(() => {});
  }

  // "Cancelar esse pagamento": cancela no MP (Point e order QR) e libera as parcelas
  async function cancelarPagamentoAtivo() {
    if (!conta || cobrando.current) return;
    cobrando.current = true; setOcupado(true); setErro("");
    try {
      const data = await request(`/api/pagamentos/dividir/${conta.id}/cancelar-pagamento`, {});
      if (saiu.current) return;
      setConta(data); setPainel(null);
      if (data.naoCancelados) setErro("Não foi possível cancelar agora. O pagamento continua em andamento; tente de novo ou chame o atendente.");
      else if (data.aviso) setErro(data.aviso);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível cancelar o pagamento"); }
    finally { cobrando.current = false; setOcupado(false); }
  }

  // "Cancelar divisão e voltar": só sai depois que o servidor confirma o que foi feito.
  // Sem confirmação, fica na tela com o erro ("Encerrar atendimento" continua disponível).
  async function sair() {
    if (saiu.current) return;
    saiu.current = true; setOcupado(true); setErro("");
    const esquecer = () => { try { sessionStorage.removeItem(DIVISAO_STORAGE); } catch { /* sem storage */ } sessao.current = null; };
    const ficar = (mensagem: string) => { saiu.current = false; setOcupado(false); setErro(mensagem); };
    try {
      let s = sessao.current;
      if (!s) { onVoltar(); return; }
      if (!s.id) {
        // A resposta da criação pode ter se perdido: recupera a conta (mesma chave) antes de cancelar.
        try { s = { ...s, id: (await request("/api/pagamentos/dividir", s.request)).id }; sessao.current = s; }
        catch (e) {
          if (e instanceof RequestError && [400, 403].includes(e.status)) { esquecer(); onVoltar(); return; }
          throw e;
        }
      }
      const r = await request(`/api/pagamentos/dividir/${s.id}/cancelar`, {}) as unknown as { cancelada: boolean; pago: number; saldo: number; pendentes: number; aviso?: string };
      if (r.cancelada) { esquecer(); if (r.aviso) setAvisoSaida(r.aviso); else onVoltar(); return; }
      if (r.pago > 0 && r.pendentes === 0) { onVoltar({ pago: r.pago, saldo: r.saldo }); return; }
      ficar("A divisão NÃO foi cancelada: há um pagamento que não pôde ser encerrado ou a conta está em revisão. Tente de novo ou chame o atendente.");
    } catch (e) { ficar(`A divisão NÃO foi cancelada. ${e instanceof Error ? e.message : "Tente novamente."}`); }
  }

  const ativaNaConta = conta?.parcelas.some(p => p.tentativas.some(t => ATIVOS.includes(t.status))) ?? false;
  const dinamicoPronto = (parcelaId: string) => conta?.pix?.find(x => x.parcelaId === parcelaId);
  const estaticoVisivel = painel ? pixEstaticoVisivel({ ativo: true, estado: painel.dinamico, decorridoMs: painel.dinamico === "gerando" ? Date.now() - painel.desde : 0 }) : false;

  if (avisoSaida) return <section className="flex-1 p-5 flex flex-col items-center justify-center gap-5" aria-label="Divisão cancelada">
    <h1 className="text-3xl font-extrabold text-cb-marrom">Divisão cancelada</h1>
    <p role="alert" className="max-w-xl text-center bg-amber-50 border border-amber-300 rounded-xl p-4">{avisoSaida}</p>
    <button onClick={() => onVoltar()} className="bg-cb-marrom text-white font-bold rounded-xl px-8 py-4 touch-manipulation">Voltar ao pagamento</button>
  </section>;

  return <section className="flex-1 overflow-y-auto p-5 flex flex-col items-center gap-5" aria-label="Dividir conta">
    {/* Sempre visíveis e funcionando, em qualquer estado */}
    <div className="sticky top-0 z-10 w-full max-w-xl bg-cb-bege py-2 flex flex-col gap-2">
      <button onClick={sair} disabled={ocupado} className="w-full disabled:opacity-50 border-2 border-cb-marrom rounded-xl px-5 py-4 font-bold bg-white touch-manipulation">← Voltar ao pagamento</button>
      <button onClick={() => { saiu.current = true; try { onAtendimento(); } catch { saiu.current = false; setErro("Não foi possível encerrar o atendimento neste aparelho. Solicite ajuda ao atendente."); } }} className="w-full text-cb-marrom/70 underline text-sm py-1 touch-manipulation">Encerrar atendimento e iniciar novo pedido</button>
    </div>
    <h1 className="text-3xl font-extrabold text-cb-marrom">Dividir conta</h1>
    {!pronto ? <p>Recuperando conta…</p> : conta ? <>
      <dl className="w-full max-w-xl grid grid-cols-2 gap-3 bg-white rounded-2xl p-5 text-cb-marrom" aria-live="polite">
        <dt>Total da conta</dt><dd className="text-right font-bold">{moeda(conta.total)}</dd>
        <dt>Já pago</dt><dd className="text-right font-bold">{moeda(conta.pago)}</dd>
        <dt>Em processamento</dt><dd className="text-right">{moeda(conta.reservado)}</dd>
        <dt>Saldo restante</dt><dd className="text-right font-extrabold">{moeda(conta.saldo)}</dd>
      </dl>
      {!conta.habilitada && <p>Novas cobranças desativadas. Pagamentos iniciados continuam sendo acompanhados.</p>}
      {/* Aviso só com parcela realmente em processamento (mesmo critério do "Em processamento") */}
      {conta.reservado > 0 && ativaNaConta && <div role="status" className="w-full max-w-xl bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col gap-3">
        <p>Há uma parcela em processamento ({moeda(conta.reservado)}). Aguarde a confirmação ou cancele esse pagamento.</p>
        <button onClick={cancelarPagamentoAtivo} disabled={ocupado} className="border-2 border-cb-marrom rounded-xl px-5 py-3 font-bold bg-white touch-manipulation disabled:opacity-50">Cancelar esse pagamento</button>
      </div>}
      {conta.status === "REVISAO" && <p role="alert">Conta em revisão. Não efetue outro pagamento; chame o atendente.</p>}

      {painel && (() => {
        const parte = conta.parcelas.find(p => p.id === painel.parcelaId);
        if (!parte) return null;
        const din = dinamicoPronto(painel.parcelaId);
        return <div className="w-full max-w-xl bg-white rounded-2xl p-3 flex flex-col items-center gap-2 border-2 border-cb-amber/50" aria-label="Pix da parcela">
          <p className="font-extrabold text-xl">Pix · Pessoa {parte.ordem} · {moeda(parte.valor)}</p>
          {painel.dinamico === "gerando" && <p className="text-sm animate-pulse">Gerando QR Pix…</p>}
          {painel.dinamico === "pronto" && din && <>
            <div className="bg-white p-1" style={{ width: "clamp(220px, 32vh, 280px)", height: "clamp(220px, 32vh, 280px)" }}><QRCodeSVG value={din.qrData} size={280} marginSize={2} level="M" style={{ width: "100%", height: "100%" }} /></div>
            <p className="font-bold">Escaneie com o app do seu banco</p>
            <button onClick={async () => { if (await copiar(din.qrData)) { setCopiado("din"); setTimeout(() => setCopiado(""), 3000); } }} className="w-full border-2 border-cb-marrom/30 rounded-xl px-5 py-3 font-bold touch-manipulation">{copiado === "din" ? "✓ Código copiado" : "Copiar código Pix"}</button>
            <p className="text-xs text-cb-marrom/60 text-center">A parcela é confirmada automaticamente quando o pagamento cair.</p>
          </>}
          {painel.dinamico === "erro" && <div className="w-full flex flex-col items-center gap-2">
            <p className="font-bold text-red-600">Não foi possível gerar o QR Pix</p>
            {painel.erro && <p className="text-xs text-red-700 text-center">{painel.erro}</p>}
            <button onClick={() => gerarDinamico(painel.parcelaId)} className="w-full bg-cb-marrom text-white rounded-xl px-5 py-3 font-bold touch-manipulation">Tentar novamente</button>
          </div>}
          {estaticoVisivel && painel.chavePix && <div className="w-full flex flex-col items-center gap-2 border-t pt-2">
            <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-3 py-1">Pix reserva (chave CNPJ)</p>
            <div className="bg-white p-1" style={{ width: "clamp(220px, 32vh, 280px)", height: "clamp(220px, 32vh, 280px)" }}><QRCodeSVG value={painel.chavePix} size={280} marginSize={2} level="M" style={{ width: "100%", height: "100%" }} /></div>
            <p className="font-bold">{moeda(parte.valor)} · Escaneie com o app do seu banco</p>
            <button onClick={async () => { if (await copiar(painel.chavePix)) { setCopiado("est"); setTimeout(() => setCopiado(""), 3000); } }} className="w-full border-2 border-cb-marrom/30 rounded-xl px-5 py-3 font-bold touch-manipulation">{copiado === "est" ? "✓ Código copiado" : "Copiar código Pix"}</button>
            <p className="text-sm font-bold text-amber-800 bg-amber-50 rounded-xl px-3 py-2 text-center">Após pagar, mostre o comprovante ao atendente</p>
            {painel.confirmando
              ? <div className="w-full flex flex-col gap-2"><p className="text-sm text-center">Confirme que o Pix da chave CNPJ caiu na conta antes de liberar.</p>
                  <button disabled={ocupado} onClick={() => confirmarPixManual(painel.parcelaId)} className="w-full bg-cb-confirma text-white rounded-xl px-5 py-3 font-bold touch-manipulation disabled:opacity-50">✅ Sim, parcela paga</button>
                  <button onClick={() => setPainel(p => p ? { ...p, confirmando: false } : p)} className="w-full border rounded-xl px-5 py-3 font-bold touch-manipulation">Voltar</button></div>
              : <button onClick={() => setPainel(p => p ? { ...p, confirmando: true } : p)} className="w-full bg-cb-confirma text-white rounded-xl px-5 py-3 font-bold touch-manipulation">Atendente: confirmar Pix recebido</button>}
          </div>}
          <button onClick={fecharPainel} className="w-full border-2 border-cb-marrom rounded-xl px-5 py-3 font-bold touch-manipulation">Fechar e escolher outra forma</button>
        </div>;
      })()}

      <ol className="w-full max-w-xl flex flex-col gap-3">
        {conta.parcelas.map(p => {
          const ultima = p.tentativas[p.tentativas.length - 1];
          const estado = p.status === "APROVADO" ? "Pago" : estados[ultima?.status ?? ""] ?? "A pagar";
          const parcelaAtiva = p.tentativas.some(t => ATIVOS.includes(t.status));
          const pointAtiva = p.tentativas.find(t => ATIVOS.includes(t.status) && t.meio === "POINT");
          const emUsoPor = conta.maquininha && conta.maquininha.parcelaId !== p.id ? conta.maquininha.ordem : null;
          const desabilitado = ocupado || !conta.habilitada || conta.status !== "ABERTA" || emUsoPor !== null;
          const recusada = ultima?.status === "RECUSADO" && p.status === "ABERTA";
          // Sem cobrança confirmada na maquininha: as opções ficam disponíveis na hora.
          const incerta = pointAtiva?.status === "DESCONHECIDO" && !pointAtiva.temCobranca;
          const naMaquininha = pointAtiva?.status === "PENDENTE" && !!pointAtiva.temCobranca;
          const minimo = conta.minimoCartao ?? 100;
          const abaixoMinimo = p.valor < minimo;
          const restante = naMaquininha && pointAtiva?.criadoEm ? VALIDADE_POINT_MS - (Date.now() - new Date(pointAtiva.criadoEm).getTime()) : null;
          return <li key={p.id} className="bg-white rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-bold">Pessoa {p.ordem} · {moeda(p.valor)}</p><p className="text-sm" aria-live="polite">{incerta ? "Não confirmado" : estado}</p></div>
              {p.status === "ABERTA" && (!parcelaAtiva || incerta) && <div className="flex flex-col gap-2">
                <button className="bg-cb-marrom text-white rounded-xl px-5 py-3 disabled:opacity-40 touch-manipulation" disabled={desabilitado || abaixoMinimo} onClick={() => pagar(p.id)}>{abaixoMinimo ? `Mínimo no cartão: ${moeda(minimo)} — use Pix` : emUsoPor !== null ? `Maquininha em uso pela Pessoa ${emUsoPor}` : recusada || incerta ? "Tentar de novo (cartão)" : "Cartão"}</button>
                <button className="border-2 border-cb-marrom rounded-xl px-5 py-3 font-bold disabled:opacity-40 touch-manipulation" disabled={ocupado || !conta.habilitada || conta.status !== "ABERTA"} onClick={() => abrirPix(p.id)}>{recusada || incerta ? "Trocar para Pix" : "Pix"}</button>
              </div>}
            </div>
            {recusada && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2">Cartão não aprovado, cancelado ou expirado. Tente de novo ou troque para Pix.{ultima?.meio === "POINT" && ultima.motivo ? ` Motivo: ${ultima.motivo}` : ""}</p>}
            {incerta && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-2">Não foi possível confirmar com a maquininha. Confira se há cobrança na tela dela antes de tentar de novo ou trocar para Pix.</p>}
            {pointAtiva && !incerta && <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col gap-2" role="status">
              {naMaquininha ? <>
                <p className="font-extrabold">Passe o cartão na maquininha — {moeda(p.valor)}</p>
                <p className="text-sm">Aguardando{restante !== null ? ` · expira em ${restante > 0 ? mmss(restante) : "instantes"}` : ""}</p>
              </> : <p className="font-bold">{pointAtiva.status === "CRIANDO" ? "Enviando à maquininha…" : "Aguardando confirmação. Não repita o pagamento."}</p>}
              <div className="flex gap-2">
                <button onClick={cancelarPagamentoAtivo} disabled={ocupado} className="flex-1 border-2 border-cb-marrom rounded-xl px-4 py-3 font-bold bg-white touch-manipulation disabled:opacity-50">Cancelar</button>
                <button onClick={() => trocarParaPix(p.id)} disabled={ocupado} className="flex-1 bg-cb-marrom text-white rounded-xl px-4 py-3 font-bold touch-manipulation disabled:opacity-50">Trocar para Pix</button>
              </div>
            </div>}
            {incerta && <button onClick={cancelarPagamentoAtivo} disabled={ocupado} className="border-2 border-cb-marrom rounded-xl px-4 py-3 font-bold bg-white touch-manipulation disabled:opacity-50">Cancelar</button>}
          </li>;
        })}
      </ol>
      {conta.status === "ABERTA" && <button onClick={sair} disabled={ocupado} className="border rounded-xl px-6 py-3 touch-manipulation disabled:opacity-50">Cancelar divisão e voltar</button>}
      <p className="text-sm text-cb-marrom/70">A conta só será concluída após todas as confirmações. O atendimento pode recuperar esta divisão em Contas divididas, mesmo após sair desta tela.</p>
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
      <button onClick={() => onVoltar()} className="border rounded-xl px-6 py-3">Voltar ao pagamento integral</button>
    </>}
    {erro && <p role="alert" className="max-w-xl text-red-700 bg-red-50 rounded-xl p-4">{erro}</p>}
    {finalizando && <p>Conta quitada. Abrindo confirmação…</p>}
  </section>;
}
