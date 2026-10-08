"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence, motion, useDragControls, type PanInfo,
} from "framer-motion";
import {
  ArrowLeft, Cake, Check, Coffee, Cookie, Croissant, Egg, GlassWater, Minus, Plus, Salad,
  Sandwich, ShoppingCart, UtensilsCrossed, Wheat, type LucideIcon,
} from "lucide-react";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";
import { formatarMoeda } from "@/lib/utils";

// Cor principal do portal mobile (usada na animação do botão "+")
const MARROM = "#3B2415";

export interface CategoriaMobile {
  id: string;
  nome: string;
  emoji: string;
}

export interface AdicionalMobile {
  id: string;
  nome: string;
  preco: number;
}

export interface ProdutoMobile {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  fotoUrl: string | null;
  categoriaId: string;
  adicionais: AdicionalMobile[];
}

interface Props {
  categorias:         CategoriaMobile[];
  produtosIniciais:   ProdutoMobile[];
  categoriaInicialId: string;
}

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

type ProdutoApi = {
  id: string; nome: string; descricao: string; preco: string; fotoUrl: string | null; categoriaId: string;
  adicionais?: { adicional: { id: string; nome: string; preco: string; ativo: boolean } }[];
};

// Ícone Lucide por palavra-chave do nome da categoria (sem acento, minúsculo)
const ICONES_CATEGORIA: [string[], LucideIcon][] = [
  [["chocolate"],                            Coffee],
  [["soda", "suco", "bebida"],               GlassWater],
  [["cafe"],                                 Coffee],
  [["entradinha", "petisco"],                UtensilsCrossed],
  [["cuscuz", "tapioca", "crepioca"],        Wheat],
  [["fit", "salada"],                        Salad],
  [["omelete", "ovo"],                       Egg],
  [["pao de queijo", "biscoito", "cookie"],  Cookie],
  [["sanduiche", "lanche", "misto"],         Sandwich],
  [["croissant"],                            Croissant],
  [["doce", "bolo", "sobremesa", "torta"],   Cake],
];

function iconeDaCategoria(nome: string): LucideIcon | null {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const achado = ICONES_CATEGORIA.find(function ([chaves]) {
    return chaves.some(function (k) { return n.includes(k); });
  });
  return achado ? achado[1] : null;
}

// Converte o formato da /api/produtos para o formato do mobile
function mapearProduto(p: ProdutoApi): ProdutoMobile {
  return {
    id:          p.id,
    nome:        p.nome,
    descricao:   p.descricao,
    preco:       Number(p.preco),
    fotoUrl:     p.fotoUrl,
    categoriaId: p.categoriaId,
    adicionais:  (p.adicionais ?? [])
      .filter(function (pa) { return pa.adicional.ativo; })
      .map(function (pa) {
        return { id: pa.adicional.id, nome: pa.adicional.nome, preco: Number(pa.adicional.preco) };
      }),
  };
}

