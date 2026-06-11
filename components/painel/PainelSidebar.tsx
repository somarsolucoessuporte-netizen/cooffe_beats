"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const NAV_PRINCIPAL = [
  { href: "/pedidos", label: "Pedidos", icone: "📦" },
  { href: "/kds", label: "KDS Barista", icone: "👨‍🍳" },
  { href: "/dashboard", label: "Dashboard", icone: "📊", perfis: ["ADMIN", "GERENTE"] },
];

const NAV_GESTAO = [
  { href: "/admin/produtos", label: "Produtos", icone: "🍕", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/categorias", label: "Categorias", icone: "📂", perfis: ["ADMIN", "GERENTE"] },
  { href: "/admin/usuarios", label: "Usuários", icone: "👥", perfis: ["ADMIN"] },
];

export default function PainelSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const perfil = (session?.user as { perfil?: string } | undefined)?.perfil ?? "";

  if (pathname === "/login") return null;

  const podeVer = (perfis?: string[]) => !perfis || perfis.includes(perfil);

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl font-sans font-medium text-sm transition-colors ${
      pathname.startsWith(href)
        ? "bg-cb-amber/10 text-amber-700 border border-amber-200"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
    }`;

  return (
    <aside className="w-60 flex flex-col bg-white border-r border-zinc-200 h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">☕</span>
          <div>
            <p className="font-bold text-amber-700 text-base leading-tight">Coffee & Beats</p>
            <p className="text-xs text-zinc-400">Painel Operacional</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_PRINCIPAL.filter((item) => podeVer(item.perfis)).map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <span className="text-lg">{item.icone}</span>
            {item.label}
          </Link>
        ))}

        {podeVer(["ADMIN", "GERENTE"]) && (
          <>
            <div className="mt-4 mb-1 px-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Gestão
              </p>
            </div>
            {NAV_GESTAO.filter((item) => podeVer(item.perfis)).map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                <span className="text-lg">{item.icone}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Usuário + Sair */}
      <div className="p-4 border-t border-zinc-200">
        {session?.user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
              {session.user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-800 truncate">{session.user.name}</p>
              <p className="text-xs text-zinc-400 truncate">{perfil}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left text-zinc-500 text-sm hover:text-red-500 transition-colors px-1 py-1 flex items-center gap-2"
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  );
}
