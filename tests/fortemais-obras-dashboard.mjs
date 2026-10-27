import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
async function app(){
  const a=setup();a.run(`E=structuredClone(SEED);E.obras=[{id:'a',nome:'Casa sintética A',status:'Em andamento',area:180,vendaValor:777,fmDemandas:{etapas:[{id:'e',nome:'Estrutura'}],itens:[{id:'d',titulo:'Conferir materiais',situacao:'A fazer',prazo:'2026-01-01',responsavel:'Equipe de teste',etapaId:'e'}]}},{id:'b',nome:'Casa sintética B',status:'Em planejamento'}];atual='fortemais';filtro.fmAberta='a';filtro.fmAbas={};`);
  await a.run('vFortemais(document.getElementById("main"))');await new Promise(r=>setImmediate(r));return a;
}
test('Obras abre o dashboard e os quatro acessos preservam o financeiro',async()=>{
  const a=await app(),antes=a.run('JSON.stringify(E)');assert.equal(a.document.querySelector('[data-fm-pagina=dashboard]').hidden,false);
  assert.equal(a.document.querySelector('[data-fm-pagina=previsao]').hidden,true);
  for(const [id,pagina] of [['financeiro','previsao'],['compras','compras'],['documentos','documentos'],['imovel','imovel']]){
    a.document.querySelector('[data-pagina=dashboard]').click();a.document.querySelector(`[data-fm-atalho=${id}]`).click();assert.equal(a.document.querySelector(`[data-fm-pagina=${pagina}]`).hidden,false);
  }
  assert.equal(a.run('JSON.stringify(E)'),antes);assert.equal(a.run('E.obras[0].vendaValor'),777);
});
test('Financeiro mantém previsão, ROI, TIR e histórico dentro da própria navegação',async()=>{
  const a=await app();a.document.querySelector('[data-pagina=financeiro]').click();assert.equal(a.document.querySelector('.fm-financeiro-tabs').hidden,false);
  for(const id of ['roi','tir','realizado','previsao']){a.document.querySelector(`[data-pagina=${id}]`).click();assert.equal(a.document.querySelector(`[data-fm-pagina=${id}]`).hidden,false);}
  a.document.querySelector('[data-pagina=compras]').click();assert.equal(a.document.querySelector('.fm-financeiro-tabs').hidden,true);
});
test('Ausência de orçamento não vira lucro zero nem progresso físico inventado',async()=>{
  const a=await app(),dash=a.document.querySelector('.fmhub');assert.match(dash.textContent,/Previsão a preencher/);assert.doesNotMatch(dash.querySelector('[data-fm-atalho=financeiro]').textContent,/R\$/);
  assert.match(dash.textContent,/0 de 1 demandas resolvidas/);assert.match(dash.textContent,/não representa medição física/);
  assert.match(dash.textContent,/Conferir materiais/);
});
test('Rascunho em compras impede trocar de área e de obra',async()=>{
  const a=await app();let alerta='';a.ctx.alert=s=>alerta=s;
  a.document.querySelector('[data-pagina=compras]').click();const p=a.document.querySelector('[data-fm-pagina=compras]');p._fmDirty=true;
  a.document.querySelector('[data-pagina=dashboard]').click();assert.equal(p.hidden,false);assert.match(alerta,/Salve ou cancele/);
  a.document.querySelectorAll('.fm-projeto-abre')[1].click();assert.equal(a.run('filtro.fmAberta'),'a');
});
test('Reabrir uma obra retorna à visão geral, sem cair no financeiro',async()=>{
  const a=await app();a.run("filtro.fmAbas.b='realizado'");a.document.querySelectorAll('.fm-projeto-abre')[1].click();await new Promise(r=>setImmediate(r));assert.equal(a.run('filtro.fmAbas.b'),'dashboard');assert.equal(a.document.querySelector('[data-fm-pagina=dashboard]').hidden,false);
});
test('Situação filtra obras e os indicadores usam o mesmo recorte',async()=>{
  const a=await app();a.run("filtro.fmStatus='Em planejamento';document.getElementById('main').replaceChildren()");await a.run('vFortemais(document.getElementById("main"))');assert.equal(a.document.querySelectorAll('.fm-projeto').length,1);assert.equal(a.document.querySelector('.fmhub-carteira strong').textContent,'1');
});
test('Backup valida compras e imóvel sem exigir demandas, aceita ausência antiga',async()=>{
  const a=await app();assert.doesNotThrow(()=>a.run('validarBackup({...E,obras:[{id:"x",nome:"Antiga"}]})'));
  for(const campo of ['fmCompras','fmImovel']){a.ctx.campo=campo;assert.throws(()=>a.run('validarBackup({...E,obras:[{id:"x",[campo]:null}]})'));}
  assert.doesNotThrow(()=>a.run('validarBackup({...E,obras:[{id:"x",fmCompras:{versao:1,listas:[]}}]})'));
});
test('PDF do dashboard usa retrato completo de demandas e não grava no estado',async()=>{
  const a=await app(),antes=a.run('JSON.stringify(E)');a.run('fmPdfAbrir=async modelo=>{globalThis.pdfModelo=modelo;return true}');await a.run('fmDashboardPdf(E.obras[0])');
  assert.match(a.ctx.pdfModelo.conteudo,/Conferir materiais/);assert.match(a.ctx.pdfModelo.conteudo,/Equipe de teste/);assert.match(a.ctx.pdfModelo.conteudo,/Previsão incompleta/);assert.equal(a.run('JSON.stringify(E)'),antes);
});

