import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function app(){const a=setup();const dados=new Map();a.ctx.localStorage={getItem:k=>dados.get(k)||null,setItem:(k,v)=>dados.set(k,String(v)),removeItem:k=>dados.delete(k)};a.run('E=structuredClone(SEED);atual="fortemais"');return {...a,dados};}
const enviar=document=>document.querySelector('.fm-link-editor form').onsubmit({preventDefault(){}});
const botao=(document,nome)=>[...document.querySelectorAll('#modais button')].find(b=>b.textContent===nome);

test('Fortemais: criar, renomear e trocar destino preserva ID, obras e recarregamento',()=>{
 const {run,document}=app();run('E.obras=[{id:"obra",nome:"Obra exemplo",vendaValor:123}];fmEditarLink()');
 document.querySelector('[name=titulo]').value='  Site principal  ';document.querySelector('[name=url]').value='fortemais.example/obras';enviar(document);
 assert.equal(run('E.fortemaisLinks[0].url'),'https://fortemais.example/obras');const id=run('E.fortemaisLinks[0].id');
 run('fmEditarLink(E.fortemaisLinks[0])');document.querySelector('[name=titulo]').value='Portal da equipe';document.querySelector('[name=url]').value='https://example.com/equipe?origem=central';enviar(document);
 run('E=carregar()');assert.equal(run('E.fortemaisLinks[0].id'),id);assert.equal(run('E.fortemaisLinks[0].titulo'),'Portal da equipe');assert.equal(run('E.fortemaisLinks[0].url'),'https://example.com/equipe?origem=central');assert.equal(run('E.obras[0].vendaValor'),123);assert.equal(document.querySelector('#modais .fundo'),null);
});
test('Fortemais: cancelar edição não muda nem salva o atalho',()=>{
 const {run,document}=app();run('fmSalvarLink({titulo:"Original",url:"https://example.com"});fmEditarLink(E.fortemaisLinks[0])');const antes=run('JSON.stringify(E)');document.querySelector('[name=titulo]').value='Não salvar';botao(document,'Cancelar').click();assert.equal(run('JSON.stringify(E)'),antes);
});
test('Fortemais: destinos inválidos não são salvos e formulário mantém os campos',()=>{
 const {run,document}=app();run('fmEditarLink()');document.querySelector('[name=titulo]').value='Meu link';
 for(const url of ['javascript:alert(1)','data:text/html,teste','file:///tmp/teste','ftp://example.com','https://user:senha@example.com','sem endereço']){document.querySelector('[name=url]').value=url;enviar(document);assert.equal(run('E.fortemaisLinks.length'),0);assert.equal(document.querySelector('.fm-link-editor [role=alert]').hidden,false);assert.equal(document.querySelector('[name=url]').value,url)}
 document.querySelector('[name=url]').value='https://example.com';document.querySelector('[name=titulo]').value=' ';enviar(document);assert.equal(run('E.fortemaisLinks.length'),0);
});
test('Fortemais: links usam nova aba com isolamento e textos escapados',()=>{
 const {run,document}=app();run('E.fortemaisLinks=[{id:"a",titulo:"<img src=x> Financeiro",url:"https://example.com/painel"},{id:"b",titulo:"Revisar",url:"javascript:alert(1)"}];document.getElementById("main").appendChild(fmPainelLinks())');
 const sec=document.querySelector('.fm-links'),link=sec.querySelector('a');assert.equal(link.getAttribute('target'),'_blank');assert.equal(link.getAttribute('rel'),'noopener noreferrer');assert.equal(link.getAttribute('href'),'https://example.com/painel');assert.match(link.textContent,/<img src=x>/);assert.equal(sec.querySelector('img'),null);assert.equal(sec.querySelectorAll('a').length,1);assert.equal(sec.querySelectorAll('button').length,3);
 sec.querySelector('.fm-link-item button').click();assert.equal(document.querySelector('[name=titulo]').value,'<img src=x> Financeiro');
});
test('Fortemais: falha de armazenamento mantém estado anterior e permite tentar de novo',()=>{
 const {run,document,ctx}=app();run('fmSalvarLink({titulo:"Original",url:"https://example.com"});fmEditarLink(E.fortemaisLinks[0])');const antes=run('JSON.stringify(E)'),gravar=ctx.localStorage.setItem;
 ctx.localStorage.setItem=()=>{throw Error('quota')};document.querySelector('[name=titulo]').value='Atualizado';enviar(document);assert.equal(run('JSON.stringify(E)'),antes);assert.match(document.querySelector('.fm-link-editor [role=alert]').textContent,/Não foi possível salvar/);assert.ok(document.querySelector('#modais .fundo'));
 ctx.localStorage.setItem=gravar;enviar(document);assert.equal(run('E.fortemaisLinks[0].titulo'),'Atualizado');
});
test('Fortemais: remover exige confirmação e preserva outros links',()=>{
 const {run,document,ctx}=app();run('fmSalvarLink({titulo:"Primeiro",url:"https://example.com/1"});fmSalvarLink({titulo:"Segundo",url:"https://example.com/2"});fmEditarLink(E.fortemaisLinks[0])');botao(document,'Remover link').click();assert.equal(run('E.fortemaisLinks.length'),2);
 ctx.confirm=()=>true;botao(document,'Remover link').click();assert.equal(run('E.fortemaisLinks.length'),1);assert.equal(run('E.fortemaisLinks[0].titulo'),'Segundo');run('E=carregar()');assert.equal(run('E.fortemaisLinks.length'),1);
});
test('Fortemais: backup antigo inicia links vazios e backup novo mantém a coleção',()=>{
 const {run,ctx}=app();ctx.localStorage.setItem('centralLeo.v1',JSON.stringify({viagens:[],obras:[{id:'o',nome:'Existente'}]}));run('E=carregar()');assert.equal(run('E.fortemaisLinks.length'),0);run('fmSalvarLink({titulo:"Meu sistema",url:"https://example.com"});validarBackup(JSON.parse(JSON.stringify(E)))');assert.equal(run('E.obras[0].nome'),'Existente');assert.throws(()=>run('validarBackup({viagens:[],fortemaisLinks:"inválido"})'),/Lista inválida/);
});
test('Fortemais: atalhos aparecem antes de aguardar custos e obras continuam acessíveis',async()=>{
 const {run,document}=app();run('E.obras=[{id:"o",nome:"Obra preservada"}];fmResumo=()=>new Promise(r=>window.resumoPronto=r);var telaPendente=vFortemais(document.getElementById("main"))');assert.ok(document.querySelector('.fm-links'));assert.equal(document.querySelector('[data-bid=fm-obras]'),null);await run('window.resumoPronto({});telaPendente');assert.match(document.querySelector('[data-bid=fm-obras]').textContent,/Obra preservada/);
});
test('Fortemais: edição antiga não sobrescreve um link alterado',()=>{
 const {run}=app();run('var primeiro=fmSalvarLink({titulo:"Inicial",url:"https://example.com"});fmSalvarLink({titulo:"Novo",url:"https://example.com/novo"},primeiro)');assert.throws(()=>run('fmSalvarLink({titulo:"Antigo",url:"https://example.com/antigo"},primeiro)'),/link mudou/);assert.equal(run('E.fortemaisLinks[0].titulo'),'Novo');
});
