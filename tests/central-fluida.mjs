import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const click=(d,text)=>{const b=[...d.querySelectorAll('.modal button')].find(x=>x.textContent===text);assert.ok(b,text);b.click()};
test('inclusão em cadastro não grava ao abrir, cancelar ou deixar identificação vazia',()=>{
 const {run,document}=setup();run("E.rituais=[];novoRegistroTabela('Rituais',[{k:'ritual',t:'Ritual'}],{ritual:''},E.rituais,()=>{})");assert.equal(run('E.rituais.length'),0);
 click(document,'Adicionar registro');assert.equal(run('E.rituais.length'),0);assert.match(document.querySelector('[role=alert]').textContent,/Preencha/);
 click(document,'Cancelar');assert.equal(run('E.rituais.length'),0);
});
test('inclusão confirma dados uma vez e conserva opções antigas',()=>{
 const {run,document}=setup();run("E.rituais=[];novoRegistroTabela('Rituais',[{k:'ritual',t:'Ritual'},{k:'frequencia',t:'Frequência',tipo:'select',opcoes:['Mensal']}],{ritual:'Visitar família',frequencia:'Personalizada'},E.rituais,()=>{})");
 assert.match(document.querySelector('.modal select').textContent,/Personalizada/);click(document,'Adicionar registro');assert.equal(run('E.rituais.length'),1);assert.equal(run('E.rituais[0].frequencia'),'Personalizada');assert.equal(document.querySelector('.modal'),null);
});
test('radar mostra aniversário de hoje, preservando referência à pessoa',()=>{
 const {run}=setup();run("E.pessoas=[{id:'p',nome:'Teste',nascimento:'1980'+hoje().slice(4)}]");assert.equal(run("radar().find(x=>x.ic==='🎂').quando"),0);assert.equal(run("radar().find(x=>x.ic==='🎂').ref===E.pessoas[0]"),true);
});
test('dias fora contam união das viagens no ano, sem duplicar sobreposição',()=>{
 const {run}=setup();assert.equal(run("diasViajandoNoAno([{ida:'2025-12-30',volta:'2026-01-03'},{ida:'2026-01-02',volta:'2026-01-05'},{ida:'2026-12-31',volta:'2027-01-02'}],2026)"),6);
});
test('início mantém prioridades visíveis e exclui peso futuro do peso atual',()=>{
 const {run,document}=setup();run("E.colapso['ini-radar']=true;E.peso=[{data:'2000-01-01',peso:70},{data:'2099-01-01',peso:95}];atual='inicio';tela()");
 assert.equal(document.querySelector('[data-bid=ini-radar]').classList.contains('fechado'),false);assert.equal(document.querySelector('.indice-tela'),null);
 const peso=[...document.querySelectorAll('.kpi')].find(x=>x.textContent.includes('Peso atual'));assert.match(peso.textContent,/70 kg/);assert.doesNotMatch(peso.textContent,/95/);
});
test('recolher atua apenas na área visível, preservando estado de outras abas',()=>{
 const {run,document}=setup();run("document.getElementById('main').innerHTML='<div id=visivel></div><div id=oculto hidden></div>';document.getElementById('visivel').appendChild(bloco('a','A','',el('<div/>')));document.getElementById('oculto').appendChild(bloco('b','B','',el('<div/>')));btnRecolher().click()");
 assert.equal(document.querySelector('[data-bid=a]').classList.contains('fechado'),true);assert.equal(document.querySelector('[data-bid=b]').classList.contains('fechado'),false);
});
test('Fortemais: venda sem fim do recebimento fica em aberto e comparação usa o filtro',async()=>{
 const {run,document}=setup();run("E.obras=[{id:'a',nome:'Obra em aberto',vendaData:'2025-01-01'},{id:'b',nome:'Obra concluída',recebidoEm:'2026-01-01'}];filtro.fmAno='aberto';fmResumo=async()=>({a:{total:100,centros:{}},b:{total:200,centros:{}}});atual='fortemais'");
 await run("vFortemais(document.getElementById('main'))");const obras=document.querySelector('[data-bid=fm-obras]');assert.match(obras.textContent,/Obra em aberto/);assert.doesNotMatch(obras.textContent,/Obra concluída/);assert.equal(document.querySelector('[data-bid=fm-comparar]'),null);
});
test('empresa com rendimentos ou planejamento não pode apagar seu histórico',async()=>{
 const {run,document}=setup();run("atual='config';E.rendimentos=[{id:'r',empresa:'Histórica',valor:42}];E.planejamentoEmpresas=[{id:'p',empresaNome:'Histórica',ano:2027}];confirm=()=>true");await run("vConfig(document.getElementById('main'))");
 const linha=[...document.querySelectorAll('.bNome')].find(x=>x.value==='Histórica').parentElement;linha.querySelector('.bDelEmp').click();assert.equal(run('E.rendimentos[0].valor'),42);assert.equal(run('E.planejamentoEmpresas[0].empresaNome'),'Histórica');
});
test('renomear empresa conserva ids e reconecta plano, obra e conta',async()=>{
 const {run,document}=setup();run("atual='config';E.rendimentos=[{id:'r',empresa:'Origem',valor:42}];E.empresasPJ=[{id:'pj',nome:'Origem'}];E.planejamentoEmpresas=[{id:'p',empresaId:'pj',empresaNome:'Origem',ano:2027}];E.obras=[{id:'o',empresa:'Origem'}];E.bancos=[{id:'b',titular:'Origem'}]");await run("vConfig(document.getElementById('main'))");const nome=[...document.querySelectorAll('.bNome')].find(x=>x.value==='Origem');nome.value='Nova razão';nome.onchange();
 assert.equal(run('E.planejamentoEmpresas[0].empresaNome'),'Nova razão');assert.equal(run('E.planejamentoEmpresas[0].empresaId'),'pj');assert.equal(run('E.obras[0].empresa'),'Nova razão');assert.equal(run('E.bancos[0].titular'),'Nova razão');assert.equal(run('E.rendimentos[0].valor'),42);
});
test('busca encontra objetivo por ação e resultado por evidência sem criar registros',()=>{
 const {run,document}=setup();run("E.planejamentoEmpresas=[{id:'p',empresaNome:'Empresa A',empresaId:'pj',ano:2027,objetivos:[{id:'o',titulo:'Objetivo teste',acoes:[{oque:'Revisar inventário único'}]}]}];E.desenvolvimento.resultados=[{id:'r',titulo:'Avanço',data:'2026-09-01',evidencia:'Feedback exclusivo',resultado:'Mudança observada'}]");
 assert.equal(run("buscarEmTudo('inventário único')[0].tit"),'Objetivo teste');run("buscarEmTudo('feedback exclusivo')[0].abrir()");assert.match(document.querySelector('.modal').textContent,/Feedback exclusivo/);assert.equal(run('E.desenvolvimento.resultados.length'),1);assert.equal(document.querySelector('.modal input'),null);
});
test('eventos conectados conservam a referência do documento que vence',()=>{
 const {run}=setup();run("E.documentos=[{id:'d',nome:'Documento',validade:'2099-01-01'}]");assert.equal(run("eventosDoEcossistema().find(x=>x.fonte==='documentos').ref===E.documentos[0]"),true);
});
test('busca encontra indicador, resultado histórico e habilidade pessoal',()=>{
 const {run}=setup();run("E.planejamentoEmpresas=[{id:'p',empresaNome:'Teste',empresaId:'pj',ano:2027,objetivos:[{id:'o',titulo:'Melhorar entregas',indicador:'Pontualidade singular',meta:'Noventa por cento',resultado:'Entrega consistente',historicoResultados:[{resultado:'Referência anterior',resultadoEm:'2027-01-01'}],acoes:[]}]}];E.pdi=[{id:'d',habilidade:'Escuta atenta singular'}]");
 for(const termo of ['pontualidade singular','noventa por cento','referência anterior','escuta atenta singular'])assert.equal(run(`buscarEmTudo(${JSON.stringify(termo)}).length`),1,termo);
});
test('Rendimentos separa histórico do resumo e identifica os três filtros',()=>{
 const {run,document}=setup();run("E.rendimentos=[{id:'r',empresa:'Teste',data:hoje(),valor:100}];atual='rendimentos';tela()");
 const filtros=[...document.querySelectorAll('.painel select')];assert.equal(filtros.length,3);assert.ok(filtros.every(x=>x.getAttribute('aria-label')));
 for(const bid of ['rd-acum','rd-emp','rd-hist','rd-conf']){const b=document.querySelector('[data-bid='+bid+']');if(b)assert.equal(b.closest('.finance-pane').id,'finance-historico',bid)}
});
