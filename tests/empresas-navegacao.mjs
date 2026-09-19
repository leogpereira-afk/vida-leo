import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
function app(){const a=setup();a.run("E=structuredClone(SEED);E.empresasPJ=[{id:'a',nome:'Alfa',status:'Ativa'},{id:'b',nome:'Beta',status:'Ativa'}];E.estrategia={};E.planejamentoEmpresas=[];normalizarEmpresas(E);filtro.empresaId='a';atual='empresas';menu();tela()");return a}
const botao=(a,label)=>[...a.document.querySelectorAll('button')].find(b=>b.textContent===label);
test('planejamento fica dentro de Empresas e os projetos abrem nos destinos corretos',()=>{
 const a=app();assert.ok(![...a.document.querySelectorAll('#nav button')].some(b=>b.textContent.includes('Planejamento estratégico')));
 assert.ok(botao(a,'♟️ Planejamento estratégico'));assert.ok(a.document.querySelector('.empresas-chips'));
 for(const [id,path]of [['domo','domo'],['diamond','diamond'],['minaslab','minaslab-painel']])assert.equal(a.run(`MODS.find(m=>m.id==='${id}').url`),`https://leogpereira-afk.github.io/${path}/`);
 botao(a,'♟️ Planejamento estratégico').click();assert.equal(a.run('atual'),'empresas');assert.equal(a.document.querySelector('#empresas-planejamento').hidden,false);assert.ok(a.document.querySelector('#empresas-planejamento .strategy-start'));
});
test('trocar chip troca plano e objetivo sem levar conteúdo de outra empresa',()=>{
 const a=app();a.run("const p=criarPlanoEmpresa('a',2027);p.objetivos=[{id:'meta-a',titulo:'Meta exclusiva Alfa',acoes:[]}];empresaAbrirPlano(E.empresasPJ[0],p)");
 assert.match(a.document.querySelector('#empresas-planejamento').textContent,/Meta exclusiva Alfa/);const antes=a.run('JSON.stringify(E)');
 a.document.querySelectorAll('.empresas-chips button')[1].click();assert.equal(a.run('filtro.empresaId'),'b');assert.equal(a.run('filtro.estrEmpresaId'),'b');assert.equal(a.run('filtro.estrObjetivo'),'');assert.equal(a.run('filtro.estrPlano'),'');
 assert.doesNotMatch(a.document.querySelector('#empresas-planejamento').textContent,/Meta exclusiva Alfa/);assert.match(a.document.querySelector('#empresas-planejamento').textContent,/Beta/);assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('referências não invadem a visão de gestão e permanecem acessíveis',()=>{
 const a=app();assert.equal(a.document.querySelector('#empresa-bancos').closest('.workspace-pane').id,'empresas-referencias');assert.equal(a.document.querySelector('#empresa-imoveis').closest('.workspace-pane').hidden,true);assert.equal(a.document.querySelector('#empresa-liderancas').closest('.workspace-pane').id,'empresas-liderancas');
 const antes=a.run('JSON.stringify(E)');botao(a,'🏛️ Referências').click();assert.equal(a.document.querySelector('#empresas-referencias').hidden,false);assert.equal(a.run('JSON.stringify(E)'),antes);
 a.run("empresaAbrir('b','documentos')");assert.equal(a.run('filtro.empresaId'),'b');assert.equal(a.document.querySelector('#empresas-referencias').hidden,false);
});
test('rota antiga e retorno do formulário continuam dentro da empresa escolhida',()=>{
 const a=app();a.run("const p=criarPlanoEmpresa('b',2027);p.objetivos=[{id:'o',titulo:'Objetivo Beta',acoes:[]}];filtro.estrEmpresaId='b';filtro.estrPlano=p.id;atual='estrategia';menu();tela()");
 assert.equal(a.document.querySelector('#empresas-planejamento').hidden,false);assert.equal(a.run('filtro.empresaId'),'b');assert.match(a.document.querySelector('#nav [aria-current=page]').textContent,/Empresas/);
 botao(a,'👥 Lideranças').click();assert.equal(a.run('atual'),'empresas');assert.equal(a.document.querySelector('#empresas-liderancas').hidden,false);
 botao(a,'♟️ Planejamento estratégico').click();a.run("modalObjetivo({id:'novo',acoes:[]},rr('estrategia'),true,E.planejamentoEmpresas[0])");
 const f=a.document.querySelector('#modais form');f.querySelector('[name=titulo]').value='Novo objetivo Beta';f.onsubmit({preventDefault(){}});
 assert.match(a.document.querySelector('#empresas-planejamento').textContent,/Novo objetivo Beta/);assert.equal(a.run('filtro.empresaId'),'b');
});
test('buscar chips não troca silenciosamente a empresa selecionada',()=>{
 const a=app(),input=a.document.querySelector('.empresas-seletor input');input.value='Beta';input.oninput();assert.equal(a.run('filtro.empresaId'),'a');assert.equal(a.document.querySelectorAll('.empresas-chips button').length,1);
 a.document.querySelector('.empresas-chips button').click();assert.equal(a.run('filtro.empresaId'),'b');
});

test('seletor do celular troca empresa sem levar plano ou filtros anteriores',()=>{const a=app();const s=a.document.querySelector('[aria-label="Selecionar empresa"] select');s.querySelector('[value=b]').selected=true;s.onchange();assert.equal(a.run('filtro.empresaId'),'b');assert.equal(a.document.querySelector('.empresa-contexto h2').textContent,'Beta');});
test('indicador de bloqueios abre os objetivos bloqueados da empresa selecionada',()=>{const a=app();a.run("const p=criarPlanoEmpresa('a',2027);p.objetivos=[{id:'ob',titulo:'Prioridade bloqueada',acoes:[{id:'ac',oque:'Definir orçamento',status:'Travada'}]},{id:'ol',titulo:'Prioridade livre',acoes:[]}];tela()");a.document.querySelectorAll('.central-metrica')[3].click();assert.equal(a.run('filtro.estrFiltro'),'travadas');assert.equal(a.run('filtro.empresaId'),'a');assert.equal(a.document.querySelector('#empresas-planejamento').hidden,false);assert.match(a.document.querySelector('#estr-plano').textContent,/Prioridade bloqueada/);});
