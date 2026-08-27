/**
 * Atualiza o cardápio real da Coffee & Beats a partir de scripts/cardapio/cardapio-novo.json.
 * Usa a REST API do Supabase (service_role) em vez de conexão direta Postgres,
 * pois a porta do pooler (5432/6543) está bloqueada nesta rede.
 *
 * Uso: npx tsx scripts/cardapio/atualizar-cardapio.ts           (dry-run, so mostra o que seria feito)
 *      npx tsx scripts/cardapio/atualizar-cardapio.ts --apply    (aplica de verdade)
 */
import { readFileSync } from "fs";
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";

const EMPRESA_ID = "cmq90dfai0000n903n5x5zt91";
const APLICAR = process.argv.includes("--apply");

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const menu = JSON.parse(readFileSync("scripts/cardapio/cardapio-novo.json", "utf8"));

const EMOJIS: Record<string, string> = {
  cafes: "☕",
  "chocolate-quente": "🍫",
  "soda-italiana": "🥤",
  entradinhas: "🥟",
  cuscuz: "🌽",
  tapiocas: "🫓",
  "salgados-fit": "🥙",
  crepiocas: "🥞",
  omeletes: "🍳",
  "pao-de-queijo": "🧀",
  sanduiches: "🥪",
  croissants: "🥐",
  doces: "🍰",
  adicionais: "➕",
};

type CategoriaRow = { id: string; empresaId: string; nome: string; emoji: string; ordem: number; ativo: boolean };
type ProdutoRow = {
  id: string;
  empresaId: string;
  categoriaId: string;
  nome: string;
  descricao: string;
  preco: number;
  fotoUrl: null;
  destaque: boolean;
  disponivel: boolean;
  ordem: number;
};

const categorias: CategoriaRow[] = [];
const produtos: ProdutoRow[] = [];

menu.categorias.forEach((cat: any, catIdx: number) => {
  const categoriaId = `cat-${cat.id}-${EMPRESA_ID}`;
  categorias.push({
    id: categoriaId,
    empresaId: EMPRESA_ID,
    nome: cat.nome,
    emoji: EMOJIS[cat.id] ?? "🍽️",
    ordem: catIdx + 1,
    ativo: true,
  });

  let ordem = 0;

  if (Array.isArray(cat.itens)) {
    for (const item of cat.itens) {
      produtos.push({
        id: `prod-${item.id}-${EMPRESA_ID}`,
        empresaId: EMPRESA_ID,
        categoriaId,
        nome: item.nome,
        descricao: item.descricao ?? "",
        preco: item.preco,
        fotoUrl: null,
        destaque: false,
        disponivel: true,
        ordem: ordem++,
      });
    }
  }

  if (Array.isArray(cat.subcategorias)) {
    for (const sub of cat.subcategorias) {
      if (Array.isArray(sub.itens)) {
        for (const item of sub.itens) {
          produtos.push({
            id: `prod-${item.id}-${EMPRESA_ID}`,
            empresaId: EMPRESA_ID,
            categoriaId,
            nome: `${sub.nome} – ${item.nome}`,
            descricao: item.descricao ?? "",
            preco: item.preco,
            fotoUrl: null,
            destaque: false,
            disponivel: true,
            ordem: ordem++,
          });
        }
      } else if (Array.isArray(sub.sabores)) {
        const descricaoPartes = [`Porção com ${sub.porcao}.`];
        if (sub.sabores.length > 0) {
          descricaoPartes.push(`Sabores: ${sub.sabores.join(", ")}.`);
        }
        produtos.push({
          id: `prod-${sub.id}-${EMPRESA_ID}`,
          empresaId: EMPRESA_ID,
          categoriaId,
          nome: sub.nome,
          descricao: descricaoPartes.join(" "),
          preco: sub.preco_porcao,
          fotoUrl: null,
          destaque: false,
          disponivel: true,
          ordem: ordem++,
        });
      }
    }
  }
});

async function main() {
  console.log(`Cardápio: ${categorias.length} categorias, ${produtos.length} produtos.\n`);

  if (!APLICAR) {
    console.log("== DRY RUN (nada será gravado; rode com --apply para aplicar) ==\n");
    for (const c of categorias) {
      const prods = produtos.filter((p) => p.categoriaId === c.id);
      console.log(`${c.emoji} ${c.nome} (${prods.length} itens)`);
      for (const p of prods) console.log(`   - ${p.nome} — R$ ${p.preco.toFixed(2)}`);
    }
    return;
  }

  console.log("Desativando categorias/produtos antigos (placeholder do seed)...");
  const { error: errCatDesat } = await supabaseAdmin
    .from("Categoria")
    .update({ ativo: false })
    .eq("empresaId", EMPRESA_ID)
    .not("id", "in", `(${categorias.map((c) => `"${c.id}"`).join(",")})`);
  if (errCatDesat) throw errCatDesat;

  const { error: errProdDesat } = await supabaseAdmin
    .from("Produto")
    .update({ disponivel: false })
    .eq("empresaId", EMPRESA_ID)
    .not("id", "in", `(${produtos.map((p) => `"${p.id}"`).join(",")})`);
  if (errProdDesat) throw errProdDesat;

  console.log("Gravando categorias novas...");
  const { error: errCat } = await supabaseAdmin
    .from("Categoria")
    .upsert(categorias, { onConflict: "id" });
  if (errCat) throw errCat;

  console.log("Gravando produtos novos...");
  const { error: errProd } = await supabaseAdmin
    .from("Produto")
    .upsert(produtos, { onConflict: "id" });
  if (errProd) throw errProd;

  console.log(`\n✅ Cardápio atualizado: ${categorias.length} categorias, ${produtos.length} produtos.`);
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
