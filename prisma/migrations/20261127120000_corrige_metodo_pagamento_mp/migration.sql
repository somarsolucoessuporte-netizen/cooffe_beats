-- Corrige somente o campo "metodo" com o payment_type_id real consultado no Mercado Pago em 27/11/2026.
-- Idempotente: só altera a linha enquanto ela estiver com o valor antigo (indicado no WHERE, que serve para reverter).
-- CB-11 R$ 1.00 pagamento MP 185213014306: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvh2nn2b0006hok6254t5ax0' AND metodo = 'CARTAO_CREDITO';
-- CB-12 R$ 1.00 pagamento MP 185213073168: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvh2q9wc000dhok6sim077ra' AND metodo = 'CARTAO_CREDITO';
-- CB-30 R$ 27.90 pagamento MP 185853098730: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvm5btd6000efv74h88lvbjf' AND metodo = 'PIX';
-- CB-31 R$ 15.00 pagamento MP 184813940865: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvm80kby0008i4wtt2dcoc7f' AND metodo = 'CARTAO_CREDITO';
-- CB-48 R$ 10.00 pagamento MP 186739006384: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvu0g3260007q22g67mqwg97' AND metodo = 'CARTAO_CREDITO';
-- CB-51 R$ 10.00 pagamento MP 186751418092: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvu2wsfr000kxll4i1s0468m' AND metodo = 'CARTAO_CREDITO';
-- CB-60 R$ 10.00 pagamento MP 186971881500: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmvvnztkd0007t0zqrzqrruhm' AND metodo = 'CARTAO_CREDITO';
-- CB-69 R$ 10.00 pagamento MP 186581446887: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw1dglbw000dccmrb2cmhun7' AND metodo = 'CARTAO_CREDITO';
-- CB-72 R$ 11.50 pagamento MP 187644958802: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw1f2fkj000gdbtwga0gd2hh' AND metodo = 'CARTAO_CREDITO';
-- CB-88 R$ 6.50 pagamento MP 188402206784: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw6xpd5s000zyi4s9bkd5vku' AND metodo = 'CARTAO_CREDITO';
-- CB-89 R$ 27.90 pagamento MP 187340126231: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw6xudel0017yi4shfwrvp95' AND metodo = 'CARTAO_CREDITO';
-- CB-94 R$ 21.50 pagamento MP 187347280991: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw6z90uc000eqjrfmgd6botz' AND metodo = 'CARTAO_CREDITO';
-- CB-95 R$ 15.00 pagamento MP 188411888514: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw6zjuow00062wz4vkbez2jx' AND metodo = 'CARTAO_CREDITO';
-- CB-99 R$ 5.00 pagamento MP 188415786240: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmw709ndn000z2wz4ro3fy33m' AND metodo = 'CARTAO_CREDITO';
-- CB-121 R$ 46.00 pagamento MP 188954849088: credit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_CREDITO' WHERE id = 'cmwbfg7di000at4nqww6qhle5' AND metodo = 'PIX';
-- CB-129 R$ 12.00 pagamento MP 189489740570: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwfg2rl30009o2kreltuiqkg' AND metodo = 'CARTAO_CREDITO';
-- CB-131 R$ 12.00 pagamento MP 188439500489: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwfjn22v0007b44798plpqj2' AND metodo = 'PIX';
-- CB-134 R$ 60.00 pagamento MP 189525744466: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwfltkrx000gggtx5xv9g6ek' AND metodo = 'CARTAO_CREDITO';
-- CB-138 R$ 10.00 pagamento MP 188461875155: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwfnga1q000fppinlwhq858l' AND metodo = 'CARTAO_CREDITO';
-- CB-174 R$ 1.00 pagamento MP 190048696940: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwjxzn5i001f104ivm8n3eii' AND metodo = 'CARTAO_CREDITO';
-- CB-204 R$ 6.00 pagamento MP 190627815308: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwo90ci9000fliv8sroonltq' AND metodo = 'CARTAO_CREDITO';
-- CB-205 R$ 6.50 pagamento MP 190628582352: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwo94pl6000nliv8qq6ojxlx' AND metodo = 'CARTAO_CREDITO';
-- CB-207 R$ 13.00 pagamento MP 190817266780: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwpnu2zf0008bbr8ahqcqxen' AND metodo = 'CARTAO_CREDITO';
-- CB-223 R$ 16.50 pagamento MP 190215349519: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwtyls5500082s95vu7ertqd' AND metodo = 'CARTAO_CREDITO';
-- CB-228 R$ 18.00 pagamento MP 190723138717: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwy3a3tq000cryre8fwxloow' AND metodo = 'CARTAO_CREDITO';
-- CB-229 R$ 25.00 pagamento MP 190733292293: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwy553i400071195z6l6w7wm' AND metodo = 'CARTAO_CREDITO';
-- CB-231 R$ 27.00 pagamento MP 191839913176: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwy5k7ac000bc94ngogbmy7f' AND metodo = 'CARTAO_CREDITO';
-- CB-235 R$ 8.00 pagamento MP 190749294101: debit_card
UPDATE "Pagamento" SET metodo = 'CARTAO_DEBITO' WHERE id = 'cmwy8413r000g23yupy0r1tix' AND metodo = 'CARTAO_CREDITO';
