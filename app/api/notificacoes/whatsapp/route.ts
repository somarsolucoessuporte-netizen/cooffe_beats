import { resposta, erroResposta } from "@/lib/api-response";

type TipoNotificacao = "PEDIDO_CONFIRMADO" | "PEDIDO_PRONTO" | "PEDIDO_ENTREGUE";

const MENSAGENS: Record<TipoNotificacao, (params: {
  nome: string;
  senha: string;
  itens?: string;
  total?: string;
}) => string> = {
  PEDIDO_CONFIRMADO: ({ nome, senha, itens, total }) =>
    `Olá ${nome}! ☕ Seu pedido *${senha}* foi recebido!\n` +
    (itens ? `Itens: ${itens}\n` : "") +
    (total ? `Total: R$ ${total}\n` : "") +
    `Acompanhe: ${process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br"}/fila\n` +
    `_Coffee & Beats — Onde o café encontra o ritmo_`,

  PEDIDO_PRONTO: ({ nome, senha }) =>
    `${nome}, seu pedido *${senha}* está PRONTO! 🎉\n` +
    `Pode retirar no balcão.\n` +
    `_Coffee & Beats_ ☕`,

  PEDIDO_ENTREGUE: ({ nome }) =>
    `Obrigado pela visita, ${nome}!\n` +
    `Esperamos ter te agradado ☕\n` +
    `_Até a próxima!_`,
};

export async function POST(req: Request) {
  const N8N_URL = process.env.N8N_WEBHOOK_WHATSAPP;

  const body = await req.json().catch(() => null);
  if (!body) return erroResposta("Body inválido");

  const { whatsapp, tipo, pedido, cliente } = body as {
    whatsapp?: string;
    tipo?: TipoNotificacao;
    pedido?: { senha?: string; itens?: { nome: string; quantidade: number }[]; total?: number };
    cliente?: { nome?: string };
  };

  if (!whatsapp || !tipo || !cliente?.nome || !pedido?.senha) {
    return erroResposta("whatsapp, tipo, cliente.nome e pedido.senha são obrigatórios");
  }

  if (!MENSAGENS[tipo]) return erroResposta("Tipo de notificação inválido");

  const itensStr = pedido.itens?.map(i => `${i.quantidade}x ${i.nome}`).join(", ");
  const totalStr = pedido.total != null ? String(Number(pedido.total).toFixed(2)) : undefined;

  const mensagem = MENSAGENS[tipo]({
    nome:  cliente.nome,
    senha: pedido.senha,
    itens: itensStr,
    total: totalStr,
  });

  // Se não há webhook configurado, apenas retorna a mensagem (modo dry-run)
  if (!N8N_URL) {
    return resposta({ enviado: false, modo: "dry-run", mensagem });
  }

  try {
    const r = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp, tipo, mensagem, pedido, cliente }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return erroResposta(`N8N retornou ${r.status}: ${txt}`, 502);
    }

    return resposta({ enviado: true, mensagem });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao chamar N8N";
    return erroResposta(msg, 502);
  }
}
