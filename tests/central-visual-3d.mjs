import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

test('Central 3D: cada área tem um arquivo local leve e independente',()=>{
 const {run}=setup();
 const imagens=JSON.parse(run('JSON.stringify(LeonardoDesign.imagens)'));
 assert.deepEqual(Object.keys(imagens),JSON.parse(run('JSON.stringify(MODS.filter(m=>!m.url).map(m=>m.id))')));
 assert.equal(new Set(Object.values(imagens)).size,Object.keys(imagens).length);
 for(const [id,caminho] of Object.entries(imagens)){
  const arquivo=readFileSync(new URL('../publico/'+caminho,import.meta.url));
  assert.equal(arquivo.subarray(8,12).toString(),'WEBP',id);
  assert.ok(arquivo.length<130000,id+' deve carregar sem imagem de tamanho original');
 }
});

test('Central 3D: atalhos filtram por nome e assunto sem gravar dados',()=>{
 const {run,document}=setup();
 run("var estadoAntes=JSON.stringify(E);var gravacoes=0;localStorage.setItem=()=>gravacoes++;irTela('inicio')");
 const raiz=document.querySelector('.leo-areas');
 assert.equal(raiz.querySelectorAll('[data-area]').length,8);
 const todos=raiz.querySelector('.leo-areas-alternar');todos.click();
 const esperados=JSON.parse(run("JSON.stringify(MODS.filter(m=>!m.url&&!m.oculto&&m.id!=='inicio').map(m=>m.id))"));
 assert.deepEqual([...raiz.querySelectorAll('[data-area]')].map(x=>x.dataset.area),esperados);
 assert.equal(todos.getAttribute('aria-expanded'),'true');
 const input=raiz.querySelector('input');input.value='saude';input.oninput();
 assert.deepEqual([...raiz.querySelectorAll('[data-area]')].map(x=>x.dataset.area),['saude']);
 assert.equal(raiz.querySelector('[role=status]').textContent,'1 área encontrada');
 input.value='reservas';input.oninput();assert.equal(raiz.querySelector('[data-area]').dataset.area,'viagens');
 input.value='zzzz';input.oninput();assert.equal(raiz.querySelectorAll('[data-area]').length,0);assert.match(raiz.querySelector('[role=status]').textContent,/Nenhuma área/);
 input.value='';input.oninput();todos.click();assert.equal(raiz.querySelectorAll('[data-area]').length,8);
 assert.equal(run('JSON.stringify(E)===estadoAntes'),true);assert.equal(run('gravacoes'),0);
});

test('Central 3D: atalho abre a área correta e conserva menu e identificação acessível',()=>{
 const {run,document}=setup();run("irTela('inicio')");
 const bt=document.querySelector('.leo-area-card[data-area=demandas]');
 assert.equal(bt.getAttribute('aria-label'),'Abrir Demandas');assert.equal(bt.querySelector('img').getAttribute('alt'),'');
 bt.click();assert.equal(run('atual'),'demandas');assert.equal(document.querySelector('.pagina').dataset.leoArea,'demandas');
 assert.equal(document.querySelector('#nav [aria-current=page] .tx').textContent,'Demandas');
 assert.ok(document.querySelector('#main h1'));
});

test('Central: lateral usa emojis sem alterar os atalhos externos nem os cards 3D',()=>{
 const {run,document}=setup();run("menu();var destinosTeste=[];window.open=(...a)=>destinosTeste.push(a)");
 const botoes=[...document.querySelectorAll('#nav button')];
 for(const bt of botoes){
  const ic=bt.querySelector('.ic');
  assert.equal(ic.getAttribute('aria-hidden'),'true');
  assert.equal(ic.querySelector('img,svg'),null);
  assert.match(ic.textContent,/\p{Extended_Pictographic}/u,bt.querySelector('.tx').textContent);
 }
 assert.equal(botoes.find(x=>x.querySelector('.tx').textContent==='Google Drive').querySelector('.ic').textContent,'📁');
 assert.equal(botoes.find(x=>x.querySelector('.tx').textContent==='Strava').querySelector('.ic').textContent,'🏃');
 const externos=JSON.parse(run('JSON.stringify(MODS.filter(m=>m.url).map(m=>({nome:m.nome,url:m.url})))'));
 externos.forEach(m=>{
  const bt=[...document.querySelectorAll('#nav button')].find(x=>x.querySelector('.tx').textContent===m.nome);
  assert.ok(bt.querySelector('.fora'));assert.equal(bt.hasAttribute('aria-current'),false);bt.click();
 });
 assert.deepEqual(JSON.parse(run('JSON.stringify(destinosTeste)')),externos.map(m=>[m.url,'_blank','noopener']));
 run("irTela('inicio')");
 assert.ok(document.querySelector('.leo-area-card img.leo-icone-3d'));
 assert.equal(document.querySelector('#nav [aria-current=page] .tx').textContent,'Início');
});
