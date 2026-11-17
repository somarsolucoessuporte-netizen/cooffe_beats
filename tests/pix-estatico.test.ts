import assert from "node:assert/strict";
import { test } from "node:test";
import { crc16, crcConfere, gerarPixEstatico, pixEstaticoVisivel, txidPix } from "../lib/pix-estatico";

test("CRC16-CCITT: vetor padrão 123456789 = 29B1", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("exemplo oficial do manual do BR Code do Banco Central (CRC 1D3D)", () => {
  const manual = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
  assert.equal(crc16(manual.slice(0, -4)), "1D3D");
  assert.ok(crcConfere(manual));
  assert.ok(crcConfere(gerarPixEstatico({ valor: 1, chave: "123e4567-e12b-12d1-a456-426655440000", nome: "Fulano de Tal", cidade: "BRASILIA", literal: true })));
  // o gerador usa o GUI em maiúsculas, como o próprio QR do Mercado Pago (BR.GOV.BCB.PIX)
});

test("payload da Arena 085: campos, valor e CRC conferem", () => {
  const p = gerarPixEstatico({ valor: 15.9, referencia: "CB-CB-182-1794939716670" });
  assert.ok(p.startsWith("000201010211"));
  assert.ok(p.includes("0014BR.GOV.BCB.PIX011445433748000116"));
  assert.ok(p.includes("5303986"));
  assert.ok(p.includes("540515.90"));
  assert.ok(p.includes("5802BR"));
  assert.ok(p.includes("5909ARENA 085"));
  assert.ok(p.includes("6009FORTALEZA"));
  assert.ok(p.includes("0520CBCB1821794939716670"));
  assert.ok(crcConfere(p));
  // qualquer alteração invalida o CRC
  assert.equal(crcConfere(p.replace("15.90", "25.90")), false);
});

test("txid só alfanumérico até 25; nome sem acento; valor inválido rejeitado", () => {
  assert.equal(txidPix("CB-18_2/x y"), "CB182xy");
  assert.equal(txidPix("A".repeat(40)).length, 25);
  assert.equal(txidPix(""), "***");
  assert.ok(gerarPixEstatico({ valor: 1, nome: "Arena Ôitenta Cinco Café Bar Ltda" }).includes("5924ARENA OITENTA CINCO CAFE"));
  assert.throws(() => gerarPixEstatico({ valor: 0 }));
  assert.throws(() => gerarPixEstatico({ valor: NaN }));
});

test("reserva automática: estático sempre visível sem dinâmico; com dinâmico só se falhar ou passar de 10 s", () => {
  assert.equal(pixEstaticoVisivel({ ativo: false, estado: "gerando", decorridoMs: 0 }), true);
  assert.equal(pixEstaticoVisivel({ ativo: true, estado: "gerando", decorridoMs: 3000 }), false);
  assert.equal(pixEstaticoVisivel({ ativo: true, estado: "gerando", decorridoMs: 10_001 }), true);
  assert.equal(pixEstaticoVisivel({ ativo: true, estado: "erro", decorridoMs: 1000 }), true);
  assert.equal(pixEstaticoVisivel({ ativo: true, estado: "pronto", decorridoMs: 20_000 }), false);
});
