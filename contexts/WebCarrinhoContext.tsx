"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";

export interface ItemWebCarrinho {
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  fotoUrl?: string | null;
}

type CarrinhoAction =
  | { type: "ADICIONAR"; item: ItemWebCarrinho }
  | { type: "ALTERAR_QTD"; produtoId: string; quantidade: number }
  | { type: "REMOVER"; produtoId: string }
  | { type: "LIMPAR" }
  | { type: "CARREGAR"; itens: ItemWebCarrinho[] };

interface CarrinhoState {
  itens: ItemWebCarrinho[];
  hidratado: boolean;
}

function reducer(state: CarrinhoState, action: CarrinhoAction): CarrinhoState {
  switch (action.type) {
    case "CARREGAR":
      return { ...state, itens: action.itens, hidratado: true };

    case "ADICIONAR": {
      const existe = state.itens.findIndex((i) => i.produtoId === action.item.produtoId);
      if (existe >= 0) {
        const novos = state.itens.map((i, idx) =>
          idx === existe ? { ...i, quantidade: i.quantidade + action.item.quantidade } : i
        );
        return { ...state, itens: novos };
      }
      return { ...state, itens: [...state.itens, action.item] };
    }

    case "ALTERAR_QTD": {
      if (action.quantidade <= 0) {
        return { ...state, itens: state.itens.filter((i) => i.produtoId !== action.produtoId) };
      }
      return {
        ...state,
        itens: state.itens.map((i) =>
          i.produtoId === action.produtoId ? { ...i, quantidade: action.quantidade } : i
        ),
      };
    }

    case "REMOVER":
      return { ...state, itens: state.itens.filter((i) => i.produtoId !== action.produtoId) };

    case "LIMPAR":
      return { ...state, itens: [] };

    default:
      return state;
  }
}

interface WebCarrinhoContextValue {
  itens: ItemWebCarrinho[];
  totalItens: number;
  totalValor: number;
  hidratado: boolean;
  adicionarItem: (item: ItemWebCarrinho) => void;
  alterarQuantidade: (produtoId: string, quantidade: number) => void;
  removerItem: (produtoId: string) => void;
  limparCarrinho: () => void;
}

const WebCarrinhoContext = createContext<WebCarrinhoContextValue | null>(null);

const STORAGE_KEY = "cb_web_carrinho";

export function WebCarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { itens: [], hidratado: false });

  // Hidratar do localStorage na montagem
  useEffect(function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "CARREGAR", itens: JSON.parse(raw) });
      else dispatch({ type: "CARREGAR", itens: [] });
    } catch {
      dispatch({ type: "CARREGAR", itens: [] });
    }
  }, []);

  // Persistir no localStorage a cada mudança
  useEffect(function () {
    if (!state.hidratado) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.itens));
    } catch {}
  }, [state.itens, state.hidratado]);

  const adicionarItem = useCallback((item: ItemWebCarrinho) => {
    dispatch({ type: "ADICIONAR", item });
  }, []);

  const alterarQuantidade = useCallback((produtoId: string, quantidade: number) => {
    dispatch({ type: "ALTERAR_QTD", produtoId, quantidade });
  }, []);

  const removerItem = useCallback((produtoId: string) => {
    dispatch({ type: "REMOVER", produtoId });
  }, []);

  const limparCarrinho = useCallback(() => {
    dispatch({ type: "LIMPAR" });
  }, []);

  const totalItens = state.itens.reduce((s, i) => s + i.quantidade, 0);
  const totalValor = state.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  return (
    <WebCarrinhoContext.Provider
      value={{
        itens: state.itens,
        totalItens,
        totalValor,
        hidratado: state.hidratado,
        adicionarItem,
        alterarQuantidade,
        removerItem,
        limparCarrinho,
      }}
    >
      {children}
    </WebCarrinhoContext.Provider>
  );
}

export function useWebCarrinho(): WebCarrinhoContextValue {
  const ctx = useContext(WebCarrinhoContext);
  if (!ctx) throw new Error("useWebCarrinho deve ser usado dentro de WebCarrinhoProvider");
  return ctx;
}
