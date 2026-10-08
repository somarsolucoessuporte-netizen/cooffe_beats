"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";

export interface AdicionalWebCarrinho {
  adicionalId: string;
  nome: string;
  preco: number;
}

export interface ItemWebCarrinho {
  produtoId: string;
  nome: string;
  preco: number;            // preço unitário já somando os adicionais
  quantidade: number;
  fotoUrl?: string | null;
  adicionais?: AdicionalWebCarrinho[];
  chave?: string;           // identifica a linha (produto + adicionais escolhidos)
}

// Chave da linha do carrinho — itens antigos (sem chave) usam o produtoId
export function chaveItem(item: ItemWebCarrinho): string {
  if (item.chave) return item.chave;
  var ids = (item.adicionais ?? []).map(function (a) { return a.adicionalId; }).sort();
  return ids.length ? item.produtoId + "|" + ids.join(",") : item.produtoId;
}

type CarrinhoAction =
  | { type: "ADICIONAR"; item: ItemWebCarrinho }
  | { type: "ALTERAR_QTD"; chave: string; quantidade: number }
  | { type: "REMOVER"; chave: string }
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
      const chave = chaveItem(action.item);
      const existe = state.itens.findIndex((i) => chaveItem(i) === chave);
      if (existe >= 0) {
        const novos = state.itens.map((i, idx) =>
          idx === existe ? { ...i, quantidade: i.quantidade + action.item.quantidade } : i
        );
        return { ...state, itens: novos };
      }
      return { ...state, itens: [...state.itens, { ...action.item, chave }] };
    }

    case "ALTERAR_QTD": {
      if (action.quantidade <= 0) {
        return { ...state, itens: state.itens.filter((i) => chaveItem(i) !== action.chave) };
      }
      return {
        ...state,
        itens: state.itens.map((i) =>
          chaveItem(i) === action.chave ? { ...i, quantidade: action.quantidade } : i
        ),
      };
    }

    case "REMOVER":
      return { ...state, itens: state.itens.filter((i) => chaveItem(i) !== action.chave) };

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
  alterarQuantidade: (chave: string, quantidade: number) => void;
  removerItem: (chave: string) => void;
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

  const alterarQuantidade = useCallback((chave: string, quantidade: number) => {
    dispatch({ type: "ALTERAR_QTD", chave, quantidade });
  }, []);

  const removerItem = useCallback((chave: string) => {
    dispatch({ type: "REMOVER", chave });
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
