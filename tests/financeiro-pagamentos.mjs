import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
test('Pix sem quitação continua sem situação; total pago exige informação explícita',()=>{
 const {run}=setup();
 assert.deepEqual(JSON.parse(run(`JSON.stringify(financeiroPagamentos([{valor:50,pago:'Pix'},{valor:80,situacao:'Pago'},{valor:30,situacao:'Pendente'}]))`)),{pagos:80,pendentes:30,semSituacao:1});
});
test('formulário não aceita quitação incoerente nem data em outro mês',()=>{
 const {run}=setup();
 assert.throws(()=>run(`financeiroValidarGasto({mes:'2026-10',data:'2026-09-01',valor:20,natureza:'Despesa pessoal'})`));
 assert.throws(()=>run(`financeiroValidarGasto({mes:'2026-10',valor:20,natureza:'Despesa pessoal',pagoEm:'2026-10-01',situacao:'Pendente'})`));
 assert.doesNotThrow(()=>run(`financeiroValidarGasto({mes:'2026-10',data:'2026-10-01',valor:20,natureza:'Despesa pessoal',pagoEm:'2026-10-01',situacao:'Pago'})`));
});
