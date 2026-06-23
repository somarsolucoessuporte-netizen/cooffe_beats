"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseWebClient } from "@/lib/supabase-web";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";
import { formatarMoeda } from "@/lib/utils";

interface Usuario {
  nome: string;
  email: string;
}

export default function WebNavbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { totalItens, totalValor } = useWebCarrinho();

  const [usuario,       setUsuario]       = useState<Usuario | null>(null);
  const [menuAberto,    setMenuAberto]    = useState(false);
  const [saindo,        setSaindo]        = useState(false);

  useEffect(function () {
    var sb = createSupabaseWebClient();
    sb.auth.getUser().then(function ({ data }) {
      if (data.user) {
        setUsuario({
          nome:  data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Usuário",
          email: data.user.email ?? "",
        });
      }
    });
  }, []);

  async function sair() {
    setSaindo(true);
    var sb = createSupabaseWebClient();
    await sb.auth.signOut();
    router.push("/web/login");
  }

  const links = [
    { href: "/web/cardapio",  label: "Cardápio" },
    { href: "/web/reservas",  label: "Reservas" },
    { href: "/web/conta",     label: "Minha Conta" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-cb-marrom/10 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/web/cardapio" className="flex items-center gap-2.5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Coffee & Beats" className="w-9 h-9 object-contain" />
          <span className="font-extrabold text-cb-marrom text-lg hidden sm:block">
            Coffee &amp; Beats
          </span>
        </Link>

        {/* Links de navegação */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(function (link) {
            var ativo = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "px-4 py-2 rounded-full text-sm font-semibold transition-colors " +
                  (ativo
                    ? "bg-cb-marrom text-cb-bege"
                    : "text-cb-marrom/70 hover:text-cb-marrom hover:bg-cb-bege")
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Carrinho + usuário */}
        <div className="flex items-center gap-3">
          {/* Botão carrinho */}
          <Link
            href="/web/carrinho"
            className="relative flex items-center gap-2 bg-cb-bege hover:bg-cb-marrom/10
                       text-cb-marrom px-4 py-2 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9"  cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className="text-sm font-bold hidden sm:block">
              {totalItens > 0 ? formatarMoeda(totalValor) : "Carrinho"}
            </span>
            {totalItens > 0 && (
              <span className="absolute -top-1 -right-1 bg-cb-amber text-white text-xs font-bold
                               w-5 h-5 rounded-full flex items-center justify-center">
                {totalItens}
              </span>
            )}
          </Link>

          {/* Menu do usuário */}
          {usuario && (
            <div className="relative">
              <button
                onClick={function () { setMenuAberto(function (v) { return !v; }); }}
                className="flex items-center gap-2 bg-cb-marrom text-cb-bege px-3 py-2
                           rounded-full text-sm font-semibold hover:bg-cb-marrom/90 transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-cb-amber flex items-center justify-center text-xs font-bold">
                  {usuario.nome.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block max-w-[120px] truncate">{usuario.nome.split(" ")[0]}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {menuAberto && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={function () { setMenuAberto(false); }}
                  />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl
                                  border border-cb-marrom/10 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-cb-marrom/10">
                      <p className="font-semibold text-cb-marrom text-sm truncate">{usuario.nome}</p>
                      <p className="text-cb-marrom/50 text-xs truncate">{usuario.email}</p>
                    </div>
                    {/* Links mobile */}
                    <div className="md:hidden">
                      {links.map(function (link) {
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={function () { setMenuAberto(false); }}
                            className="block px-4 py-2.5 text-sm text-cb-marrom hover:bg-cb-bege"
                          >
                            {link.label}
                          </Link>
                        );
                      })}
                      <div className="border-t border-cb-marrom/10" />
                    </div>
                    <Link
                      href="/web/conta"
                      onClick={function () { setMenuAberto(false); }}
                      className="block px-4 py-2.5 text-sm text-cb-marrom hover:bg-cb-bege"
                    >
                      Meu Perfil
                    </Link>
                    <button
                      onClick={sair}
                      disabled={saindo}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50
                                 transition-colors disabled:opacity-60"
                    >
                      {saindo ? "Saindo..." : "Sair"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
