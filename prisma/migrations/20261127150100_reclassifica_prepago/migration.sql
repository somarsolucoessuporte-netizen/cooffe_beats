-- Reclassifica somente o campo "metodo" dos pagamentos com payment_type_id = prepaid_card (consulta ao Mercado Pago em 27/11/2026).
-- Aplicar só depois do deploy que conhece CARTAO_PREPAGO. Idempotente; o WHERE guarda o valor antigo (serve para reverter).
-- CB-25 R$ 5.00 pagamento MP 185630899286: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvk7a8rc000677oqp8gnd12y' AND metodo = 'CARTAO_CREDITO';
-- CB-27 R$ 36.00 pagamento MP 185810527626: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvlm77qr0008y3x0dsap1ndj' AND metodo = 'CARTAO_CREDITO';
-- CB-28 R$ 56.70 pagamento MP 184811670289: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvm4mek90008fi47lpzxwn8l' AND metodo = 'CARTAO_CREDITO';
-- CB-29 R$ 40.90 pagamento MP 185852861086: antes PIX
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvm54nkb0007fv746c098eou' AND metodo = 'PIX';
-- CB-38 R$ 34.00 pagamento MP 186407950286: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvr6jx830008728tkp7i436f' AND metodo = 'CARTAO_CREDITO';
-- CB-44 R$ 6.50 pagamento MP 185556035819: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvsrmwf200067lwndes2zdqy' AND metodo = 'CARTAO_CREDITO';
-- CB-45 R$ 13.00 pagamento MP 185558513695: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvss7z4r000e7lwno5c79876' AND metodo = 'CARTAO_CREDITO';
-- CB-46 R$ 6.50 pagamento MP 186609221768: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvst18qe000l7lwn1gvqkpil' AND metodo = 'CARTAO_CREDITO';
-- CB-57 R$ 6.00 pagamento MP 186967556026: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmvvn67wn0006107ohb8ddwlm' AND metodo = 'CARTAO_CREDITO';
-- CB-67 R$ 10.00 pagamento MP 187624661984: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw1ap2ld00066nkc9a0eblie' AND metodo = 'CARTAO_CREDITO';
-- CB-70 R$ 5.00 pagamento MP 187641294588: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw1e2lrq000613i627iady3n' AND metodo = 'CARTAO_CREDITO';
-- CB-71 R$ 18.00 pagamento MP 187643985990: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw1ex8b20008dbtwb9j4ywra' AND metodo = 'CARTAO_CREDITO';
-- CB-81 R$ 10.00 pagamento MP 188255978140: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw5ptlvx0007vk91jfbzyp3k' AND metodo = 'CARTAO_CREDITO';
-- CB-84 R$ 5.00 pagamento MP 187337712137: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw6xde660006yi4sl4pxncl1' AND metodo = 'CARTAO_CREDITO';
-- CB-96 R$ 15.00 pagamento MP 188413718814: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw6zx8sp000d2wz4ftob8tt0' AND metodo = 'CARTAO_CREDITO';
-- CB-97 R$ 10.00 pagamento MP 188414195714: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw701pe9000l2wz4rs8224hs' AND metodo = 'CARTAO_CREDITO';
-- CB-98 R$ 15.00 pagamento MP 188415564500: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw708j0z000s2wz4yfkgp26i' AND metodo = 'CARTAO_CREDITO';
-- CB-100 R$ 20.00 pagamento MP 188417886364: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw70npm300079qcc983vkcci' AND metodo = 'CARTAO_CREDITO';
-- CB-101 R$ 5.00 pagamento MP 188420622214: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw71581z0006yjrcjfwjfpkp' AND metodo = 'CARTAO_CREDITO';
-- CB-103 R$ 10.00 pagamento MP 187360772271: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmw71p3ag000e8aqqyupk4sp1' AND metodo = 'CARTAO_CREDITO';
-- CB-130 R$ 12.00 pagamento MP 188436269989: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwfj6wy400079wu0in95n3lk' AND metodo = 'CARTAO_CREDITO';
-- CB-132 R$ 5.00 pagamento MP 188439458023: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwfjp29r000fb4475yczg47t' AND metodo = 'CARTAO_CREDITO';
-- CB-133 R$ 12.00 pagamento MP 189523976860: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwfljx3c0007ggtxahqo1pgw' AND metodo = 'CARTAO_CREDITO';
-- CB-139 R$ 32.00 pagamento MP 188591750671: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwgsoy3g0009asksw7xnoxo8' AND metodo = 'CARTAO_CREDITO';
-- CB-203 R$ 6.50 pagamento MP 190626956652: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwo8slmo0007liv8n3icfp5c' AND metodo = 'CARTAO_CREDITO';
-- CB-206 R$ 15.00 pagamento MP 189544253143: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwo985d0000vliv849kbskm3' AND metodo = 'CARTAO_CREDITO';
-- CB-209 R$ 6.50 pagamento MP 190972655350: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwqzgp2b0007f1jfhz8vvjt0' AND metodo = 'CARTAO_CREDITO';
-- CB-210 R$ 50.00 pagamento MP 190976493436: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwr07czy0008ak4p70zeizvm' AND metodo = 'CARTAO_CREDITO';
-- CB-216 R$ 31.00 pagamento MP 190979526536: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwr0p20j0015foeoigpu24q4' AND metodo = 'CARTAO_CREDITO';
-- CB-224 R$ 21.50 pagamento MP 190219658767: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwtzlk6v000h2s95ssh8dj0a' AND metodo = 'CARTAO_CREDITO';
-- CB-225 R$ 6.50 pagamento MP 190219896949: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwtzox1g000p2s95bji53w40' AND metodo = 'CARTAO_CREDITO';
-- CB-227 R$ 21.00 pagamento MP 190222470467: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwu0fb4q00172s95vc5d01me' AND metodo = 'CARTAO_CREDITO';
-- CB-237 R$ 12.00 pagamento MP 190749902599: antes CARTAO_CREDITO
UPDATE "Pagamento" SET metodo = 'CARTAO_PREPAGO' WHERE id = 'cmwy89zlr000z23yukgu6aseg' AND metodo = 'CARTAO_CREDITO';
