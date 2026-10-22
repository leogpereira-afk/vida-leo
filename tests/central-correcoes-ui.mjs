import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function digitar(document,valor){
  const input=document.querySelector('.rotina-busca input');
  input.value=valor;
  input.dispatchEvent(new document.defaultView.Event('input',{bubbles:true}));
}
const demandas=document=>[...document.querySelectorAll('[data-bid="dm-lista"] tbody tr')].map(l=>l.querySelector('b').textContent);

test('Demandas filtra durante a digitação e mantém o filtro de pendências',()=>{
  const a=setup();
  a.run("E.demandas=[{id:'d1',titulo:'Revisão de contrato',area:'Administrativo',status:'Aberta'},{id:'d2',titulo:'Conferir estoque',area:'Operação',status:'Aberta'},{id:'d3',titulo:'Revisão encerrada',status:'Concluída'}];filtro.demandas='Pendentes';irTela('demandas')");
  assert.deepEqual(demandas(a.document),['Conferir estoque','Revisão de contrato']);
  digitar(a.document,'revisao');
  assert.deepEqual(demandas(a.document),['Revisão de contrato']);
  assert.equal(a.run('filtro.demandasBusca'),'revisao');
  assert.equal(a.run('filtro.demandas'),'Pendentes');
});

test('limpar a busca restaura as demandas do filtro sem modificar cadastros',()=>{
  const a=setup();
  a.run("E.demandas=[{id:'d1',titulo:'Contrato',area:'Jurídico',obs:'Assinar revisão',status:'Aberta'},{id:'d2',titulo:'Estoque',status:'Aberta'},{id:'d3',titulo:'Contrato concluído',status:'Concluída'}];var antesDaBusca=JSON.stringify(E);filtro.demandas='Pendentes';irTela('demandas')");
  digitar(a.document,'assinar');
  assert.deepEqual(demandas(a.document),['Contrato']);
  digitar(a.document,'');
  assert.deepEqual(demandas(a.document),['Contrato','Estoque']);
  assert.equal(a.run('filtro.demandasBusca'),'');
  assert.equal(a.run('JSON.stringify(E)===antesDaBusca'),true);
});

test('busca aguarda a composição e aceita limpar pelo evento nativo sem duplicar a renderização',()=>{
  const a=setup();
  a.run("E.demandas=[{id:'d1',titulo:'Contrato',status:'Aberta'},{id:'d2',titulo:'Estoque',status:'Aberta'}];filtro.demandas='Pendentes';irTela('demandas')");
  let input=a.document.querySelector('.rotina-busca input');
  input.value='contra';
  const compondo=new a.document.defaultView.Event('input',{bubbles:true});
  Object.defineProperty(compondo,'isComposing',{value:true});
  input.dispatchEvent(compondo);
  assert.deepEqual(demandas(a.document),['Contrato','Estoque']);
  assert.equal(a.document.querySelector('.rotina-busca input'),input);
  input.oncompositionend();
  assert.deepEqual(demandas(a.document),['Contrato']);
  input=a.document.querySelector('.rotina-busca input');input.value='';input.onsearch();
  assert.deepEqual(demandas(a.document),['Contrato','Estoque']);
  const pagina=a.document.querySelector('.pagina');
  input=a.document.querySelector('.rotina-busca input');input.oninput();input.onchange();input.onsearch();
  assert.equal(a.document.querySelector('.pagina'),pagina);
});

test('Viagens usa a busca imediata combinada com ano e situação',()=>{
  const a=setup();
  a.run("E.viagens=[{id:'v1',evento:'Encontro',cidade:'Destino de exemplo',ida:'2027-01-10',volta:'2027-01-11',status:'Confirmado'},{id:'v2',evento:'Férias',cidade:'Outra cidade',ida:'2027-02-01',volta:'2027-02-02',status:'Confirmado'},{id:'v3',evento:'Encontro anterior',cidade:'Destino de exemplo',ida:'2026-01-01',volta:'2026-01-02',status:'Confirmado'},{id:'v4',evento:'Planejamento',cidade:'Destino de exemplo',ida:'2027-03-01',volta:'2027-03-02',status:'Em Planejamento'}];filtro.viagensAno='2027';filtro.viagens='Confirmado';irTela('viagens')");
  digitar(a.document,'destino de exemplo');
  const linhas=[...a.document.querySelectorAll('[data-bid="vg-lista"] tbody tr')];
  assert.equal(linhas.length,1);
  assert.match(linhas[0].textContent,/Encontro/);
  assert.equal(a.run('filtro.viagensBusca'),'destino de exemplo');
  assert.equal(a.run('filtro.viagensAno'),'2027');
  assert.equal(a.run('filtro.viagens'),'Confirmado');
  digitar(a.document,'');
  assert.equal(a.document.querySelectorAll('[data-bid="vg-lista"] tbody tr').length,2);
});

test('editor de listas conserva inclusão única e remoção depois da reorganização mobile',()=>{
  const a=setup();
  a.run("E.config=E.config||{};E.config.areasDemanda=['Área de exemplo'];var avisos=[];alert=t=>avisos.push(t);var redesenharLista=()=>{document.getElementById('main').replaceChildren(editorLista('areasDemanda',redesenharLista))};redesenharLista()");
  let form=a.document.querySelector('form');
  form.querySelector('input').value='  Nova área de exemplo  ';
  form.onsubmit({preventDefault(){}});
  assert.equal(a.run("CFG('areasDemanda').join('|')"),'Área de exemplo|Nova área de exemplo');
  form=a.document.querySelector('form');form.querySelector('input').value='nova área de exemplo';form.onsubmit({preventDefault(){}});
  assert.equal(a.run("CFG('areasDemanda').length"),2);
  assert.equal(a.run('avisos.length'),1);
  a.document.querySelectorAll('.lixo')[1].click();
  assert.equal(a.run("CFG('areasDemanda').join('|')"),'Área de exemplo');
});