test('Filtro de situação preserva nomes legados e personalizados',async()=>{
  const a=await app();a.run("E.obras[0].status='Em obra';E.obras[1].status='Aguardando vistoria';filtro.fmStatus='Em obra';document.getElementById('main').replaceChildren()");await a.run('vFortemais(document.getElementById("main"))');
  const select=a.document.querySelector('select[aria-label="Situação das obras"]');assert.ok([...select.querySelectorAll('option')].some(o=>o.value==='Em obra'));assert.ok([...select.querySelectorAll('option')].some(o=>o.value==='Aguardando vistoria'));assert.equal(a.document.querySelectorAll('.fm-projeto').length,1);assert.match(a.document.querySelector('.fmhub-carteira').textContent,/1 em andamento/);
});

test('Capa da obra exige anexo com vínculo exato e imagem segura',async()=>{
  const a=await app();a.run("E.obras[0].fmImovel={versao:1,capaId:'foto-outra',fotos:{'foto-outra':{}}};var urlsSolicitadas=[];arqUrlDe=async id=>{urlsSolicitadas.push(id);return 'blob:teste'};arqPor=async()=>[{id:'foto-outra',ref:'obra:outra',tipo:'image/png'}]");
  a.document.querySelector('[data-fm-pagina=dashboard]').atualizar();await new Promise(r=>setImmediate(r));assert.equal(a.run('urlsSolicitadas.length'),0);assert.match(a.document.querySelector('.fmhub-capa').textContent,/indisponível/);
});

test('Indicadores da carteira atualizam após compras e demandas sem redesenhar o formulário',async()=>{
  const a=await app(),carteira=a.document.querySelector('.fmhub-carteira');a.run("E.obras[0].fmDemandas.itens[0].situacao='Resolvida';fmDemandasAtualizarResumo(E.obras[0])");
  assert.equal(carteira.querySelectorAll('strong')[1].textContent,'0');assert.equal(a.document.querySelector('.fmhub-carteira'),carteira);
  a.run("var M=FortemaisComprasModelo, resumoAnterior=M.resumo;FortemaisComprasModelo={...M,resumo:(d,h)=>({...resumoAnterior(d,h),pendentes:2})};fmObrasAtualizarResumo()");assert.equal(carteira.querySelectorAll('strong')[2].textContent,'4');
});
