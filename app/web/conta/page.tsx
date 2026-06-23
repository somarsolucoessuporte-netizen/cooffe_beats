import { redirect } from "next/navigation";
import Link from "next/link";
import { getWebSession } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { formatarMoeda } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    RECEBIDO:             "bg-amber-100 text-amber-700",
    EM_PREPARO:           "bg-blue-100 text-blue-700",
    PRONTO:               "bg-green-100 text-green-700",
    ENTREGUE:             "bg-cb-marrom/10 text-cb-marrom/60",
    CANCELADO:            "bg-red-100 text-red-600",
    COMANDA_ABERTA:       "bg-amber-100 text-amber-700",
    AGUARDANDO_PAGAMENTO: "bg-purple-100 text-purple-700",
  };
  const labels: Record<string, string> = {
    RECEBIDO:             "Recebido",
    EM_PREPARO:           "Em preparo",
    PRONTO:               "Pronto",
    ENTREGUE:             "Entregue",
    CANCELADO:            "Cancelado",
    COMANDA_ABERTA:       "Comanda aberta",
    AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cores[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default async function WebConta() {
  const { user, cliente } = await getWebSession();
  if (!user) redirect("/web/login");

  const pedidos = cliente
    ? await prisma.pedido.findMany({
        where:   { clienteId: cliente.id },
        orderBy: { criadoEm: "desc" },
        take:    20,
        include: {
          itens:     { include: { produto: { select: { nome: true } } } },
          pagamento: { select: { metodo: true } },
        },
      })
    : [];

  var nome      = cliente?.nome ?? (user.user_metadata?.full_name as string | undefined) ?? "Usuário";
  var email     = user.email ?? "";
  var whatsapp  = cliente?.whatsapp ?? null;
  var nPedidos  = pedidos.length;
  var totalGasto = cliente ? Number(cliente.totalGasto) : 0;

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-cb-marrom mb-6">Minha Conta</h1>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">

        {/* Perfil */}
        <div className="flex flex-col gap-4">

          {/* Card do usuário */}
          <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-cb-amber flex items-center justify-center
                              text-white font-extrabold text-xl">
                {nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-extrabold text-cb-marrom">{nome}</p>
                <p className="text-cb-marrom/40 text-xs">{email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              {whatsapp && (
                <div className="flex items-center gap-2 text-cb-marrom/60">
                  <span>📱</span>
                  <span>+{whatsapp}</span>
                </div>
              )}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-cb-marrom/10 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-3xl font-extrabold text-cb-marrom">{nPedidos}</p>
              <p className="text-xs text-cb-marrom/40 mt-0.5">Pedidos</p>
            </div>
            <div className="bg-white border border-cb-marrom/10 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-xl font-extrabold text-cb-amber leading-tight">
                {formatarMoeda(totalGasto)}
              </p>
              <p className="text-xs text-cb-marrom/40 mt-0.5">Total gasto</p>
            </div>
          </div>

          {/* Links rápidos */}
          <div className="flex flex-col gap-2">
            <Link
              href="/web/comanda"
              className="flex items-center gap-3 bg-white border border-cb-marrom/10 rounded-xl
                         px-4 py-3 text-sm font-semibold text-cb-marrom hover:bg-cb-bege transition-colors shadow-sm"
            >
              <span className="text-lg">🪑</span> Minha Comanda
            </Link>
            <Link
              href="/web/reservas"
              className="flex items-center gap-3 bg-white border border-cb-marrom/10 rounded-xl
                         px-4 py-3 text-sm font-semibold text-cb-marrom hover:bg-cb-bege transition-colors shadow-sm"
            >
              <span className="text-lg">📅</span> Minhas Reservas
            </Link>
            <Link
              href="/web/cardapio"
              className="flex items-center gap-3 bg-cb-marrom text-cb-bege rounded-xl
                         px-4 py-3 text-sm font-bold hover:bg-cb-marrom/90 transition-colors"
            >
              <span className="text-lg">☕</span> Fazer Pedido
            </Link>
          </div>
        </div>

        {/* Histórico de pedidos */}
        <div>
          <p className="font-extrabold text-cb-marrom mb-3">Histórico de pedidos</p>

          {pedidos.length === 0 ? (
            <div className="bg-cb-bege/50 rounded-2xl p-8 text-center text-cb-marrom/40 text-sm">
              Nenhum pedido ainda
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pedidos.map(function (pedido) {
                var dataFmt = new Date(pedido.criadoEm).toLocaleString("pt-BR", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                });
                var itensResumo = pedido.itens
                  .slice(0, 3)
                  .map(function (i) { return `${i.quantidade}× ${i.produto.nome}`; })
                  .join(", ");
                if (pedido.itens.length > 3) itensResumo += ` +${pedido.itens.length - 3}`;

                return (
                  <Link
                    key={pedido.id}
                    href={`/web/pedido/${pedido.id}`}
                    className="bg-white border border-cb-marrom/10 rounded-2xl p-4 shadow-sm
                               hover:shadow-md transition-shadow block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-cb-marrom text-sm">{pedido.senha}</span>
                        <StatusBadge status={pedido.status} />
                      </div>
                      <span className="font-extrabold text-cb-amber text-sm shrink-0">
                        {formatarMoeda(Number(pedido.total))}
                      </span>
                    </div>
                    <p className="text-cb-marrom/50 text-xs truncate">{itensResumo}</p>
                    <p className="text-cb-marrom/30 text-xs mt-1">{dataFmt}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
