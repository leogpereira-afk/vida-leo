import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

test('chips de viagem filtram próximas sem hotel e totaliza apenas a lista visível',()=>{
 const {run,document}=setup();run(`atual='viagens';filtro.viagensAno='todos';filtro.viagens='Todas';E.viagens=[
 {id:'a',evento:'Próxima sem hotel',ida:'2099-01-01',volta:'2099-01-02',status:'Confirmado',gastos:100},
 {id:'b',evento:'Próxima reservada',ida:'2099-02-01',volta:'2099-02-02',status:'Confirmado',hotel:'Hotel',gastos:900},
 {id:'c',evento:'Passada sem hotel',ida:'2020-01-01',volta:'2020-01-02',status:'Realizado',gastos:500},
 {id:'d',evento:'Cancelada',ida:'2099-03-01',volta:'2099-03-02',status:'Cancelado',gastos:500}];tela()`);
 const antes=run('JSON.stringify(E)');document.querySelector('[data-filtro="sem-hotel"]').click();
 assert.equal(document.querySelector('[data-filtro="sem-hotel"]').getAttribute('aria-pressed'),'true');
 assert.equal(document.querySelectorAll('[data-bid="vg-lista"] tbody tr').length,1);
 assert.match(document.querySelector('[data-bid="vg-lista"] tbody').textContent,/Próxima sem hotel/);
 assert.match(document.querySelector('[data-bid="vg-lista"] tfoot').textContent,/100,00/);
 assert.equal(run('JSON.stringify(E)'),antes);
 document.querySelector('[data-filtro="todas"]').click();assert.equal(document.querySelectorAll('[data-bid="vg-lista"] tbody tr').length,4);
});
test('chip conferir viagens inclui datas incompletas sem incluir canceladas',()=>{
 const {run,document}=setup();run("atual='viagens';filtro.viagensAno='todos';filtro.viagens='Todas';E.viagens=[{id:'a',evento:'Completar datas'},{id:'b',evento:'Cancelada',status:'Cancelado'}];tela()");document.querySelector('[data-filtro="conferir"]').click();assert.match(document.querySelector('[data-bid="vg-lista"] tbody').textContent,/Completar datas/);assert.doesNotMatch(document.querySelector('[data-bid="vg-lista"] tbody').textContent,/Cancelada/);
});
test('chips de demandas preservam acesso a concluídas e à ficha pelo teclado',()=>{
 const {run,document}=setup();run("atual='demandas';E.demandas=[{id:'a',titulo:'Conferir orçamento',status:'Aberta',prioridade:'Alta'},{id:'b',titulo:'Finalizada',status:'Concluída'}];tela()");document.querySelector('[data-filtro="Concluída"]').click();const row=document.querySelector('[data-bid="dm-lista"] tbody tr');assert.match(row.textContent,/Finalizada/);assert.equal(row.getAttribute('tabindex'),'0');row.onkeydown({target:row,key:'Enter',preventDefault(){}});assert.match(document.querySelector('[role="dialog"]').textContent,/Finalizada/);
});
test('indicadores secundários são acessíveis sem duplicar a faixa principal',()=>{
 const {run,document}=setup();run("atual='demandas';tela()");assert.ok(document.querySelector('.painel-mais>.grade'));assert.equal(document.querySelector('.painel-mais').hasAttribute('open'),false);assert.ok(document.querySelector('.rotina-metricas'));assert.match(document.querySelector('.painel-mais').textContent,/Tempo médio/);
});
test('patrimônio mantém criar e recolher disponíveis no cabeçalho',()=>{
 const {run,document}=setup();run("atual='patrimonio';tela()");assert.ok([...document.querySelectorAll('.topo button')].some(x=>x.textContent.includes('Novo bem')));assert.equal(document.querySelector('.pagina>.painel'),null);document.querySelector('.topo button').click();assert.ok(document.querySelector('[role="dialog"]'));
});
test('explicação financeira pode abrir sem perder o texto de origem',()=>{
 const {run,document}=setup();run("atual='gastos';tela()");const explanation=document.querySelector('details.finance-insight');assert.ok(explanation);assert.match(explanation.querySelector('summary').textContent,/Como ler/);assert.match(explanation.textContent,/recorrentes/);
});
for(const altura of [1.8,180])test('resumo de saúde apresenta altura em metros ou centímetros: '+altura,()=>{
 const {run,document}=setup();run(`E.peso=[{id:'p',data:'2026-01-01',peso:81,altura:${altura},cintura:90}];atual='saude';tela()`);assert.equal(document.querySelectorAll('.saude-resumo .kpi .val')[1].textContent,'25,0');assert.equal(document.querySelectorAll('.saude-resumo .kpi .val')[2].textContent,'0,50');assert.equal(run('E.peso[0].altura'),altura);
});
test('saúde sem altura não mostra IMC zero nem classificação',()=>{
 const {run,document}=setup();run("E.peso=[{id:'p',data:'2026-01-01',peso:81}];atual='saude';tela()");const card=document.querySelectorAll('.saude-resumo .kpi')[1];assert.match(card.textContent,/Informe altura/);assert.doesNotMatch(card.textContent,/abaixo do peso/);
});
test('configurações combina grupo com busca sem alterar o estado',async()=>{
 const {run,document}=setup();run("atual='config';tela()");await new Promise(r=>setTimeout(r,0));const antes=run('JSON.stringify(E)');document.querySelector('[data-filtro="conexoes"]').click();const visible=()=>[...document.querySelectorAll('.config-fluida .bloco')].filter(x=>!x.hidden);assert.ok(visible().length>0);assert.ok(visible().every(x=>x.dataset.bid.startsWith('google-')));const input=document.querySelector('.config-filtros input');input.value='Gmail';input.oninput();assert.equal(visible().length,1);assert.equal(visible()[0].dataset.bid,'google-gmail');document.querySelector('[data-filtro="todos"]').click();assert.equal(input.value,'Gmail');assert.equal(run('JSON.stringify(E)'),antes);
});
