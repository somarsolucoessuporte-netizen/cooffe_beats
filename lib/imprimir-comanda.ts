export function imprimirComanda(pedido: {
  senha: string
  itens: {
    nome: string
    quantidade: number
    adicionais?: string[]
    observacao?: string
  }[]
  total: number
  via: 'CLIENTE' | 'COZINHA' | 'BARISTA'
}) {
  const janela = window.open('', '_blank', 'width=300,height=600')
  if (!janela) return

  const titulo =
    pedido.via === 'COZINHA'
      ? 'VIA COZINHA'
      : pedido.via === 'BARISTA'
      ? 'VIA BARISTA'
      : 'VIA CLIENTE'

  const html = `
    <html>
    <head>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          padding: 8px;
          margin: 0;
        }
        .header { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
        .senha { text-align: center; font-size: 24px; font-weight: bold; margin: 8px 0; border: 2px solid #000; padding: 4px; }
        .item { margin: 4px 0; }
        .adicional { font-size: 10px; padding-left: 8px; }
        .obs { font-size: 10px; font-style: italic; padding-left: 8px; }
        .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 4px; font-weight: bold; }
        .footer { text-align: center; margin-top: 12px; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">COFFEE &amp; BEATS<br/>${titulo}</div>
      <div class="senha">${pedido.senha}</div>
      <div>
        ${pedido.itens
          .map(
            (item) => `
          <div class="item">
            ${item.quantidade}x ${item.nome}
            ${item.adicionais?.map((a) => `<div class="adicional">+ ${a}</div>`).join('') ?? ''}
            ${item.observacao ? `<div class="obs">Obs: ${item.observacao}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
      ${pedido.via === 'CLIENTE' ? `<div class="total">Total: R$ ${pedido.total.toFixed(2)}</div>` : ''}
      <div class="footer">${new Date().toLocaleString('pt-BR')}</div>
    </body>
    </html>
  `

  janela.document.write(html)
  janela.document.close()
  setTimeout(() => {
    janela.print()
    janela.close()
  }, 250)
}
