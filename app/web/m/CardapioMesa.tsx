"use client";

import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import MobileSplash from "@/components/web/MobileSplash";
import MobileCardapio, { type CategoriaMobile, type ProdutoMobile } from "@/components/web/MobileCardapio";
import { useCarrinhoWebMobile } from "@/components/web/carrinhoWebMobile";
import { buscarRotuloMesa, gravarSessaoMesa, lerSessaoMesa } from "@/lib/sessao-mesa";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

interface Props {
  categorias:         CategoriaMobile[];
  produtosIniciais:   ProdutoMobile[];
  categoriaInicialId: string;
  mesaQuery:          string;
  clienteQuery:       string;
  wppQuery:           string;
}

type Estado = "carregando" | "ok" | "sem-mesa";

export default function CardapioMesa({
  categorias, produtosIniciais, categoriaInicialId, mesaQuery, clienteQuery, wppQuery,
}: Props) {
  const carrinho = useCarrinhoWebMobile();
  const [estado,     setEstado]     = useState<Estado>("carregando");
  const [nome,       setNome]       = useState("");
  const [rotuloMesa, setRotuloMesa] = useState("");

  useEffect(function () {
    let cancelado = false;

    async function iniciar() {
      // Mesa: query (?mesa=) tem prioridade sobre a sessão
      if (mesaQuery) gravarSessaoMesa("mesaId", mesaQuery);
      const sessao = lerSessaoMesa();
      if (!sessao.mesaId) { setEstado("sem-mesa"); return; }

      // Cliente informado por query (?cliente=&wpp=) e ainda não registrado nesta sessão
      const wppLimpo = wppQuery.replace(/\D/g, "");
      if (clienteQuery && wppLimpo && wppLimpo !== sessao.clienteWpp) {
        try {
          const r = await fetch("/api/clientes", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ empresaId: EMPRESA_ID, nome: clienteQuery, whatsapp: wppLimpo }),
          });
          const d = await r.json();
          if (d.ok) {
            gravarSessaoMesa("clienteId",   d.data.id);
            gravarSessaoMesa("clienteNome", d.data.nome);
            gravarSessaoMesa("clienteWpp",  d.data.whatsapp);
          }
        } catch {}
      } else if (clienteQuery && !sessao.clienteNome) {
        gravarSessaoMesa("clienteNome", clienteQuery);
      }

      const rotulo = await buscarRotuloMesa(sessao.mesaId);
      if (cancelado) return;
      if (rotulo === null) { setEstado("sem-mesa"); return; }

      setNome(lerSessaoMesa().clienteNome);
      setRotuloMesa(rotulo);
      setEstado("ok");
    }

    iniciar();
    return function () { cancelado = true; };
  }, [mesaQuery, clienteQuery, wppQuery]);

  // Sem mesa identificada: orienta a escanear o QR da mesa
  if (estado === "sem-mesa") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#F6F0E5]">
        <QrCode size={56} className="text-[#C8A96E]" />
        <h1 className="text-xl font-extrabold text-[#3B2415]">Escaneie o QR Code da sua mesa</h1>
        <p className="text-sm text-[#3B2415]/60">
          Aponte a câmera do celular para o QR Code que está na mesa para fazer seu pedido.
        </p>
      </div>
    );
  }

  return (
    <>
      <MobileSplash sempre />
      <MobileCardapio
        carrinho={carrinho}
        categorias={categorias}
        produtosIniciais={produtosIniciais}
        categoriaInicialId={categoriaInicialId}
        nomeCliente={nome}
        rotuloMesa={rotuloMesa}
        carrinhoHref="/web/m/carrinho"
      />
    </>
  );
}
