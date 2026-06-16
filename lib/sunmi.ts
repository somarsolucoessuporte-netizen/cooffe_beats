export function isSunmiDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /sunmi/i.test(navigator.userAgent);
}

export function iniciarPagamentoNFC(valor: number): void {
  if (!isSunmiDevice()) {
    console.log("[SUNMI] NFC simulado — valor:", valor);
    return;
  }
  // Aciona SUNMI Pay via deeplink; requer app SUNMI Pay instalado no D2 Mini
  const url = `sunmipay://payment?amount=${valor.toFixed(2)}&currency=BRL`;
  try {
    window.location.href = url;
  } catch {
    console.warn("[SUNMI] Deeplink SUNMI Pay falhou");
  }
}
