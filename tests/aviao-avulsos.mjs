import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
test('dashboard reconcilia centavos, separa aquisição, cancelados e datas de pagamento',()=>{
 const {run}=setup();
 run(`E.aviao.aportes=[{valor:99999}];E.aviao.mensalidades=[{minhaCota:100.10,status:'Pago',competencia:'2025-12-01',pagoEm:'2026-01-05'},{minhaCota:40,status:'A Vencer',vencimento:'2027-01-01'}];E.aviao.despesas=[{natureza:'avulso',minhaCota:20.20,valorTotal:200,status:'Pago',pagoEm:'2026-01-06'},{minhaCota:30,status:'Pago',data:'2026-02-01'},{minhaCota:500,status:'Cancelado',pagoEm:'2026-01-06'}]`);
 assert.equal(run("gastosDashboardAviao(E.aviao).pago"),150.30);
 assert.equal(run("gastosDashboardAviao(E.aviao,'2026').pago"),120.30);
 assert.equal(run("gastosDashboardAviao(E.aviao,'2026').meses[0].valor"),120.30);
 assert.equal(run("gastosDashboardAviao(E.aviao).semData"),1);
 assert.equal(run("gastosDashboardAviao(E.aviao).total"),190.30);
 assert.equal(run("resumoPlanilhaAviao(E.aviao).minhaParte"),30);
});
test('avulsos têm cadastro próprio, não entram na tabela de viagens e exigem data quando pagos',()=>{
 const {run,document}=setup();run("modalRegistroAviao('despesas',null,'avulso')");
 assert.ok(document.querySelector('input[data-k=fornecedor]'));
 assert.equal(document.querySelector('[data-k=viagemId]'),null);
 const preencher=(k,v)=>{const i=document.querySelector(`[data-k=${k}]`);if(i.tagName==='SELECT'){i.querySelector(`[value="${v}"]`).selected=true}else i.value=v;i.gravarEntrada?.()};
 preencher('descricao','Equipamento de exemplo');preencher('minhaCota','25,50');preencher('status','Pago');
 const salvar=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Salvar registro').click();salvar();
 assert.equal(run('E.aviao.despesas.length'),0);
 preencher('pagoEm','2026-01-08');salvar();
 assert.equal(run('E.aviao.despesas[0].natureza'),'avulso');
 assert.equal(run('E.aviao.despesas[0].valorTotal'),null);
 assert.equal(run('E.aviao.despesas[0].minhaCota'),25.50);
 run("filtro.aviaoPlanilha='viagens';vPlanilhaAviao(document.getElementById('main'))");
 assert.doesNotMatch(document.getElementById('main').textContent,/Equipamento de exemplo/);
 run("document.getElementById('main').replaceChildren();filtro.aviaoPlanilha='avulsos';vPlanilhaAviao(document.getElementById('main'))");
 assert.match(document.getElementById('main').textContent,/Equipamento de exemplo/);
});
test('dashboard vazio renderiza, preserva os dados e permite abrir um lançamento',()=>{
 const {run,document}=setup();run("vDashboardAviao(document.getElementById('main'))");assert.match(document.getElementById('main').textContent,/Nenhum pagamento/);
 run("E.aviao.despesas=[{id:'t',natureza:'avulso',data:'2026-01-01',pagoEm:'2026-01-02',descricao:'Exemplo',minhaCota:10,status:'Pago'}];document.getElementById('main').replaceChildren();vDashboardAviao(document.getElementById('main'))");
 document.querySelector('table button').click();assert.match(document.querySelector('[role=dialog]').textContent,/Editar custo avulso/);
 assert.equal(run('E.aviao.despesas.length'),1);
});

test('total desembolsado soma aquisição e pagamentos de todo o histórico, mesmo com filtro anual',()=>{
 const {run,document}=setup();
 run("E.aviao.aportes=[{valor:1000.10},{valor:2000.20}];E.aviao.valorCotaAtual=9000;E.aviao.mensalidades=[{minhaCota:100.10,status:'Pago',pagoEm:'2025-01-05'},{minhaCota:800,status:'A Vencer',vencimento:'2026-01-05'}];E.aviao.despesas=[{minhaCota:20.20,status:'Pago',pagoEm:'2026-01-06'},{minhaCota:500,status:'Cancelado'},{minhaCota:900,status:'Pendente'}]");
 assert.equal(run("gastosDashboardAviao(E.aviao,'2026').pago"),20.20);
 assert.equal(run("gastosDashboardAviao(E.aviao,'2026').desembolsado"),3120.60);
 run("filtro.aviaoGastosAno='2026';vDashboardAviao(document.getElementById('main'))");
 const final=document.querySelector('.aviao-dashboard').lastElementChild;
 assert.match(final.textContent,/Total desembolsado na aeronave/);
 assert.match(final.textContent,/3\.120,60/);
 assert.match(final.textContent,/independentemente do filtro/);
});
