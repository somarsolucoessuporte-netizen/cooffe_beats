"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Config = {
  id?: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string;
  emailContato?: string;
  site?: string;
  inscricaoEstadual?: string;
  regimeTributario?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logoUrl?: string;
  bgUrl?: string;
  corPrimaria?: string;
  corSecundaria?: string;
  mensagemCupom?: string;
  mensagemEspera?: string;
  tempoMedioMinutos?: number;
  prefixoSenha?: string;
};

const ABAS = ["Dados", "Endereço", "Operação", "Visual"] as const;
type Aba = typeof ABAS[number];

export default function ConfiguracoesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const perfil = (session?.user as { perfil?: string } | undefined)?.perfil;

  const [aba, setAba] = useState<Aba>("Dados");
  const [config, setConfig] = useState<Config>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (perfil && perfil !== "ADMIN") { router.push("/dashboard"); return; }
  }, [perfil, router]);

  useEffect(() => {
    fetch("/api/admin/configuracoes")
      .then(r => r.json())
      .then(d => { if (d.ok) setConfig(d.data); })
      .finally(() => setCarregando(false));
  }, []);

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setConfig(prev => ({
          ...prev,
          endereco: d.logradouro ?? prev.endereco,
          bairro:   d.bairro    ?? prev.bairro,
          cidade:   d.localidade ?? prev.cidade,
          estado:   d.uf        ?? prev.estado,
        }));
      }
    } catch { /* ignora */ }
    finally { setBuscandoCep(false); }
  }

  async function salvar() {
    setSalvando(true);
    setMensagem("");
    try {
      const r = await fetch("/api/admin/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      if (d.ok) {
        setMensagem("Configurações salvas com sucesso!");
        setConfig(d.data);
      } else {
        setMensagem("Erro: " + d.error);
      }
    } catch {
      setMensagem("Erro ao salvar.");
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagem(""), 4000);
    }
  }

  function campo(label: string, key: keyof Config, tipo: string = "text", placeholder?: string) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-cb-marrom/70">{label}</label>
        <input
          type={tipo}
          className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                     focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white"
          value={(config[key] as string) ?? ""}
          placeholder={placeholder}
          onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
        />
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64 text-cb-marrom/50">
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-cb-marrom">Configurações da Empresa</h1>
        <p className="text-cb-marrom/60 text-sm mt-1">Dados institucionais, endereço, operação e visual do sistema.</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-cb-marrom/5 rounded-2xl p-1">
        {ABAS.map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              aba === a
                ? "bg-white shadow text-cb-marrom"
                : "text-cb-marrom/50 hover:text-cb-marrom"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-6 flex flex-col gap-4">

        {aba === "Dados" && (
          <>
            <h2 className="font-semibold text-cb-marrom">Dados da Empresa</h2>
            {campo("Nome Fantasia", "nomeFantasia", "text", "Ex: Coffee & Beats")}
            {campo("Razão Social", "razaoSocial", "text", "Ex: Coffee & Beats Ltda.")}
            {campo("CNPJ", "cnpj", "text", "00.000.000/0000-00")}
            {campo("Inscrição Estadual", "inscricaoEstadual")}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-cb-marrom/70">Regime Tributário</label>
              <select
                className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                           focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white"
                value={config.regimeTributario ?? ""}
                onChange={e => setConfig(prev => ({ ...prev, regimeTributario: e.target.value }))}
              >
                <option value="">Selecione...</option>
                <option value="MEI">MEI</option>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>
            <div className="border-t border-cb-marrom/10 pt-4 mt-2">
              <h3 className="font-medium text-cb-marrom/80 mb-3 text-sm">Contato</h3>
              <div className="grid grid-cols-2 gap-4">
                {campo("Telefone", "telefone", "tel", "(00) 0000-0000")}
                {campo("WhatsApp", "whatsapp", "tel", "(00) 90000-0000")}
              </div>
              {campo("E-mail de Contato", "emailContato", "email", "contato@empresa.com")}
              {campo("Site", "site", "url", "https://www.empresa.com.br")}
            </div>
          </>
        )}

        {aba === "Endereço" && (
          <>
            <h2 className="font-semibold text-cb-marrom">Endereço</h2>
            <div className="flex gap-3 items-end">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-cb-marrom/70">CEP</label>
                <input
                  type="text"
                  maxLength={9}
                  className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                             focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white"
                  value={config.cep ?? ""}
                  placeholder="00000-000"
                  onChange={e => setConfig(prev => ({ ...prev, cep: e.target.value }))}
                  onBlur={e => buscarCep(e.target.value)}
                />
              </div>
              <button
                onClick={() => buscarCep(config.cep ?? "")}
                disabled={buscandoCep}
                className="px-4 py-2.5 rounded-xl bg-cb-amber text-white text-sm font-medium
                           disabled:opacity-50 hover:bg-cb-amber/90 transition-colors"
              >
                {buscandoCep ? "..." : "Buscar"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">{campo("Logradouro", "endereco")}</div>
              {campo("Número", "numero")}
            </div>
            {campo("Complemento", "complemento", "text", "Apto, Sala, etc.")}
            {campo("Bairro", "bairro")}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">{campo("Cidade", "cidade")}</div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-cb-marrom/70">UF</label>
                <select
                  className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                             focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white"
                  value={config.estado ?? ""}
                  onChange={e => setConfig(prev => ({ ...prev, estado: e.target.value }))}
                >
                  <option value="">--</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {aba === "Operação" && (
          <>
            <h2 className="font-semibold text-cb-marrom">Operação do Totem</h2>
            <div className="grid grid-cols-2 gap-4">
              {campo("Prefixo da Senha", "prefixoSenha", "text", "CB")}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-cb-marrom/70">Tempo Médio (minutos)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                             focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white"
                  value={config.tempoMedioMinutos ?? 5}
                  onChange={e => setConfig(prev => ({ ...prev, tempoMedioMinutos: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-cb-marrom/70">Mensagem de Espera</label>
              <textarea
                rows={2}
                className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                           focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white resize-none"
                value={config.mensagemEspera ?? ""}
                onChange={e => setConfig(prev => ({ ...prev, mensagemEspera: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-cb-marrom/70">Mensagem do Cupom</label>
              <textarea
                rows={2}
                className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                           focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white resize-none"
                value={config.mensagemCupom ?? ""}
                placeholder="Obrigado pela preferência! Volte sempre ☕"
                onChange={e => setConfig(prev => ({ ...prev, mensagemCupom: e.target.value }))}
              />
            </div>
          </>
        )}

        {aba === "Visual" && (
          <>
            <h2 className="font-semibold text-cb-marrom">Visual e Identidade</h2>
            {campo("URL da Logo", "logoUrl", "url", "https://...")}
            {campo("URL do Fundo (Totem)", "bgUrl", "url", "https://...")}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-cb-marrom/70">Cor Primária</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 rounded-lg border border-cb-marrom/20 cursor-pointer"
                    value={config.corPrimaria ?? "#C8853A"}
                    onChange={e => setConfig(prev => ({ ...prev, corPrimaria: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="flex-1 border border-cb-marrom/20 rounded-xl px-3 py-2 text-cb-marrom
                               focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white text-sm"
                    value={config.corPrimaria ?? "#C8853A"}
                    onChange={e => setConfig(prev => ({ ...prev, corPrimaria: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-cb-marrom/70">Cor Secundária</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 rounded-lg border border-cb-marrom/20 cursor-pointer"
                    value={config.corSecundaria ?? "#1A0A00"}
                    onChange={e => setConfig(prev => ({ ...prev, corSecundaria: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="flex-1 border border-cb-marrom/20 rounded-xl px-3 py-2 text-cb-marrom
                               focus:outline-none focus:ring-2 focus:ring-cb-amber/50 bg-white text-sm"
                    value={config.corSecundaria ?? "#1A0A00"}
                    onChange={e => setConfig(prev => ({ ...prev, corSecundaria: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex items-center gap-4">
        <button
          onClick={salvar}
          disabled={salvando}
          className="px-8 py-3 rounded-2xl bg-cb-amber text-white font-bold text-sm
                     hover:bg-cb-amber/90 disabled:opacity-50 transition-colors"
        >
          {salvando ? "Salvando..." : "Salvar Configurações"}
        </button>
        {mensagem && (
          <p className={`text-sm font-medium ${mensagem.startsWith("Erro") ? "text-red-500" : "text-green-600"}`}>
            {mensagem}
          </p>
        )}
      </div>
    </div>
  );
}
