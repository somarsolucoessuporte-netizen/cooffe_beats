// Detecção de celular para o totem — usada no servidor (layout) e no /diagnostico.
// O totem físico (SUNMI D2 Mini) roda Android, então "Android" sozinho NÃO indica celular.

// Cookie que força o modo do aparelho: "totem" (layout atual) ou "celular" (layout mobile).
// Definido acessando qualquer tela do totem com ?dispositivo=totem | celular | auto
export const COOKIE_DISPOSITIVO = "cb_dispositivo";

export function ehCelular(userAgent: string, cookieDispositivo?: string): boolean {
  if (cookieDispositivo === "totem")   return false;
  if (cookieDispositivo === "celular") return true;

  const ua = userAgent || "";

  // Totem SUNMI / app Capacitor (WebView Android "; wv)") → layout do totem
  if (/sunmi|\bD2/i.test(ua) || /;\s*wv\)/.test(ua)) return false;

  // iPhone/iPod, ou Android com "Mobile" (Chrome em tablet Android não envia "Mobile")
  return /iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));
}
