"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const NAV_OPERACAO = [
  { href: "/caixa",     label: "Caixa",       icone: "💰", perfis: ["ADMIN", "GERENTE"] },
  { href: "/pedidos",   label: "Pedidos",     icone: "📦" },
  { href: "/kds",       label: "KDS Barista", icone: "👨‍🍳" },
];

const NAV_CLIENTES = [
  { href: "/clientes",  label: "Clientes",    icone: "👥", perfis: ["ADMIN", "GERENTE"] },
  { href: "/dashboard", label: "Dashboard",   icone: "📊", perfis: ["ADMIN", "GERENTE"] },
];

const NAV_GESTAO: { href: string; label: string; icone: string; perfis?: string[]; exact?: boolean }[] = [
  { href: "/admin/produtos",       label: "Produtos",       icone: "🍕", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/categorias",     label: "Categorias",     icone: "📂", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/mesas",          label: "Mesas",          icone: "🪑", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/cupons",         label: "Cupons",         icone: "🎫", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/agendamentos",   label: "Agendamentos",   icone: "📅", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/recuperacao",    label: "Recuperação",    icone: "🛒", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/canais",         label: "Canais de Venda",icone: "🚀", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/usuarios",                label: "Usuários",    icone: "👥", perfis: ["ADMIN"] },
  { href: "/admin/configuracoes/pagamento", label: "Pagamentos",  icone: "💳", perfis: ["ADMIN"] },
  { href: "/admin/configuracoes",           label: "Empresa",     icone: "⚙️", perfis: ["ADMIN"], exact: true },
];

export default function PainelSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const perfil = (session?.user as { perfil?: string } | undefined)?.perfil ?? "";

  if (pathname === "/login") return null;

  const podeVer = (perfis?: string[]) => !perfis || perfis.includes(perfil);

  const linkClass = (href: string, exact = false) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl font-sans font-medium text-sm transition-colors ${
      (exact ? pathname === href : pathname.startsWith(href))
        ? "bg-[#C8853A] text-[#F6F0E5]"
        : "text-[#F6F0E5]/70 hover:text-[#F6F0E5] hover:bg-white/10"
    }`;

  return (
    <aside className="w-60 flex flex-col h-full shrink-0" style={{ background: "#3B2415" }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/10 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-32 object-contain" />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {/* Operação */}
        <div className="mb-1 px-4 pt-1">
          <p className="text-[10px] font-bold text-[#F6F0E5]/40 uppercase tracking-widest">Operação</p>
        </div>
        {NAV_OPERACAO.filter((item) => podeVer(item.perfis)).map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <span className="text-lg">{item.icone}</span>
            {item.label}
          </Link>
        ))}
        <a
          href="/fila"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-sans font-medium text-sm
                     text-[#F6F0E5]/70 hover:text-[#F6F0E5] hover:bg-white/10 transition-colors"
        >
          <span className="text-lg">📺</span>
          Fila de Senhas
        </a>

        {/* Clientes */}
        {podeVer(["ADMIN", "GERENTE"]) && (
          <>
            <div className="mt-4 mb-1 px-4">
              <p className="text-[10px] font-bold text-[#F6F0E5]/40 uppercase tracking-widest">Clientes</p>
            </div>
            {NAV_CLIENTES.filter((item) => podeVer(item.perfis)).map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                <span className="text-lg">{item.icone}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}

        {/* Gestão */}
        {podeVer(["ADMIN", "GERENTE"]) && (
          <>
            <div className="mt-4 mb-1 px-4">
              <p className="text-[10px] font-bold text-[#F6F0E5]/40 uppercase tracking-widest">Gestão</p>
            </div>
            {NAV_GESTAO.filter((item) => podeVer(item.perfis)).map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href, item.exact)}>
                <span className="text-lg">{item.icone}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Usuário + Sair */}
      <div className="p-4 border-t border-white/10">
        {session?.user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
                            text-[#C8853A] font-bold text-sm shrink-0">
              {session.user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#F6F0E5] truncate">{session.user.name}</p>
              <p className="text-xs text-[#F6F0E5]/50 truncate">{perfil}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left text-[#F6F0E5]/60 text-sm hover:text-[#F6F0E5]
                     transition-colors px-1 py-1 flex items-center gap-2"
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  );
}
