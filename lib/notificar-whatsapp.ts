type TipoNotificacao = "PEDIDO_CONFIRMADO" | "PEDIDO_PRONTO" | "PEDIDO_ENTREGUE";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";
const N8N_URL = process.env.N8N_WEBHOOK_WHATSAPP;

const MENSAGENS: Record<TipoNotificacao, (p: {
  nome: string;
  senha: string;
  itens?: string;
  total?: string;
}) => string> = {
  PEDIDO_CONFIRMADO: ({ nome, senha, itens, total }) =>
    `Olá ${nome}! ☕ Seu pedido *${senha}* foi recebido!\n` +
    (itens ? `Itens: ${itens}\n` : "") +
    (total ? `Total: R$ ${total}\n` : "") +
    `Acompanhe: ${BASE}/fila\n_Coffee & Beats — Onde o café encontra o ritmo_`,

  PEDIDO_PRONTO: ({ nome, senha }) =>
    `${nome}, seu pedido *${senha}* está PRONTO! 🎉\nPode retirar no balcão.\n_Coffee & Beats_ ☕`,

  PEDIDO_ENTREGUE: ({ nome }) =>
    `Obrigado pela visita, ${nome}!\nEsperamos ter te agradado ☕\n_Até a próxima!_`,
};

export async function notificarWhatsApp(params: {
  whatsapp: string;
  tipo: TipoNotificacao;
  cliente: { nome: string };
  pedido: { senha: string; itens?: { nome: string; quantidade: number }[]; total?: number };
}) {
  if (!N8N_URL) return; // sem webhook configurado — silencioso

  const itensStr = params.pedido.itens?.map(i => `${i.quantidade}x ${i.nome}`).join(", ");
  const totalStr = params.pedido.total != null ? Number(params.pedido.total).toFixed(2) : undefined;

  const mensagem = MENSAGENS[params.tipo]({
    nome:  params.cliente.nome,
    senha: params.pedido.senha,
    itens: itensStr,
    total: totalStr,
  });

  try {
    await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsapp: params.whatsapp,
        tipo:     params.tipo,
        mensagem,
        pedido:   params.pedido,
        cliente:  params.cliente,
      }),
    });
  } catch (e) {
    // fire-and-forget — nunca bloqueia o fluxo principal
  }
}
