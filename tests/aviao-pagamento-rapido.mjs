import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const btn=(root,n)=>[...root.querySelectorAll('button')].find(x=>x.textContent===n);
const tick=()=>new Promise(r=>setImmediate(r));
function base(){
 const a=setup(),storage=new Map();a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 a.run(`E.aviao.mensalidades=[{id:'m',competencia:'2026-09-01',vencimento:'2026-09-05',minhaCota:100.10,status:'Pago',pagoEm:'2026-09-05'},{id:'p',competencia:'2026-11-01',vencimento:'2026-11-05',minhaCota:200.20,status:'A Vencer',pagoEm:'',obs:'Preservar'}];E.aviao.despesas=[{id:'d',natureza:'avulso',descricao:'Internet antiga',categoria:'Internet / Comunicação',data:'2026-10-05',minhaCota:20.20,status:'Pago',pagoEm:'2026-10-06'},{id:'c',descricao:'Cancelado',data:'2026-10-01',minhaCota:999,status:'Cancelado'}];E.gastos=[];atual='aviao';filtro.aviaoAba='custos';`);
 return a;
}
function preencher(a,k,v){const i=a.document.querySelector('[data-k='+k+']');if(i.tagName==='SELECT'){[...i.options].find(o=>o.value===v).selected=true}else i.value=v;i.gravarEntrada?.();}

test('custos abrem com todos os pagamentos e soma total, mantendo filtro mensal opcional',()=>{
 const a=base();a.run(`vPlanilhaAviao(document.getElementById('main'))`);
 assert.equal(a.document.querySelector('[aria-label="Mês dos custos"]').value,'');
 assert.equal(a.document.querySelectorAll('tbody tr').length,4);
 assert.match(a.document.querySelector('.aviao-custos-resumo').textContent,/Total pago.*120,30.*Total em aberto.*200,20.*Total de custos.*320,50/);
 assert.equal(a.run('aviaoResumoCustos(E.aviao).total'),320.50);
 a.run(`document.getElementById('main').replaceChildren();filtro.aviaoCustosMes='2026-11';vPlanilhaAviao(document.getElementById('main'))`);
 assert.equal(a.document.querySelectorAll('tbody tr').length,1);
 assert.match(a.document.querySelector('.aviao-custos-resumo').textContent,/Pago no mês.*0,00.*200,20/);
});

test('baixa rápida preserva valor e origem; repetição não duplica gasto nem altera data já paga',async()=>{
 const a=base();a.run(`globalThis.p=structuredClone(E.aviao.mensalidades[1])`);
 await a.run(`aviaoMarcarPago('mensalidades',p,'2026-11-08')`);
 await a.run(`aviaoMarcarPago('mensalidades',p,'2026-11-08')`);
 assert.equal(a.run('E.gastos.length'),1);assert.equal(a.run('E.gastos[0].valor'),200.20);
 assert.equal(a.run('E.aviao.mensalidades[1].pagoEm'),'2026-11-08');assert.equal(a.run('E.aviao.mensalidades[1].obs'),'Preservar');
 assert.equal(a.run('aviaoResumoCustos(E.aviao).pago'),320.50);assert.equal(a.run('aviaoResumoCustos(E.aviao).aberto'),0);
 assert.equal(a.run('gastoReferenciaOrigem(E.gastos[0])'),a.run(`aviaoRefPagamento('mensalidades','p')`));
 const antes=a.run('JSON.stringify(E)');
 await assert.rejects(a.run(`aviaoMarcarPago('mensalidades',p,'2026-11-09')`),/mudou/);assert.equal(a.run('JSON.stringify(E)'),antes);
 await assert.rejects(a.run(`aviaoMarcarPago('despesas',E.aviao.despesas[1])`),/cancelado/i);
});

test('botão na linha marca como pago com um clique, atualiza soma e oferece comprovante',async()=>{
 const a=base();a.run(`vAviao(document.getElementById('main'))`);
 const b=btn(a.document,'Marcar como pago');assert.ok(b);b.click();assert.equal(b.disabled,true);b.click();await tick();
 assert.equal(a.run('E.gastos.length'),1);assert.equal(a.run('E.aviao.mensalidades[1].pagoEm'),a.run('hoje()'));
 assert.equal(btn(a.document,'Marcar como pago'),undefined);
 assert.ok(a.document.querySelector('[data-comprovante-ref="aviao:principal:mensalidades:p"]'));
 assert.match(a.document.querySelector('.aviao-custos-resumo').textContent,/320,50/);
});

test('baixa com edição concorrente apresenta erro e não altera dados ou Gastos',async()=>{
 const a=base();a.run(`vAviao(document.getElementById('main'));E.aviao.mensalidades[1].minhaCota=300`);
 btn(a.document,'Marcar como pago').click();await tick();
 assert.equal(a.run('E.gastos.length'),0);assert.equal(a.run('E.aviao.mensalidades[1].status'),'A Vencer');
 assert.match(a.document.querySelector('.aviao-baixa-status').textContent,/mudou/);
 assert.equal(btn(a.document,'Marcar como pago').disabled,false);
});

