import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

const armas=readFileSync(new URL('../publico/documentos-armas.js',import.meta.url),'utf8');
let opcaoNativaAjustada=false;

function app(){
  const a=setup();
  // Linkedom 0.18 desmarca outra opção até ao definir selected=false.
  // No navegador isso afeta só a própria opção; preservamos essa semântica
  // para verificar a pré-seleção do formulário sem alterar código da aplicação.
  if(!opcaoNativaAjustada){
    const proto=Object.getPrototypeOf(a.document.createElement('option'));
    const descriptor=Object.getOwnPropertyDescriptor(proto,'selected');
    Object.defineProperty(proto,'selected',{...descriptor,set(valor){
      if(valor)descriptor.set.call(this,valor);else this.removeAttribute('selected');
    }});
    opcaoNativaAjustada=true;
  }
  a.run(armas);
  a.run(`
    E.pessoas=[{id:'p-ana',nome:'Ana Exemplo'},{id:'p-bruno',nome:'Bruno Exemplo'},{id:'p-sem',nome:'Pessoa sem documentos'}];
    E.documentos=[
      {id:'doc-ana-passaporte',nome:'Passaporte',dono:'Ana Exemplo',numero:'PASS-DEMO',validade:'2099-12-31',onde:'Pasta de teste'},
      {id:'doc-leo-cnh',nome:'CNH',dono:'Léo',numero:'CNH-DEMO',validade:'2099-01-01'},
      {id:'doc-ana-cnh',nome:'CNH',dono:' ANA   EXEMPLO ',numero:'ANTIGO-DEMO',validade:'2001-01-01'},
      {id:'doc-bruno-certidao',nome:'Certidão',dono:'Bruno Exemplo',numero:'CERT-DEMO',validade:''},
      {id:'doc-sem-dono',nome:'Carteira',numero:'CARTEIRA-DEMO',validade:''},
      {id:'doc-leo-rg',nome:'RG',dono:'léo',numero:'RG-DEMO',validade:hoje()},
      {id:'arma-exemplo',grupo:'armas',tipoRegistro:'arma',nome:'Arma fictícia',dono:'Ana Exemplo',validade:'2099-01-01'}
    ];
    filtro.docAba='documentos';filtro.docBusca='';filtro.docPessoa='Todos';filtro.docStatus='Todos';
    atual='documentos';
  `);
  return a;
}

const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const grupos=a=>[...a.document.querySelectorAll('#main .documentos-pessoa')];
const grupo=(a,nome)=>grupos(a).find(g=>normalize(g.querySelector('h2').textContent)===normalize(nome));
const chips=a=>[...a.document.querySelectorAll('#main .documento-chip')];
const buttons=(root,texto)=>[...root.querySelectorAll('button')].filter(b=>b.textContent.trim()===texto);
const resumo=a=>a.document.querySelector('#main .workspace-note[role=status]').textContent;
function selecionar(a,label,valor){
  const select=a.document.querySelector(`[aria-label="${label}"]`);
  assert.ok([...select.options].some(o=>o.value===valor),`Opção ${valor} disponível`);
  [...select.options].forEach(o=>o.selected=o.value===valor);
  select.onchange();
}
function preencher(input,valor){
  input.value=valor;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event('input',{bubbles:true}));
}
function campoModal(a,rotulo){
  return [...a.document.querySelectorAll('#modais .campo')].find(c=>c.querySelector('label')?.textContent===rotulo)?.querySelector('input,textarea,select');
}

