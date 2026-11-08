import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const json=x=>JSON.parse(JSON.stringify(x));
const btn=(d,n)=>[...d.querySelectorAll('button')].find(x=>x.textContent===n);

test('ficha isolada: aquisição quitada e despesas em aberto; permuta conciliada fica só na aquisição',()=>{
 const a=setup();
 a.run(`E.holdingImoveis=[{id:'i',nome:'Sala teste',totalCentavos:32000000,parcelas:[{id:'p',descricao:'Permuta',valorCentavos:32000000,vencimento:'2026-11-01'}],pagamentos:[{id:'pago',parcelaId:'p',data:'2026-11-01',valorCentavos:32000000}],despesas:[{id:'d',tipo:'investimento',descricao:'Permuta',valorCentavos:32000000,pagoEm:'2026-11-01'},{id:'c',tipo:'condominio',descricao:'Condomínio',valorCentavos:3233818,vencimento:'2026-11-12'}]},{id:'outro',nome:'Outro imóvel',totalCentavos:10000,pagamentos:[]}];E.gastos=[{id:'g',holdingImovelId:'i',holdingParcelaId:'p',holdingDespesaId:'d',valor:320000}];vUniversoImoveis(document.getElementById('main'));`);
 const antes=a.run('JSON.stringify(E)');
 btn(a.document,'Sala teste').click();assert.equal(a.document.querySelectorAll('.holding-cartao').length,1);
 btn(a.document,'Despesas').click();
 assert.match(a.document.querySelector('.holding-linha').textContent,/100%/);
 assert.doesNotMatch(a.document.querySelector('.holding-painel').textContent,/320\.000,00|Permuta/);
 assert.match(a.document.querySelector('.holding-painel').textContent,/32\.338,18/);
 assert.equal(a.document.querySelectorAll('.holding-compromisso').length,1);
 assert.equal(a.run('JSON.stringify(E)'),antes);
 btn(a.document,'+ IPTU').click();assert.equal(a.document.querySelector('[name=tipo]').value,'iptu');
 assert.equal(a.document.querySelector('[name=descricao]').value,'IPTU');
 const descricao=a.document.querySelector('[name=descricao]');descricao.value='Meu rascunho';descricao.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));btn(a.document,'+ Reforma').click();assert.equal(descricao.value,'Meu rascunho');assert.equal(a.document.querySelector('[name=tipo]').value,'iptu');
 btn(a.document,'Cancelar').click();btn(a.document,'Recolher').click();assert.equal(a.document.querySelector('.holding-painel'),null);
 btn(a.document,'← Todos os imóveis').click();assert.equal(a.document.querySelectorAll('.holding-cartao').length,2);
});

test('separação só usa vínculo explícito válido; despesas reais não somem por valor ou descrição',()=>{
 const a=setup();a.run(`globalThis.i={id:'i',pagamentos:[{id:'pg',valorCentavos:100}],despesas:[{id:'d',tipo:'investimento',descricao:'Permuta',valorCentavos:100,pagoEm:'2026-01-01'}]}`);
 assert.equal(a.run('HoldingModelo.despesasOperacionais(i,[]).length'),1);
 assert.equal(a.run(`HoldingModelo.despesasOperacionais(i,[{holdingImovelId:'outra',holdingDespesaId:'d',holdingPagamentoId:'pg'}]).length`),1);
 assert.equal(a.run(`HoldingModelo.despesasOperacionais(i,[{holdingImovelId:'i',holdingDespesaId:'d',holdingPagamentoId:'inexistente'}]).length`),1);
 assert.equal(a.run(`HoldingModelo.despesasOperacionais(i,[{holdingImovelId:'i',holdingDespesaId:'d',holdingPagamentoId:'pg'}]).length`),0);
});

test('categorias prontas de imóvel validam, repetem e não alteram o saldo de aquisição',()=>{
 const a=setup();a.run(`globalThis.c=[{id:'i',nome:'Teste',totalCentavos:10000,pagamentos:[{id:'p',data:'2026-01-01',valorCentavos:10000}]}]`);
 for(const tipo of ['iptu','reforma','manutencao','seguro','agua','energia','internet','outros'])a.run(`c=HoldingModelo.gravarDespesa(c,'i',{id:'${tipo}',tipo:'${tipo}',descricao:'Teste',valorCentavos:12345,vencimento:'2026-01-31',quantidade:2})`);
 a.run('HoldingModelo.validarCarteira(c)');assert.equal(a.run('c[0].despesas.length'),16);assert.equal(a.run('HoldingModelo.resumo(c[0]).percentual'),100);
 assert.equal(a.run('c[0].despesas[1].vencimento'),'2026-02-28');
});