test('mais na viagem salva descrição, valor e data uma vez, soma aos custos existentes e compartilha origem',async()=>{
 const a=base();a.run(`E.viagens=[{id:'v',evento:'Viagem teste',ida:'2026-10-30',aviaoId:'principal',status:'Confirmado',gastos:0,custos:[{id:'direto',valor:2130}]}];filtro.aviaoAba='viagens';vAviao(document.getElementById('main'))`);
 btn(a.document,'+ Gasto').click();assert.match(a.document.querySelector('[role=dialog]').textContent,/Viagem teste/);
 preencher(a,'descricao','Taxa de pouso');preencher(a,'minhaCota','120,35');preencher(a,'data','2026-10-30');
 const salvar=btn(a.document,'Salvar gasto');salvar.click();salvar.click();await tick();
 assert.equal(a.run('E.gastos.length'),1);assert.equal(a.run('E.gastos[0].pagoEm'),'2026-10-30');
 assert.equal(a.run(`E.aviao.despesas.filter(d=>d.viagemId==='v').length`),1);assert.equal(a.run('E.viagens[0].custos.length'),1);
 assert.equal(a.run('custoViagem(E.viagens[0])'),2250.35);assert.equal(a.run('E.aviao.despesas.at(-1).valorTotal'),null);
 assert.match(a.document.querySelector('.aviao-viagem').textContent,/2\.250,35/);
 assert.equal(a.run('gastoReferenciaOrigem(E.gastos[0])'),a.run(`aviaoRefPagamento('despesas',E.aviao.despesas.at(-1).id)`));
 a.run(`E=carregar();validarBackup(E)`);assert.equal(a.run('custoViagem(E.viagens[0])'),2250.35);
});

test('gasto de viagem permite pendente, valida entrada e cancelar não grava rascunho',async()=>{
 const a=base();a.run(`E.viagens=[{id:'v',evento:'Teste',aviaoId:'principal',status:'Confirmado',custos:[]}];modalGastoViagemAviao(E.viagens[0])`);
 const antes=a.run('JSON.stringify(E)');preencher(a,'descricao','Transporte');preencher(a,'minhaCota','100');btn(a.document,'Cancelar').click();assert.equal(a.run('JSON.stringify(E)'),antes);
 a.run(`modalGastoViagemAviao(E.viagens[0])`);btn(a.document,'Salvar gasto').click();await tick();assert.match(a.document.querySelector('.form-erro').textContent,/descrição/);
 preencher(a,'descricao','Transporte');preencher(a,'minhaCota','100');preencher(a,'status','Pendente');preencher(a,'data','2026-12-01');btn(a.document,'Salvar gasto').click();await tick();
 assert.equal(a.run('E.gastos.length'),0);assert.equal(a.run('E.aviao.despesas.at(-1).pagoEm'),'');assert.equal(a.run('custoViagem(E.viagens[0])'),100);
});

test('viagem cancelada ou desvinculada enquanto o formulário está aberto bloqueia novo gasto',async()=>{
 for(const mudanca of ["status='Cancelado'","aviaoId='' "]){
 const a=base();a.run(`E.viagens=[{id:'v',evento:'Teste',aviaoId:'principal',status:'Confirmado',custos:[]}];modalGastoViagemAviao(E.viagens[0])`);
 preencher(a,'descricao','Taxa');preencher(a,'minhaCota','10');a.run(`E.viagens[0].${mudanca}`);btn(a.document,'Salvar gasto').click();await tick();
 assert.equal(a.run('E.gastos.length'),0);assert.equal(a.run('E.aviao.despesas.length'),2);assert.match(a.document.querySelector('.form-erro').textContent,/viagem/i);
 }
});

test('soma da viagem usa centavos exatos e exclui despesa cancelada',()=>{
 const a=base();a.run(`E.viagens=[{id:'v',aviaoId:'principal',status:'Confirmado',custos:[{valor:0.10},{valor:0.20}]}];E.aviao.despesas=[{id:'d',viagemId:'v',minhaCota:0.07,status:'Pago'},{id:'c',viagemId:'v',minhaCota:10,status:'Cancelado'}]`);
 assert.equal(a.run('custoViagem(E.viagens[0])'),0.37);
});

test('um gasto rápido mantém custo total da aeronave desconhecido ao editar',async()=>{
 const a=base();a.run(`E.viagens=[{id:'v',evento:'Teste',aviaoId:'principal',status:'Confirmado',custos:[]}];modalGastoViagemAviao(E.viagens[0])`);
 preencher(a,'descricao','Taxa');preencher(a,'minhaCota','10');btn(a.document,'Salvar gasto').click();await tick();
 a.run(`modalRegistroAviao('despesas',E.aviao.despesas.at(-1))`);assert.equal(a.document.querySelector('[data-k=valorTotal]').value,'');btn(a.document,'Salvar registro').click();await tick();
 assert.equal(a.run('E.aviao.despesas.at(-1).valorTotal'),null);assert.equal(a.run('E.gastos.length'),1);
});
