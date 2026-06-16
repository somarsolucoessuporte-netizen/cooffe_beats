export function imprimirComanda(pedido: {
  senha: string;
  itens: {
    nome: string;
    quantidade: number;
    adicionais?: string[];
    observacao?: string;
  }[];
  total: number;
  via: "CLIENTE" | "COZINHA" | "BARISTA";
}) {
  try {
    if (typeof document === "undefined") return;

    var titulo =
      pedido.via === "COZINHA"
        ? "VIA COZINHA"
        : pedido.via === "BARISTA"
        ? "VIA BARISTA"
        : "VIA CLIENTE";

    var itensHtml = pedido.itens
      .map(function(item) {
        var adicionaisHtml = item.adicionais
          ? item.adicionais.map(function(a) {
              return '<div class="adicional">+ ' + a + "</div>";
            }).join("")
          : "";
        var obsHtml = item.observacao
          ? '<div class="adicional">Obs: ' + item.observacao + "</div>"
          : "";
        return (
          '<div class="item">' +
          item.quantidade +
          "x " +
          item.nome +
          adicionaisHtml +
          obsHtml +
          "</div>"
        );
      })
      .join("");

    var totalHtml =
      pedido.via === "CLIENTE"
        ? '<div class="total">Total: R$ ' + pedido.total.toFixed(2) + "</div>"
        : "";

    var html =
      "<!DOCTYPE html><html><head>" +
      "<style>" +
      "@page { size: 80mm auto; margin: 0; }" +
      "body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 8px; margin: 0; }" +
      ".header { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 8px; }" +
      ".senha { text-align: center; font-size: 24px; font-weight: bold; margin: 8px 0; border: 2px solid #000; padding: 4px; }" +
      ".item { margin: 4px 0; }" +
      ".adicional { font-size: 10px; padding-left: 8px; }" +
      ".total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 4px; font-weight: bold; }" +
      ".footer { text-align: center; margin-top: 12px; font-size: 10px; }" +
      "</style></head><body>" +
      '<div class="header">COFFEE &amp; BEATS<br/>' +
      titulo +
      "</div>" +
      '<div class="senha">' +
      pedido.senha +
      "</div>" +
      itensHtml +
      totalHtml +
      '<div class="footer">' +
      new Date().toLocaleString("pt-BR") +
      "</div>" +
      "</body></html>";

    // iframe invisível em vez de window.open (não trava mobile)
    var iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    if (iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();

      setTimeout(function() {
        try {
          if (iframe.contentWindow) iframe.contentWindow.print();
        } catch (e) {
          // impressora não disponível — silencioso
        }
        setTimeout(function() {
          try {
            document.body.removeChild(iframe);
          } catch (e) {}
        }, 1000);
      }, 500);
    }
  } catch (e) {
    console.log("Impressão não disponível:", e);
  }
}