// Cardápio mobile (< 768px): categorias em grade → produtos → bottom sheet de adicionais
export default function MobileCardapio({ categorias, produtosIniciais, categoriaInicialId }: Props) {
  const { adicionarItem, totalItens, totalValor } = useWebCarrinho();

  const [nome,           setNome]           = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [cache,          setCache]          = useState<Record<string, ProdutoMobile[]>>(
    categoriaInicialId ? { [categoriaInicialId]: produtosIniciais } : {}
  );
  const [carregando,     setCarregando]     = useState(false);
  const [adicionado,     setAdicionado]     = useState<string | null>(null);
  const [produtoSheet,   setProdutoSheet]   = useState<ProdutoMobile | null>(null);

  // Primeiro nome do cliente para a saudação
  useEffect(function () {
    fetch("/api/web/me")
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok && d.data.nome) setNome(String(d.data.nome).split(" ")[0]); })
      .catch(function () {});
  }, []);

  async function abrirCategoria(catId: string) {
    setCategoriaAtiva(catId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (cache[catId]) return;
    setCarregando(true);
    try {
      const r = await fetch(`/api/produtos?empresaId=${EMPRESA_ID}&categoriaId=${catId}`);
      const d = await r.json();
      if (d.ok) {
        const lista = (d.data as ProdutoApi[]).map(mapearProduto);
        setCache(function (c) { return { ...c, [catId]: lista }; });
      }
    } catch {}
    finally { setCarregando(false); }
  }

  function voltarCategorias() {
    setCategoriaAtiva(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Botão "+": com adicionais abre o bottom sheet, sem adicionais adiciona direto
  function tocarMais(produto: ProdutoMobile) {
    if (produto.adicionais.length > 0) { setProdutoSheet(produto); return; }
    adicionarItem({
      produtoId:  produto.id,
      nome:       produto.nome,
      preco:      produto.preco,
      quantidade: 1,
      fotoUrl:    produto.fotoUrl,
    });
    setAdicionado(produto.id);
    setTimeout(function () { setAdicionado(null); }, 1200);
  }

  const categoria = categorias.find(function (c) { return c.id === categoriaAtiva; }) ?? null;
  const produtos  = categoriaAtiva ? cache[categoriaAtiva] ?? [] : [];

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-white">

      {/* HEADER */}
      <header className="sticky top-0 z-30 h-16 px-4 flex items-center justify-between bg-[#3B2415]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-10 h-10 object-contain" />
        <div className="flex items-center gap-4">
          {nome && <span className="text-cb-bege text-sm font-semibold truncate max-w-[160px]">Olá, {nome}!</span>}
          <Link href="/web/carrinho" aria-label="Carrinho" className="relative text-cb-bege p-1">
            <ShoppingCart size={24} />
            {totalItens > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C8A96E]
                               text-[#3B2415] text-[10px] font-bold flex items-center justify-center">
                {totalItens}
              </span>
            )}
          </Link>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {!categoria ? (
          /* GRADE DE CATEGORIAS */
          <motion.div
            key="categorias"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="px-4 pt-5 text-lg font-extrabold text-[#3B2415]">O que vai ser hoje?</h1>
            <motion.div
              className="grid grid-cols-2 gap-3 p-4"
              initial="oculto"
              animate="visivel"
              variants={{ visivel: { transition: { staggerChildren: 0.05 } } }}
            >
              {categorias.map(function (cat) {
                const ativo = cat.id === categoriaAtiva;
                const Icone = iconeDaCategoria(cat.nome);
                return (
                  <motion.button
                    key={cat.id}
                    type="button"
                    onClick={function () { abrirCategoria(cat.id); }}
                    variants={{
                      oculto:  { opacity: 0, y: 20 },
                      visivel: { opacity: 1, y: 0 },
                    }}
                    whileTap={{ scale: 0.96 }}
                    className={
                      "h-[100px] rounded-2xl border flex flex-col items-center justify-center gap-1.5 px-2 " +
                      (ativo
                        ? "bg-[#3B2415] border-[#C8A96E] text-cb-bege"
                        : "bg-[#F6F0E5] border-[#C8A96E] text-[#3B2415]")
                    }
                  >
                    {/* Ícone Lucide; sem correspondência, usa a inicial em bold */}
                    {Icone ? (
                      <Icone size={28} strokeWidth={2} color={ativo ? "#FFFFFF" : "#C8A96E"} />
                    ) : (
                      <span className={"text-[28px] font-extrabold leading-none " + (ativo ? "text-white" : "text-[#C8A96E]")}>
                        {cat.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-[15px] font-bold leading-tight text-center line-clamp-2">{cat.nome}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        ) : (
          /* LISTA DE PRODUTOS DA CATEGORIA */
          <motion.div
            key={"produtos-" + categoria.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            className={"px-4 pt-3 " + (totalItens > 0 ? "pb-24" : "pb-4")}
          >
            <motion.button
              type="button"
              onClick={voltarCategorias}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 py-2 text-sm font-bold text-[#3B2415]"
            >
              <ArrowLeft size={18} /> Categorias
            </motion.button>
            <h2 className="text-xl font-extrabold text-[#3B2415] mb-3">
              {categoria.nome}
            </h2>

            {carregando && produtos.length === 0 ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map(function (_, i) {
                  return <div key={i} className="h-[90px] rounded-2xl bg-[#F6F0E5] animate-pulse" />;
                })}
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-[#3B2415]/40">
                <Coffee size={40} />
                <p className="text-sm font-medium">Nenhum produto disponível nesta categoria.</p>
              </div>
            ) : (
              <motion.ul
                className="flex flex-col gap-3"
                initial="oculto"
                animate="visivel"
                variants={{ visivel: { transition: { staggerChildren: 0.04 } } }}
              >
                {produtos.map(function (produto) {
                  const foiAdicionado = adicionado === produto.id;
                  return (
                    <motion.li
                      key={produto.id}
                      variants={{ oculto: { opacity: 0, y: 12 }, visivel: { opacity: 1, y: 0 } }}
                      className="h-[90px] flex items-center gap-3"
                    >
                      <FotoProduto produto={produto} className="w-20 h-20 rounded-xl shrink-0" />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#3B2415] leading-snug line-clamp-1">{produto.nome}</p>
                        <p className="text-xs text-gray-500 leading-snug line-clamp-2 mt-0.5">{produto.descricao}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-[#C8A96E]">{formatarMoeda(produto.preco)}</span>
                        <motion.button
                          type="button"
                          aria-label={"Adicionar " + produto.nome}
                          onClick={function () { tocarMais(produto); }}
                          whileTap={{ scale: 0.9 }}
                          animate={{ backgroundColor: foiAdicionado ? "#16a34a" : MARROM }}
                          className="w-10 h-10 rounded-full text-white flex items-center justify-center"
                        >
                          {foiAdicionado ? <Check size={20} /> : <Plus size={20} />}
                        </motion.button>
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CARRINHO FIXO NO RODAPÉ (acima da bottom nav) */}
      <AnimatePresence>
        {totalItens > 0 && (
          <motion.div
            key="barra-carrinho"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 z-30 px-4 pb-4 bottom-[calc(64px+env(safe-area-inset-bottom))]"
          >
            <Link href="/web/carrinho">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="h-16 rounded-2xl px-4 flex items-center justify-between bg-[#3B2415]
                           shadow-[0_8px_24px_rgba(59,36,21,0.35)]"
              >
                <span className="min-w-[28px] h-7 px-2 rounded-full bg-[#C8A96E] text-[#3B2415] text-sm font-extrabold
                                 flex items-center justify-center">
                  {totalItens}
                </span>
                <span className="text-cb-bege font-bold text-[15px]">Ver meu carrinho</span>
                <span className="text-[#C8A96E] font-extrabold text-[15px]">{formatarMoeda(totalValor)}</span>
              </motion.div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM SHEET DE ADICIONAIS */}
      <AnimatePresence>
        {produtoSheet && (
          <SheetAdicionais
            key={produtoSheet.id}
            produto={produtoSheet}
            onFechar={function () { setProdutoSheet(null); }}
            onAdicionar={function (adicionaisEscolhidos, quantidade) {
              const extra = adicionaisEscolhidos.reduce(function (s, a) { return s + a.preco; }, 0);
              adicionarItem({
                produtoId:  produtoSheet.id,
                nome:       produtoSheet.nome,
                preco:      produtoSheet.preco + extra,
                quantidade,
                fotoUrl:    produtoSheet.fotoUrl,
                adicionais: adicionaisEscolhidos.map(function (a) {
                  return { adicionalId: a.id, nome: a.nome, preco: a.preco };
                }),
              });
              setProdutoSheet(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Foto do produto ou placeholder com xícara
function FotoProduto({ produto, className }: { produto: ProdutoMobile; className: string }) {
  if (produto.fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={produto.fotoUrl} alt={produto.nome} className={className + " object-cover"} />;
  }
  return (
    <div className={className + " bg-[#F6F0E5] flex items-center justify-center text-[#C8A96E]"}>
      <Coffee size={32} />
    </div>
  );
}

interface SheetProps {
  produto: ProdutoMobile;
  onFechar: () => void;
  onAdicionar: (adicionais: AdicionalMobile[], quantidade: number) => void;
}

// Bottom sheet: desliza de baixo, fecha com swipe down ou toque no overlay
function SheetAdicionais({ produto, onFechar, onAdicionar }: SheetProps) {
  const dragControls = useDragControls();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [quantidade,   setQuantidade]   = useState(1);

  // Trava o scroll da página enquanto o sheet está aberto
  useEffect(function () {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return function () { document.body.style.overflow = anterior; };
  }, []);

  const escolhidos = produto.adicionais.filter(function (a) { return selecionados.includes(a.id); });
  const unitario   = produto.preco + escolhidos.reduce(function (s, a) { return s + a.preco; }, 0);

  function alternar(id: string) {
    setSelecionados(function (atual) {
      return atual.includes(id) ? atual.filter(function (x) { return x !== id; }) : [...atual, id];
    });
  }

  function fimDoArraste(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onFechar();
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onFechar}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={produto.nome}
        className="fixed inset-x-0 bottom-0 z-50 h-[70dvh] bg-white rounded-t-[20px] flex flex-col overflow-hidden"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={fimDoArraste}
      >
        {/* Área de arraste: handle + foto */}
        <div
          className="shrink-0 touch-none"
          onPointerDown={function (e) { dragControls.start(e); }}
        >
          <div className="flex justify-center py-2.5">
            <span className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <FotoProduto produto={produto} className="w-full h-[200px]" />
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-extrabold text-[#3B2415] leading-snug">{produto.nome}</h3>
            <span className="text-base font-bold text-[#C8A96E] shrink-0">{formatarMoeda(produto.preco)}</span>
          </div>
          {produto.descricao && <p className="text-sm text-gray-500 mt-1">{produto.descricao}</p>}

          <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Adicionais</p>
          <ul className="flex flex-col divide-y divide-gray-100">
            {produto.adicionais.map(function (a) {
              const marcado = selecionados.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={function () { alternar(a.id); }}
                    className="w-full flex items-center gap-3 py-3 text-left"
                  >
                    <span
                      className={
                        "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors " +
                        (marcado ? "bg-[#3B2415] border-[#3B2415] text-white" : "border-gray-300")
                      }
                    >
                      {marcado && <Check size={16} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-[#3B2415]">{a.nome}</span>
                    <span className="text-sm text-gray-500">
                      {a.preco > 0 ? "+ " + formatarMoeda(a.preco) : "Grátis"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Contador de quantidade */}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-bold text-[#3B2415]">Quantidade</span>
            <div className="flex items-center gap-4">
              <motion.button
                type="button"
                aria-label="Diminuir"
                whileTap={{ scale: 0.9 }}
                disabled={quantidade <= 1}
                onClick={function () { setQuantidade(function (q) { return Math.max(1, q - 1); }); }}
                className="w-10 h-10 rounded-full border border-[#3B2415]/20 text-[#3B2415] flex items-center justify-center disabled:opacity-30"
              >
                <Minus size={18} />
              </motion.button>
              <span className="w-6 text-center text-lg font-extrabold text-[#3B2415]">{quantidade}</span>
              <motion.button
                type="button"
                aria-label="Aumentar"
                whileTap={{ scale: 0.9 }}
                onClick={function () { setQuantidade(function (q) { return q + 1; }); }}
                className="w-10 h-10 rounded-full bg-[#3B2415] text-white flex items-center justify-center"
              >
                <Plus size={18} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Rodapé fixo */}
        <div className="shrink-0 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] border-t border-gray-100">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={function () { onAdicionar(escolhidos, quantidade); }}
            className="w-full h-14 rounded-xl bg-[#3B2415] text-cb-bege font-bold text-[15px]"
          >
            Adicionar ao carrinho · {formatarMoeda(unitario * quantidade)}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}
