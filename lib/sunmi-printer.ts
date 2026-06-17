export class SunmiPrinter {
  private printer: any = null;

  constructor() {
    if (typeof window === "undefined") return;

    this.printer =
      (window as any).SunmiPrinter  ||
      (window as any).printer        ||
      (window as any).sunmiPrinter   ||
      (window as any).InnerPrinter   ||
      null;

    if (!this.printer) {
      try {
        this.printer = (window as any).Android?.getPrinter?.() ?? null;
      } catch(e) { /* sem Android bridge */ }
    }
  }

  isAvailable(): boolean {
    return this.printer !== null;
  }

  async imprimir(linhas: string[]): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (this.printer.printText) {
        const p = this.printer;
        linhas.forEach((linha: string) => { p.printText(linha + "\n"); });
        this.printer.lineWrap?.(3);
        return true;
      }
      if (this.printer.print) {
        this.printer.print(linhas.join("\n"));
        return true;
      }
      return false;
    } catch(e) {
      console.error("[SUNMI] Erro ao imprimir:", e);
      return false;
    }
  }
}
