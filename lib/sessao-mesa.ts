"use client";

// Sessão do cliente da mesa no sessionStorage — mesmas chaves usadas pelo totem
// (/mesa/[mesaId] grava mesaId, clienteId, clienteNome e clienteWpp)

export interface SessaoMesa {
  mesaId:      string;
  clienteId:   string;
  clienteNome: string;
  clienteWpp:  string;
}

function ler(chave: string): string {
  try { return sessionStorage.getItem(chave) ?? ""; } catch { return ""; }
}

export function gravarSessaoMesa(chave: keyof SessaoMesa, valor: string) {
  try { sessionStorage.setItem(chave, valor); } catch {}
}

export function lerSessaoMesa(): SessaoMesa {
  return {
    mesaId:      ler("mesaId"),
    clienteId:   ler("clienteId"),
    clienteNome: ler("clienteNome"),
    clienteWpp:  ler("clienteWpp"),
  };
}

// Rótulo da mesa ("Mesa 5" ou "Mesa 5 · Varanda"); null se a mesa não existe/inativa
export async function buscarRotuloMesa(mesaId: string): Promise<string | null> {
  try {
    const r = await fetch("/api/admin/mesas/" + mesaId + "/info");
    const d = await r.json();
    if (!d.ok) return null;
    const numero = "Mesa " + d.data.numero;
    return d.data.nome && d.data.nome !== numero ? numero + " · " + d.data.nome : numero;
  } catch {
    return "";  // falha de rede: segue sem rótulo
  }
}
