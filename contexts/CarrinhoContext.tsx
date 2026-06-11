"use client";

import React, { createContext, useContext, useReducer, useCallback } from "react";

export interface ItemAdicional {
  adicionalId: string;
  nome: string;
  preco: number;
}

export interface ItemCarrinho {
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  observacao?: string;
  adicionais: ItemAdicional[];
  fotoUrl?: string | null;
}

interface CarrinhoState {
  itens: ItemCarrinho[];
  empresaId: string;
}

type CarrinhoAction =
  | { type: "ADICIONAR"; item: ItemCarrinho }
  | { type: "REMOVER"; produtoId: string; index: number }
  | { type: "ALTERAR_QTD"; index: number; quantidade: number }
  | { type: "LIMPAR" }
  | { type: "SET_EMPRESA"; empresaId: string };

function carrinhoReducer(state: CarrinhoState, action: CarrinhoAction): CarrinhoState {
  switch (action.type) {
    case "ADICIONAR":
      return { ...state, itens: [...state.itens, action.item] };

    case "REMOVER": {
      const novos = state.itens.filter((_, i) => i !== action.index);
      return { ...state, itens: novos };
    }

    case "ALTERAR_QTD": {
      const novos = state.itens.map((item, i) =>
        i === action.index ? { ...item, quantidade: action.quantidade } : item
      );
      return { ...state, itens: novos.filter((i) => i.quantidade > 0) };
    }

    case "LIMPAR":
      return { ...state, itens: [] };

    case "SET_EMPRESA":
      return { ...state, empresaId: action.empresaId };

    default:
      return state;
  }
}

interface CarrinhoContextValue {
  itens: ItemCarrinho[];
  empresaId: string;
  totalItens: number;
  totalValor: number;
  adicionarItem: (item: ItemCarrinho) => void;
  removerItem: (index: number) => void;
  alterarQuantidade: (index: number, quantidade: number) => void;
  limparCarrinho: () => void;
  setEmpresaId: (id: string) => void;
}

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null);

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(carrinhoReducer, {
    itens: [],
    empresaId: process.env.NEXT_PUBLIC_EMPRESA_ID ?? "",
  });

  const adicionarItem = useCallback((item: ItemCarrinho) => {
    dispatch({ type: "ADICIONAR", item });
  }, []);

  const removerItem = useCallback((index: number) => {
    dispatch({ type: "REMOVER", produtoId: state.itens[index]?.produtoId ?? "", index });
  }, [state.itens]);

  const alterarQuantidade = useCallback((index: number, quantidade: number) => {
    dispatch({ type: "ALTERAR_QTD", index, quantidade });
  }, []);

  const limparCarrinho = useCallback(() => {
    dispatch({ type: "LIMPAR" });
  }, []);

  const setEmpresaId = useCallback((id: string) => {
    dispatch({ type: "SET_EMPRESA", empresaId: id });
  }, []);

  const totalItens = state.itens.reduce((acc, i) => acc + i.quantidade, 0);
  const totalValor = state.itens.reduce((acc, item) => {
    const totalAdicionais = item.adicionais.reduce((s, a) => s + a.preco, 0);
    return acc + (item.preco + totalAdicionais) * item.quantidade;
  }, 0);

  return (
    <CarrinhoContext.Provider
      value={{
        itens: state.itens,
        empresaId: state.empresaId,
        totalItens,
        totalValor,
        adicionarItem,
        removerItem,
        alterarQuantidade,
        limparCarrinho,
        setEmpresaId,
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  );
}

export function useCarrinho(): CarrinhoContextValue {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) throw new Error("useCarrinho deve ser usado dentro de CarrinhoProvider");
  return ctx;
}