test('custos mensais somam por categoria na data do pagamento; aquisição e cancelados ficam fora',()=>{
 const a=setup();a.run(`E.aviao.aportes=[{valor:99999}];E.aviao.mensalidades=[{id:'m',minhaCota:100.10,status:'Pago',pagoEm:'2026-02-05',vencimento:'2026-01-05'}];E.aviao.despesas=[{id:'i',categoria:'Internet / Comunicação',minhaCota:20.20,status:'Pago',pagoEm:'2026-02-06',data:'2026-01-01'},{id:'p',categoria:'Manutenção Extra',minhaCota:300,status:'Pendente',data:'2026-02-15'},{id:'c',categoria:'Internet / Comunicação',minhaCota:500,status:'Cancelado',data:'2026-02-01'}]`);
 const r=json(a.run(`aviaoResumoCustos(E.aviao,'2026-02')`));assert.equal(r.pago,120.3);assert.equal(r.aberto,300);
 assert.equal(r.categorias.find(x=>x.nome==='Internet / Comunicação').pago,20.2);
 assert.equal(a.run(`aviaoResumoCustos(E.aviao,'2026-01').pago`),0);
 a.run(`filtro.aviaoCustosMes='2026-02';vPlanilhaAviao(document.getElementById('main'))`);assert.equal(a.document.querySelectorAll('tbody tr').length,4);
 a.run(`document.getElementById('main').replaceChildren();filtro.aviaoCustoCategoria='Mensalidade';vPlanilhaAviao(document.getElementById('main'))`);assert.equal(a.document.querySelectorAll('tbody tr').length,1);
});

test('recorrência limita quantidade, preserva fim de mês e é idempotente; baixa cria um único gasto e referência de comprovante',async()=>{
 const a=setup();a.run(`E.gastos=[];E.aviao.despesas=[];globalThis.d={id:'serie',natureza:'avulso',categoria:'Internet / Comunicação',data:'2028-01-31',descricao:'Internet',minhaCota:120.35,valorTotal:null,status:'Pendente',pagoEm:''}`);
 const linhas=json(a.run(`aviaoCriarSerieCustos('despesas',d,3)`));assert.deepEqual(linhas.map(x=>x.data),['2028-01-31','2028-02-29','2028-03-31']);
 assert.equal(a.run(`aviaoCriarSerieCustos('despesas',d,3,12)[2].data`),'2030-01-31');
 for(const q of [0,361,1.2])assert.throws(()=>a.run(`aviaoCriarSerieCustos('despesas',d,${q})`),/360/);
 assert.throws(()=>a.run(`aviaoCriarSerieCustos('despesas',{...d,status:'Pago'},3)`),/em aberto/);
 await a.run(`aviaoGravarSerieCustos('despesas',d,3)`);await a.run(`aviaoGravarSerieCustos('despesas',d,3)`);
 assert.equal(a.run('E.aviao.despesas.length'),3);assert.equal(a.run('E.gastos.length'),0);
 a.run(`globalThis.base=structuredClone(E.aviao.despesas[0]);globalThis.pago={...base,status:'Pago',pagoEm:'2028-02-01'}`);
 await a.run(`aviaoGravarRegistro('despesas',pago,base)`);await a.run(`aviaoGravarRegistro('despesas',pago,pago)`);
 assert.equal(a.run('E.gastos.length'),1);assert.equal(a.run('E.gastos[0].valor'),120.35);
 assert.equal(a.run(`gastoReferenciaOrigem(E.gastos[0])`),a.run(`aviaoRefPagamento('despesas',pago.id)`));
 assert.equal(a.run(`aviaoResumoCustos(E.aviao,'2028-02').pago`),120.35);
 await assert.rejects(a.run(`aviaoGravarSerieCustos('despesas',d,3)`),/já existe/);
 a.run('validarBackup(E)');assert.equal(a.run('E.aviao.despesas.length'),3);
});

test('recorrência falha sem gravar parcialmente se armazenamento rejeitar',async()=>{
 const a=setup();a.run(`E.aviao.despesas=[];globalThis.antes=JSON.stringify(E.aviao);localStorage.setItem=()=>{throw Error('QuotaExceededError')};globalThis.d={id:'s',data:'2026-12-31',descricao:'Internet',minhaCota:20,status:'Pendente'}`);
 await assert.rejects(a.run(`aviaoGravarSerieCustos('despesas',d,12)`),/Não foi possível/);
 assert.equal(a.run('JSON.stringify(E.aviao)'),a.run('antes'));
});
