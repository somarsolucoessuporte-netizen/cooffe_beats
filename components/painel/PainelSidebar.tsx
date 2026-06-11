"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItens = [
  { href: "/painel/pedidos", label: "Pedidos", icone: "📋" },
  { href: "/painel/kds", label: "KDS Barista", icone: "☕" },
  { href: "/painel/dashboard", label: "Dashboard", icone: "📊" },
];

export default function PainelSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-64 flex flex-col bg-zinc-900 border-r border-zinc-800 h-full">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">☕</span>
          <div>
            <p className="font-bold text-cb-amber text-lg leading-tight">Coffee & Beats</p>
            <p className="text-xs text-zinc-400">Painel Operacional</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItens.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl font-sans font-medium
              transition-colors
              ${pathname.startsWith(item.href)
                ? "bg-cb-amber/10 text-cb-amber border border-cb-amber/20"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              }
            `}
          >
            <span className="text-xl">{item.icone}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Usuário */}
      <div className="p-4 border-t border-zinc-800">
        {session?.user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-cb-amber/20 flex items-center justify-center text-cb-amber font-bold">
              {session.user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{session.user.name}</p>
              <p className="text-xs text-zinc-500 truncate">{(session.user as { perfil?: string }).perfil}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/painel/login" })}
          className="w-full text-left text-zinc-400 text-sm hover:text-red-400 transition-colors px-1 py-1"
        >
          ← Sair
        </button>
      </div>
    </aside>
  );
}
