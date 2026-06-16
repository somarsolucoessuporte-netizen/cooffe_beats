type Empresa = {
  nomeFantasia?: string;
  razaoSocial?: string;
  cnpj?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  mensagemCupom?: string;
};

var empresaCache: Empresa | null = null;
var empresaCarregada = false;

async function getEmpresa(): Promise<Empresa> {
  if (empresaCarregada) return empresaCache ?? {};
  try {
    var r = await fetch("/api/admin/configuracoes");
    var d = await r.json();
    if (d.ok) empresaCache = d.data;
  } catch(e) { /* ignora — imprime sem dados da empresa */ }
  empresaCarregada = true;
  return empresaCache ?? {};
}

function montarEnderecoHtml(e: Empresa): string {
  var partes = [];
  if (e.endereco) partes.push(e.endereco + (e.numero ? ", " + e.numero : ""));
  if (e.bairro)   partes.push(e.bairro);
  if (e.cidade)   partes.push(e.cidade + (e.estado ? "/" + e.estado : ""));
  return partes.join(" · ");
}

function renderIframe(html: string) {
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
      } catch(e) {}
      setTimeout(function() {
        try { document.body.removeChild(iframe); } catch(e) {}
      }, 1000);
    }, 500);
  }
}

export async function imprimirComanda(pedido: {
  senha: string;
  itens: {
    nome: string;
    quantidade: number;
    adicionais?: string[];
    observacao?: string;
  }[];
  total: number;
  via: "CLIENTE" | "COZINHA" | "BARISTA";
  metodoPagamento?: string;
}) {
  try {
    if (typeof document === "undefined") return;

    var empresa = await getEmpresa();
    var nomeEmpresa = empresa.nomeFantasia ?? "COFFEE & BEATS";
    var titulo = pedido.via === "COZINHA" ? "VIA COZINHA" : pedido.via === "BARISTA" ? "VIA BARISTA" : "VIA CLIENTE";

    var enderecoHtml = montarEnderecoHtml(empresa);
    var cnpjHtml = empresa.cnpj ? '<div>CNPJ: ' + empresa.cnpj + '</div>' : '';
    var telHtml  = empresa.telefone ? '<div>Tel: ' + empresa.telefone + '</div>' : '';
    var msgHtml  = pedido.via === "CLIENTE" && empresa.mensagemCupom
      ? '<div class="msg">' + empresa.mensagemCupom + '</div>'
      : '';

    var itensHtml = pedido.itens.map(function(item) {
      var adicionaisHtml = item.adicionais
        ? item.adicionais.map(function(a) { return '<div class="adicional">+ ' + a + '</div>'; }).join("")
        : "";
      var obsHtml = item.observacao
        ? '<div class="adicional obs">Obs: ' + item.observacao + '</div>'
        : "";
      return '<div class="item">' + item.quantidade + 'x ' + item.nome + adicionaisHtml + obsHtml + '</div>';
    }).join("");

    var metodoPagHtml = "";
    if (pedido.via === "CLIENTE" && pedido.metodoPagamento) {
      var metodoLabel: Record<string, string> = {
        PIX:            "PIX",
        CARTAO_CREDITO: "Cartão de Crédito",
        CARTAO_DEBITO:  "Cartão de Débito",
        DINHEIRO:       "Dinheiro",
        SIMULADO:       "Simulado",
      };
      metodoPagHtml = '<div class="linha"><span>Forma:</span><span>' + (metodoLabel[pedido.metodoPagamento] ?? pedido.metodoPagamento) + '</span></div>';
    }

    var totalHtml = pedido.via === "CLIENTE"
      ? '<div class="sep"></div>' +
        '<div class="linha bold"><span>TOTAL:</span><span>R$ ' + pedido.total.toFixed(2) + '</span></div>' +
        metodoPagHtml
      : "";

    var html =
      "<!DOCTYPE html><html><head>" +
      "<style>" +
      "@page{size:80mm auto;margin:0}" +
      "body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:8px;margin:0}" +
      ".header{text-align:center;margin-bottom:4px}" +
      ".nome{font-size:15px;font-weight:bold}" +
      ".sub{font-size:10px;color:#555}" +
      ".titulo{text-align:center;font-weight:bold;font-size:13px;border:1px solid #000;padding:2px;margin:6px 0}" +
      ".senha{text-align:center;font-size:28px;font-weight:bold;letter-spacing:4px;margin:4px 0;border:2px solid #000;padding:4px}" +
      ".item{margin:3px 0;font-size:12px}" +
      ".adicional{font-size:10px;padding-left:10px;color:#333}" +
      ".obs{font-style:italic}" +
      ".sep{border-top:1px dashed #000;margin:6px 0}" +
      ".linha{display:flex;justify-content:space-between;margin:2px 0}" +
      ".bold{font-weight:bold;font-size:13px}" +
      ".footer{text-align:center;margin-top:10px;font-size:10px;color:#555}" +
      ".msg{text-align:center;font-style:italic;margin:6px 0;font-size:10px}" +
      "</style></head><body>" +
      '<div class="header">' +
      '<div class="nome">' + nomeEmpresa + '</div>' +
      (enderecoHtml ? '<div class="sub">' + enderecoHtml + '</div>' : '') +
      (cnpjHtml || telHtml ? '<div class="sub">' + cnpjHtml + telHtml + '</div>' : '') +
      '</div>' +
      '<div class="sep"></div>' +
      '<div class="titulo">' + titulo + '</div>' +
      '<div class="senha">' + pedido.senha + '</div>' +
      '<div class="sep"></div>' +
      itensHtml +
      totalHtml +
      msgHtml +
      '<div class="footer">' + new Date().toLocaleString("pt-BR") + '</div>' +
      "</body></html>";

    renderIframe(html);
  } catch(e) {
    console.log("Impressão não disponível:", e);
  }
}
