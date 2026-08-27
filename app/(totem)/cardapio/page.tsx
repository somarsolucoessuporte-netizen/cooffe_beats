"use client";

import { useEffect, useState } from "react";
import SidebarCategorias from "@/components/totem/SidebarCategorias";
import TopbarCardapio from "@/components/totem/TopbarCardapio";
import GradeProdutos from "@/components/totem/GradeProdutos";

interface Categoria {
  id: string;
  nome: string;
  emoji: string;
  ordem: number;
}

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: string;
  fotoUrl: string | null;
  destaque: boolean;
  categoriaId: string;
}

// TODO: o schema ainda não tem um campo tipo `visivelTotem` em Categoria.
// Enquanto isso não existir, escondemos "Adicionais" do totem filtrando por nome.
const CATEGORIAS_OCULTAS_TOTEM = ["Adicionais"];

export default function Cardapio() {
  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    fetch(`/api/categorias?empresaId=${empresaId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.data.length > 0) {
          const visiveis: Categoria[] = res.data.filter(
            (c: Categoria) => !CATEGORIAS_OCULTAS_TOTEM.includes(c.nome)
          );
          setCategorias(visiveis);
          if (visiveis.length > 0) setCategoriaAtiva(visiveis[0].id);
        }
      });
  }, [empresaId]);

  useEffect(() => {
    if (!categoriaAtiva || !empresaId) return;
    setCarregando(true);
    fetch(`/api/produtos?empresaId=${empresaId}&categoriaId=${categoriaAtiva}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setProdutos(res.data);
      })
      .finally(() => setCarregando(false));
  }, [categoriaAtiva, empresaId]);

  const nomeCategoriaAtiva =
    categorias.find((c) => c.id === categoriaAtiva)?.nome ?? "";

  return (
    <div className="h-full flex overflow-hidden animate-fadeIn">
      <SidebarCategorias
        categorias={categorias}
        categoriaAtiva={categoriaAtiva}
        onChange={setCategoriaAtiva}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopbarCardapio nomeCategoriaAtiva={nomeCategoriaAtiva} />
        <GradeProdutos produtos={produtos} carregando={carregando} />
      </div>
    </div>
  );
}
