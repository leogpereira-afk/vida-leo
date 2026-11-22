import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const base=new URL('../publico/',import.meta.url);
function app(){
 const {document,HTMLElement}=parseHTML('<html><body></body></html>');HTMLElement.prototype.focus=function(){};
 const ctx=vm.createContext({document,console,URL,Date});
 Object.defineProperty(ctx,'E',{get(){throw Error('Não consultar dados clínicos');}});
 for(const file of ['saude-esportes-dados.js','saude-esportes-guias.js','saude-esportes-forca.js','saude-esportes-visuais.js','saude-esportes.js'])vm.runInContext(readFileSync(new URL(file,base),'utf8'),ctx,{filename:file});
 return {ctx,root:ctx.saudeEsportes()};
}
const words=x=>JSON.stringify(x).split(/\s+/).length;
test('guias: musculação cobre treze regiões, com execução, adaptações e referência específica',()=>{
 const {ctx}=app();const items=ctx.SaudeEsportesForca;
 assert.deepEqual(Array.from(items,x=>x.id),['peito','costas','ombros','biceps','triceps','antebracos','quadriceps','posteriores','gluteos','panturrilhas','abdomen','core-lateral','quadril']);
 for(const item of items){
  assert.ok(words(item)>210,item.title+' superficial');
  assert.ok(item.muscles&&item.breathing&&item.dose&&item.progression&&item.stop,item.title);
  assert.ok(item.steps.length>=4&&item.setup.length>=2&&item.commonMistakes.length>=2&&item.adaptations.length>=2,item.title);
  assert.ok(item.sources.some(s=>s.startsWith('forca-')),item.title+' sem fonte de execução');
 }
});
test('guias: corrida HYROX e MTB preservam práticas e têm explicações aprofundadas',()=>{
 const {ctx}=app();for(const [id,n] of [['corrida',8],['hyrox',8],['mtb',6]]){
  assert.equal(ctx.SaudeEsportesGuias[id].length,n);
  for(const item of ctx.SaudeEsportesGuias[id]){
   assert.ok(words(item)>180,id+' '+item.title);
   assert.ok(item.steps.length>=3&&item.setup.length>=1&&item.commonMistakes.length>=1,item.title);
   assert.ok(item.dose&&item.progression&&item.stop,item.title);
  }
 }
});
test('guias UI: cada prática mostra foto real do asset, passos e conteúdo de músculos no detalhe',()=>{
 const {root}=app();for(const id of ['corrida','hyrox','mtb','musculacao']){
  root.querySelector('[data-esp-modalidade="'+id+'"]').click();
  const cards=[...root.querySelectorAll('[data-esp-item]')];assert.ok(cards.length>=6);
  for(const card of cards){
   const img=card.querySelector('.esp-guia-figura img');assert.ok(img,card.textContent.slice(0,80));
   assert.ok(existsSync(new URL(img.getAttribute('src'),base)),img.getAttribute('src'));
   assert.match(card.textContent,/Execução passo a passo/);assert.match(card.textContent,/O que trabalha/);assert.match(card.textContent,/Como progredir/);
   assert.ok(card.querySelector('ol li'));
  }
  root.querySelector('.esp-voltar').click();
 }
});
test('guias: todas fontes citadas resolvem para referências identificadas com URL HTTPS',()=>{
 const {ctx}=app();const fontes={...ctx.SaudeEsportesDados.sources,...ctx.SaudeEsportesGuiasFontes,...ctx.SaudeEsportesForcaFontes};
 for(const items of [...Object.values(ctx.SaudeEsportesGuias),ctx.SaudeEsportesForca])for(const item of items)for(const id of item.sources){assert.ok(fontes[id],id);assert.match(fontes[id].url,/^https:\/\//);assert.ok(fontes[id].application&&fontes[id].limitation,id);}
});
test('guias UI: modelos oficiais possuem fotos, fabricante, uso e limitação',()=>{
 const {root}=app();for(const id of ['corrida','hyrox','mtb','musculacao']){
  root.querySelector('[data-esp-modalidade="'+id+'"]').click();root.querySelector('[data-esp-tab="gear"]').click();
  const cards=[...root.querySelectorAll('.esp-produto')];assert.ok(cards.length>=3);
  for(const card of cards){assert.match(card.querySelector('img').getAttribute('src'),/^https:\/\//);assert.ok(card.querySelector('.esp-produto-limite'));assert.match(card.querySelector('a').getAttribute('href'),/^https:\/\//);}
  root.querySelector('.esp-voltar').click();
 }
});
test('guias UI: busca encontra músculos e alternativas dentro dos detalhes',()=>{
 const {root}=app();root.querySelector('[data-esp-modalidade="musculacao"]').click();const inp=root.querySelector('[type=search]');inp.value='romboides';inp.oninput();assert.equal(root.querySelectorAll('[data-esp-item]').length,1);assert.match(root.querySelector('[data-esp-item]').textContent,/Costas/);
});
test('guias UI: busca também alcança alertas e cuidados dos passos expandidos',()=>{
 const {root}=app();root.querySelector('[data-esp-modalidade="musculacao"]').click();const inp=root.querySelector('[type=search]');
 inp.value='pinçamento';inp.oninput();assert.ok(root.querySelectorAll('[data-esp-item]').length>=1);assert.match(root.querySelector('[data-esp-item]').textContent,/Ombros/);
 inp.value='deslize';inp.oninput();assert.ok(root.querySelectorAll('[data-esp-item]').length>=1);assert.match(root.querySelector('[data-esp-item]').textContent,/Glúteos/);
});
test('guias UI: vocabulário e equipamentos têm imagens e explicação além do resumo',()=>{
 const {root}=app();for(const id of ['corrida','hyrox','mtb','musculacao']){
  root.querySelector('[data-esp-modalidade="'+id+'"]').click();
  for(const sec of ['glossary','gear']){
   root.querySelector('[data-esp-tab="'+sec+'"]').click();
   for(const card of root.querySelectorAll('[data-esp-item]')){
    const img=card.querySelector('.esp-guia-figura img');assert.ok(img);
    assert.ok(existsSync(new URL(img.getAttribute('src'),base)),img.getAttribute('src'));
    assert.ok(card.querySelector('.esp-item-detalhes').textContent.split(/\s+/).length>=70,id+' '+sec+' '+card.textContent.slice(0,80));
   }
  }
  root.querySelector('.esp-voltar').click();
 }
});

test('atlas em Musculação abre a variação correta de cada exercício e filtra por nome',()=>{
 const {root}=app();
 root.querySelector('[data-esp-modalidade="musculacao"]').click();
 const nav=root.querySelector('nav.esp-atlas');
 assert.ok(nav);
 for(const [nome,vista] of [['Supino reto com barra','supino'],['Agachamento com barra nas costas','agachamento'],['Rosca com halteres','rosca']]){
   const href='atlas/?vista='+vista+'&animar=1';
   assert.equal(nav.querySelector('a[href="'+href+'"]').textContent,nome);
   const related=root.querySelector('[data-esp-item] a[href="'+href+'"]');
   assert.equal(related?.textContent,nome);
 }
 const busca=root.querySelector('input[type="search"]');
 busca.value='barra nas costas';busca.oninput();
 assert.equal(root.querySelectorAll('.esp-atlas a').length,1);
 assert.ok(root.querySelector('[data-esp-item] a[href="atlas/?vista=agachamento&animar=1"]'));
 assert.ok(existsSync(new URL('atlas/index.html',base)));
});
