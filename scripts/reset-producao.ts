/**
 * Limpa os dados de teste do banco antes de colocar o sistema em produção.
 *
 *   npx tsx scripts/reset-producao.ts             → só mostra as contagens (dry-run)
 *   npx tsx scripts/reset-producao.ts --confirmar → faz backup JSON em backups/ e apaga
 *
 * Apaga: itens/adicionais de pedido, pagamentos, pedidos, clientes, sessões de
 * checkout web, carrinhos abandonados, logs, agendamentos e caixas; zera senhaAtual.
 * Mantém: empresa, usuários, categorias, produtos, adicionais, mesas, cupons,
 * configurações, canais de venda, insumos e movimentações de estoque.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirmar = process.argv.includes("--confirmar");

async function contagens() {
  const [itemAdicional, itemPedido, pagamento, pedido, cliente, checkoutSessao,
         carrinhoAbandonado, log, agendamento, caixa] = await Promise.all([
    prisma.itemAdicional.count(),
    prisma.itemPedido.count(),
    prisma.pagamento.count(),
    prisma.pedido.count(),
    prisma.cliente.count(),
    prisma.checkoutSessao.count(),
    prisma.carrinhoAbandonado.count(),
    prisma.log.count(),
    prisma.agendamento.count(),
    prisma.caixa.count(),
  ]);
  return { itemAdicional, itemPedido, pagamento, pedido, cliente, checkoutSessao,
           carrinhoAbandonado, log, agendamento, caixa };
}

async function mantidos() {
  const [empresa, usuario, categoria, produto, adicional, produtoAdicional, mesa, cupom, configuracao] =
    await Promise.all([
      prisma.empresa.count(),
      prisma.usuario.count(),
      prisma.categoria.count(),
      prisma.produto.count(),
      prisma.adicional.count(),
      prisma.produtoAdicional.count(),
      prisma.mesa.count(),
      prisma.cupom.count(),
      prisma.configuracao.count(),
    ]);
  return { empresa, usuario, categoria, produto, adicional, produtoAdicional, mesa, cupom, configuracao };
}

async function backup() {
  const dados = {
    geradoEm:           new Date().toISOString(),
    itemAdicional:      await prisma.itemAdicional.findMany(),
    itemPedido:         await prisma.itemPedido.findMany(),
    pagamento:          await prisma.pagamento.findMany(),
    pedido:             await prisma.pedido.findMany(),
    cliente:            await prisma.cliente.findMany(),
    checkoutSessao:     await prisma.checkoutSessao.findMany(),
    carrinhoAbandonado: await prisma.carrinhoAbandonado.findMany(),
    log:                await prisma.log.findMany(),
    agendamento:        await prisma.agendamento.findMany(),
    caixa:              await prisma.caixa.findMany(),
    configuracao:       await prisma.configuracao.findMany({ select: { id: true, empresaId: true, senhaAtual: true } }),
  };
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const arquivo = join(dir, `reset-producao-${dados.geradoEm.replace(/[:.]/g, "-")}.json`);
  writeFileSync(arquivo, JSON.stringify(dados, null, 2));
  return arquivo;
}

async function main() {
  console.log("Registros a apagar:", await contagens());
  console.log("Registros mantidos:", await mantidos());

  if (!confirmar) {
    console.log("\nDry-run — nada foi apagado. Rode com --confirmar para executar.");
    return;
  }

  const arquivo = await backup();
  console.log("\nBackup salvo em", arquivo);

  // Ordem respeita as foreign keys (filhos antes dos pais)
  await prisma.$transaction([
    prisma.itemAdicional.deleteMany(),
    prisma.itemPedido.deleteMany(),
    prisma.pagamento.deleteMany(),
    prisma.pedido.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.checkoutSessao.deleteMany(),
    prisma.carrinhoAbandonado.deleteMany(),
    prisma.log.deleteMany(),
    prisma.agendamento.deleteMany(),
    prisma.caixa.deleteMany(),
    prisma.configuracao.updateMany({ data: { senhaAtual: 0 } }),
  ]);

  console.log("\nDepois da limpeza:", await contagens());
  console.log("Mantidos:", await mantidos());
  console.log("senhaAtual:", await prisma.configuracao.findMany({ select: { empresaId: true, senhaAtual: true } }));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
