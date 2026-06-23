"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";

type Form = {
  sumupClientId:     string;
  sumupClientSecret: string;
  sumupMerchantCode: string;
  sumupAffiliateKey: string;
  sumupOnlineAtivo:  boolean;
  configurado:       boolean;
};

export default function PagamentoConfigPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const perfil = (session?.user as { perfil?: string } | undefined)?.perfil;

  const [form,      setForm]      = useState<Form>({
    sumupClientId: "", sumupClientSecret: "", sumupMerchantCode: "",
    sumupAffiliateKey: "", sumupOnlineAtivo: false, configurado: false,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [testando,   setTestando]   = useState(false);
  const [msg,        setMsg]        = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (perfil && perfil !== "ADMIN") { router.push("/dashboard"); return; }
  }, [perfil, router]);

  useEffect(() => {
    fetch("/api/admin/configuracoes/sumup")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setForm((f) => ({ ...f, ...d.data })); })
      .finally(() => setCarregando(false));
  }, []);

  function feedback(texto: string, ok: boolean) {
    setMsg({ texto, ok });
    setTimeout(() => setMsg(null), 5000);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/configuracoes/sumup", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const d = await r.json();
      if (d.ok) {
        feedback("Configurações salvas com sucesso!", true);
        // Recarrega para atualizar o badge
        const r2 = await fetch("/api/admin/configuracoes/sumup");
        const d2 = await r2.json();
        if (d2.ok) setForm((f) => ({ ...f, ...d2.data }));
      } else {
        feedback(d.error ?? "Erro ao salvar.", false);
      }
    } catch {
      feedback("Erro de conexão.", false);
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    setTestando(true);
    try {
      const r = await fetch("/api/admin/configuracoes/sumup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          clientId:     form.sumupClientId,
          clientSecret: form.sumupClientSecret,
        }),
      });
      const d = await r.json();
      feedback(d.ok ? (d.data?.mensagem ?? "Conexão OK!") : (d.error ?? "Falhou"), d.ok);
    } catch {
      feedback("Erro ao testar conexão.", false);
    } finally {
      setTestando(false);
    }
  }

  function campo(label: string, key: keyof Form, tipo: "text" | "password" = "text", hint?: string) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-cb-marrom/70">{label}</label>
        {hint && <p className="text-xs text-cb-marrom/40">{hint}</p>}
        <input
          type={tipo}
          autoComplete="off"
          className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                     focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white font-mono text-sm"
          value={form[key] as string}
          placeholder={tipo === "password" ? "••••••••••••••••" : ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  if (carregando) {
    return <div className="flex items-center justify-center h-64 text-cb-marrom/50">Carregando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/configuracoes" className="text-cb-marrom/40 hover:text-cb-marrom text-sm">
              ← Configurações
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-cb-marrom">Pagamentos Online</h1>
          <p className="text-cb-marrom/60 text-sm mt-1">
            Integração SumUp para checkout no portal web do cliente.
          </p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${
          form.sumupOnlineAtivo
            ? "bg-green-100 text-green-700"
            : form.configurado
              ? "bg-amber-100 text-amber-700"
              : "bg-cb-marrom/10 text-cb-marrom/50"
        }`}>
          {form.sumupOnlineAtivo ? "✓ Ativo" : form.configurado ? "Configurado / Inativo" : "Não configurado"}
        </span>
      </div>

      {/* URL do Webhook */}
      <div className="bg-cb-bege/50 border border-cb-marrom/10 rounded-2xl p-4">
        <p className="text-xs font-bold text-cb-marrom/50 uppercase tracking-wider mb-1">
          URL do Webhook (configurar no painel SumUp)
        </p>
        <code className="text-xs text-cb-marrom bg-white border border-cb-marrom/10 rounded-lg
                         px-3 py-2 block break-all select-all">
          {BASE_URL}/api/web/pagamento/sumup/webhook
        </code>
        <p className="text-xs text-cb-marrom/40 mt-2">
          Em <strong>developer.sumup.com</strong> → Webhooks → adicionar esta URL com evento{" "}
          <code>checkout.payment_status</code>.
        </p>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-6 flex flex-col gap-5">
        <h2 className="font-semibold text-cb-marrom">Credenciais de API</h2>

        {campo("Client ID", "sumupClientId", "text",
          "Encontrado em developer.sumup.com → API Keys")}
        {campo("Client Secret", "sumupClientSecret", "password",
          "Visível apenas uma vez ao criar a chave")}
        {campo("Merchant Code", "sumupMerchantCode", "text",
          "Código do estabelecimento (ex: M12345678)")}
        {campo("Affiliate Key", "sumupAffiliateKey", "text",
          "Opcional — usado para validar assinatura dos webhooks")}

        <div className="border-t border-cb-marrom/10 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-cb-marrom text-sm">Ativar pagamento online</p>
              <p className="text-xs text-cb-marrom/40 mt-0.5">
                Exibe botão "Pagar com SumUp" no carrinho web do cliente
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, sumupOnlineAtivo: !f.sumupOnlineAtivo }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                form.sumupOnlineAtivo ? "bg-green-500" : "bg-cb-marrom/20"
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                form.sumupOnlineAtivo ? "translate-x-6" : "translate-x-0.5"
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          msg.ok
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {msg.texto}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3">
        <button
          onClick={testar}
          disabled={testando || (!form.sumupClientId && !form.sumupClientSecret)}
          className="px-5 py-2.5 rounded-xl border-2 border-cb-marrom/20 text-cb-marrom text-sm
                     font-semibold hover:border-cb-marrom/40 transition-colors disabled:opacity-40"
        >
          {testando ? "Testando..." : "Testar conexão"}
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="px-8 py-2.5 rounded-xl bg-cb-amber text-white font-bold text-sm
                     hover:bg-cb-amber/90 disabled:opacity-50 transition-colors"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
