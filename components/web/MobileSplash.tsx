"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const CHAVE_SESSAO = "splash_shown";
const DURACAO_MS   = 2000;

// Splash com a logo animada — só no mobile (< 768px) e uma vez por sessão
export default function MobileSplash() {
  const [visivel, setVisivel] = useState(false);

  useEffect(function () {
    let jaExibido = false;
    try { jaExibido = sessionStorage.getItem(CHAVE_SESSAO) === "1"; } catch {}
    if (jaExibido || !window.matchMedia("(max-width: 767px)").matches) return;

    try { sessionStorage.setItem(CHAVE_SESSAO, "1"); } catch {}
    setVisivel(true);
    const t = setTimeout(function () { setVisivel(false); }, DURACAO_MS);
    return function () { clearTimeout(t); };
  }, []);

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-8 bg-[#3B2415] md:hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {/* Logo: fadeIn + scale 0.8 → 1.0 */}
          <motion.img
            src="/logo.png"
            alt="Coffee & Beats"
            className="w-40 h-40 object-contain"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          {/* Subtítulo entra 400ms depois */}
          <motion.p
            className="text-[#C8A96E] text-center text-base font-medium leading-snug"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Onde o café encontra o ritmo da sua vida.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
