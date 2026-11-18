import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
const base=new URL('../publico/',import.meta.url);
function app(){
 const {document,HTMLElement}=parseHTML('<html><body></body></html>');HTMLElement.prototype.focus=function(){};
 const ctx=vm.createContext({document,console,URL,Date});
 for(const file of ['saude-esportes-dados.js','saude-esportes-guias.js','saude-esportes-forca.js','saude-esportes-visuais.js','saude-esportes.js']){
  if(file==='saude-esportes-visuais.js'&&!existsSync(new URL(file,base)))continue;
  vm.runInContext(readFileSync(new URL(file,base),'utf8'),ctx,{filename:file});
 }
 return {ctx,root:ctx.saudeEsportes()};
}
test('visuais: os 101 assuntos têm imagens distintas, existentes e sem duplicação de conteúdo',()=>{
 const {root}=app(),paths=new Map(),hashes=new Map();let count=0;
 for(const id of ['corrida','hyrox','mtb','musculacao']){
  root.querySelector('[data-esp-modalidade="'+id+'"]').click();
  for(const section of ['training','glossary','gear']){
   root.querySelector('[data-esp-tab="'+section+'"]').click();
   for(const card of root.querySelectorAll('[data-esp-item]')){
    const title=id+' / '+card.querySelector('summary strong').textContent;
    const img=card.querySelector('.esp-guia-figura img');assert.ok(img,title);
    const src=img.getAttribute('src');assert.equal(card.querySelector('.esp-ampliar-imagem').getAttribute('href'),src);assert.ok(existsSync(new URL(src,base)),title+' sem arquivo');
    assert.ok(!paths.has(src),title+' repete '+paths.get(src));paths.set(src,title);
    const sha=createHash('sha256').update(readFileSync(new URL(src,base))).digest('hex');
    assert.ok(!hashes.has(sha),title+' repete o conteúdo de '+hashes.get(sha));hashes.set(sha,title);
    assert.ok(img.alt.length>20,title+' sem descrição acessível');count++;
   }
  }
  root.querySelector('.esp-voltar').click();
 }
 assert.equal(count,101);
});
test('visuais: a busca preserva a imagem de cada assunto e a numeração original',()=>{
 const {root}=app();root.querySelector('[data-esp-modalidade="corrida"]').click();
 const before=root.querySelectorAll('[data-esp-item]')[6];
 const src=before.querySelector('.esp-guia-figura img').getAttribute('src');
 const number=before.querySelector('.esp-item-numero').textContent;
 const input=root.querySelector('[type=search]');input.value='Progressivo';input.oninput();
 const after=[...root.querySelectorAll('[data-esp-item]')].find(c=>c.querySelector('summary strong').textContent==='Progressivo');
 assert.ok(after);assert.equal(after.querySelector('.esp-guia-figura img').getAttribute('src'),src);
 assert.equal(after.querySelector('.esp-item-numero').textContent,number);
});
