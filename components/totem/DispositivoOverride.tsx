"use client";

import { useEffect } from "react";
import { COOKIE_DISPOSITIVO } from "@/lib/dispositivo";

// ?dispositivo=totem | celular força o layout neste aparelho (cookie de 1 ano);
// ?dispositivo=auto volta para a detecção automática pelo User-Agent
export default function DispositivoOverride() {
  useEffect(function () {
    const url   = new URL(window.location.href);
    const valor = url.searchParams.get("dispositivo");
    if (!valor) return;

    if (valor === "totem" || valor === "celular") {
      document.cookie = COOKIE_DISPOSITIVO + "=" + valor + "; path=/; max-age=31536000; samesite=lax";
    } else {
      document.cookie = COOKIE_DISPOSITIVO + "=; path=/; max-age=0";
    }
    url.searchParams.delete("dispositivo");
    window.location.replace(url.toString());
  }, []);

  return null;
}