test('documentos em chips agrupam nomes equivalentes e dono ausente sem reescrever registros',()=>{
  const a=app(),antes=a.run('JSON.stringify({documentos:E.documentos,pessoas:E.pessoas})');
  a.run('tela()');
  assert.equal(grupos(a).length,3);
  assert.equal(grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip').length,2);
  assert.equal(grupo(a,'Léo').querySelectorAll('.documento-chip').length,3);
  assert.equal(grupo(a,'Bruno Exemplo').querySelectorAll('.documento-chip').length,1);
  assert.equal(grupo(a,'Pessoa sem documentos'),undefined);
  assert.equal(chips(a).length,6);
  assert.equal(a.run('JSON.stringify({documentos:E.documentos,pessoas:E.pessoas})'),antes);
  assert.match(grupo(a,'Ana Exemplo').querySelector('.documentos-pessoa-total').textContent,/2/);
  assert.match(resumo(a),/6 de 6 documento/);
});

test('documentos preservam pessoas diferentes que não são equivalentes no cadastro',()=>{
  const a=app();a.run("E.documentos.push({id:'doc-outro-nome',nome:'RG',dono:'Leonardo Exemplo'});tela()");
  assert.ok(grupo(a,'Leonardo Exemplo'));
  assert.ok(grupo(a,'Léo'));
  assert.equal(grupos(a).length,4);
});

test('chips são botões com nome, validade e status textual, mantendo vencimentos primeiro na pessoa',()=>{
  const a=app();a.run('tela()');
  const ana=[...grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip')];
  assert.ok(chips(a).every(c=>c.tagName==='BUTTON'));
  assert.match(ana[0].textContent,/CNH/);
  assert.match(ana[0].textContent,/Vencido/);
  assert.match(ana[0].textContent,/01\/01\/2001/);
  assert.match(ana[1].textContent,/Passaporte/);
  assert.match(ana[1].textContent,/Em dia/);
  assert.match(ana[1].textContent,/31\/12\/2099/);
  assert.match(grupo(a,'Bruno Exemplo').textContent,/Validade não informada/);
  assert.match(grupo(a,'Léo').textContent,/Vencendo/);
});

test('busca combina referência, pessoa e validade sem misturar chips de outros grupos',()=>{
  const a=app();a.run('tela()');
  selecionar(a,'Pessoa do documento','Ana Exemplo');
  const busca=a.document.querySelector('[aria-label="Buscar documento"]');
  busca.value='antigo-demo';busca.oninput();
  selecionar(a,'Situação do documento','Vencido');
  assert.equal(chips(a).length,1);
  assert.equal(grupos(a).length,1);
  assert.match(grupo(a,'Ana Exemplo').textContent,/CNH/);
  assert.match(resumo(a),/1 de 6 documento/);
  selecionar(a,'Situação do documento','Em dia');
  assert.equal(chips(a).length,0);
  assert.match(resumo(a),/0 de 6 documento/);
  buttons(a.document.querySelector('#main'),'Limpar filtros')[0].click();
  assert.equal(chips(a).length,6);
  assert.equal(grupos(a).length,3);
});

test('validade a conferir mantém registros sem data ou com data inválida, sem falso Em dia',()=>{
  const a=app();a.run("E.documentos.push({id:'doc-invalido',nome:'Cadastro teste',dono:'Ana Exemplo',validade:'2026-02-30'});filtro.docStatus='Conferir validade';tela()");
  assert.equal(chips(a).length,3);
  assert.equal(grupos(a).length,3);
  assert.ok(chips(a).some(c=>c.textContent.includes('Data inválida')));
  assert.ok(chips(a).every(c=>!c.textContent.includes('Em dia')));
});

test('cabeçalho da pessoa abre inclusão com o dono correto e cancelar preserva lista',()=>{
  const a=app();a.run('tela()');
  buttons(grupo(a,'Ana Exemplo'),'+ Documento')[0].click();
  assert.equal(a.document.querySelector('#modais [name=dono]').value,'Ana Exemplo');
  a.document.querySelector('#modais .fechar').click();
  assert.equal(a.run('E.documentos.length'),7);
  assert.equal(chips(a).length,6);
});

test('salvar novo documento exibe chip e contagem imediatamente, mesmo após filtro incompatível',()=>{
  const a=app();a.run("filtro.docPessoa='Ana Exemplo';filtro.docBusca='ANTIGO-DEMO';filtro.docStatus='Vencido';tela()");
  buttons(grupo(a,'Ana Exemplo'),'+ Documento')[0].click();
  const form=a.document.querySelector('#modais form');
  form.querySelector('[name=nome]').value='Identidade de teste';
  form.querySelector('[name=numero]').value='NOVO-DEMO';
  form.querySelector('[name=validade]').value='2099-05-01';
  form.onsubmit({preventDefault(){}});
  assert.equal(a.run('E.documentos.length'),8);
  assert.equal(a.run('E.documentos.at(-1).dono'),'Ana Exemplo');
  assert.equal(a.run('filtro.docBusca'),'');
  assert.equal(a.run('filtro.docStatus'),'Todos');
  assert.equal(a.run('filtro.docPessoa'),'Ana Exemplo');
  assert.equal(grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip').length,3);
  assert.match(grupo(a,'Ana Exemplo').textContent,/Identidade de teste/);
  assert.match(grupo(a,'Ana Exemplo').querySelector('.documentos-pessoa-total').textContent,/3/);
  assert.match(resumo(a),/3 de 7 documento/);
  assert.match(a.document.querySelector('#modais h3').textContent,/Identidade de teste/);
});

test('pessoa selecionada sem documentos recebe seu primeiro chip pela inclusão geral',()=>{
  const a=app();a.run("filtro.docPessoa='Pessoa sem documentos';tela()");
  assert.equal(chips(a).length,0);
  assert.match(a.document.querySelector('.workspace-empty').textContent,/Nenhum documento/);
  buttons(a.document.querySelector('#main'),'+ Novo documento')[0].click();
  const form=a.document.querySelector('#modais form');
  assert.equal(form.querySelector('[name=dono]').value,'Pessoa sem documentos');
  form.querySelector('[name=nome]').value='Primeiro documento de teste';
  form.onsubmit({preventDefault(){}});
  assert.equal(grupo(a,'Pessoa sem documentos').querySelectorAll('.documento-chip').length,1);
  assert.equal(a.run('E.documentos.at(-1).dono'),'Pessoa sem documentos');
});

test('documentos homônimos se distinguem e cada chip abre o registro correspondente',()=>{
  const a=app();a.run("E.documentos.push({id:'doc-ana-segundo-passaporte',nome:'Passaporte',dono:'Ana Exemplo',numero:'OUTRO-DEMO',validade:'2099-12-31'});tela()");
  const documentos=[...grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip')].filter(c=>c.textContent.includes('Passaporte'));
  assert.equal(documentos.length,2);
  assert.notEqual(documentos[0].textContent,documentos[1].textContent);
  for(const referencia of ['PASS-DEMO','OUTRO-DEMO']){
    const atual=[...grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip')].find(c=>c.textContent.includes(referencia));
    assert.ok(atual,`Referência ${referencia} aparece no chip`);
    atual.click();
    assert.equal(campoModal(a,'Número / referência').value,referencia);
    a.document.querySelector('#modais .fechar').click();
  }
});

test('editar documento move o chip e atualiza contagens depois de fechar a ficha',()=>{
  const a=app();a.run('tela()');
  [...grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip')].find(c=>c.textContent.includes('Passaporte')).click();
  preencher(campoModal(a,'Documento'),'Passaporte atualizado');
  preencher(campoModal(a,'De quem'),'Bruno Exemplo');
  buttons(a.document.querySelector('#modais'),'Pronto')[0].click();
  assert.equal(grupo(a,'Ana Exemplo').querySelectorAll('.documento-chip').length,1);
  assert.equal(grupo(a,'Bruno Exemplo').querySelectorAll('.documento-chip').length,2);
  assert.match(grupo(a,'Bruno Exemplo').textContent,/Passaporte atualizado/);
  assert.equal(a.run("E.documentos.find(d=>d.id==='doc-ana-passaporte').dono"),'Bruno Exemplo');
  assert.equal(a.run("E.documentos.find(d=>d.id==='doc-ana-passaporte').numero"),'PASS-DEMO');
});

test('excluir um documento retira somente seu chip e conserva os demais registros',async()=>{
  const a=app();a.ctx.confirm=()=>true;a.run('tela()');
  const antes=a.run("JSON.stringify(E.documentos.filter(d=>d.id!=='doc-bruno-certidao'))");
  grupo(a,'Bruno Exemplo').querySelector('.documento-chip').click();
  await buttons(a.document.querySelector('#modais'),'Apagar')[0].onclick();
  assert.equal(grupo(a,'Bruno Exemplo'),undefined);
  assert.equal(chips(a).length,5);
  assert.equal(a.run('JSON.stringify(E.documentos)'),antes);
  assert.match(resumo(a),/5 de 5 documento/);
});

test('aba Armas mantém fichas próprias e não entra nos chips nem nas contagens de documentos',()=>{
  const a=app();a.run('tela()');
  assert.equal(chips(a).length,6);
  assert.equal(chips(a).some(c=>c.textContent.includes('Arma fictícia')),false);
  a.run("filtro.docAba='armas';tela()");
  assert.equal(chips(a).length,0);
  assert.equal(a.document.querySelectorAll('#main .da-card-arma').length,1);
  assert.match(a.document.querySelector('#main .da-card-arma').textContent,/Arma fictícia/);
  a.run("filtro.docAba='documentos';tela()");
  assert.equal(chips(a).length,6);
});

test('nomes e referências com HTML são exibidos como texto nos grupos e chips',()=>{
  const a=app();a.run(`E.documentos=[{id:'doc-html',dono:'<img src=x onerror=alert(1)>',nome:'<script>teste</script>',numero:'<img src=y>',validade:''}];tela()`);
  assert.equal(a.document.querySelectorAll('.documentos-pessoa img,.documentos-pessoa script').length,0);
  assert.match(grupos(a)[0].querySelector('h2').textContent,/<img src=x/);
  assert.match(chips(a)[0].textContent,/<script>teste<\/script>/);
});
