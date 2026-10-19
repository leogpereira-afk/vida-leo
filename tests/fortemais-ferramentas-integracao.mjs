import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function app(){const a=setup();a.run("E=structuredClone(SEED);atual='fortemais';E.obras=[{id:'obra-teste',nome:'Obra sintética'}];");return a;}
test('Fortemais permite chegar às ferramentas e dicas sem perder Obras ou Inovações',async()=>{
 const a=app();a.run('tela()');await tick();
 for(const id of ['obras','inovacoes','ferramentas','dicas'])assert.ok(a.document.querySelector('[data-fm-visao="'+id+'"]'),'Área acessível '+id);
 a.document.querySelector('[data-fm-visao=ferramentas]').click();await tick();
 assert.ok(a.document.querySelector('[data-fm-pagina=ferramentas]'));
 assert.equal(a.run('E.obras[0].id'),'obra-teste');
 a.document.querySelector('[data-fm-visao=dicas]').click();await tick();
 assert.match(a.document.getElementById('main').textContent,/Dicas de obra/);
});
test('Fortemais impede troca de área com cálculo ainda não salvo',async()=>{
 const a=app();a.run("filtro.fmVisao='ferramentas';tela()");await tick();
 assert.ok(a.document.querySelector('[data-fm-pagina=ferramentas]'));
 a.run("document.querySelector('[data-fm-pagina=ferramentas]')._fmDirty=true");
 a.document.querySelector('[data-fm-visao=obras]').click();await tick();
 assert.equal(a.run('filtro.fmVisao'),'ferramentas');
});
test('Fortemais restauração valida apoio e preserva dados malformados para correção',()=>{
 const a=app();a.run("E.fortemaisApoio={schema:1,simulacoes:'invalido',favoritos:[],dicas:[],dicasFavoritas:[]}");
 assert.throws(()=>a.run('validarBackup(E)'),/inválid|simula|lista/i);
 assert.equal(a.run('E.fortemaisApoio.simulacoes'),'invalido');
});
test('Fortemais atualização remota preserva texto do cálculo ainda não salvo',async()=>{
 const a=app();a.run("filtro.fmVisao='ferramentas';tela()");await tick();
 const field=a.document.querySelector('[data-fm-pagina=ferramentas] [name=nome]');
 assert.ok(field);field.value='Rascunho de compra fictícia';
 field.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
 a.run('adotaNuvem({dados:structuredClone(SEED),mt:80},false)');await tick();
 assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Rascunho de compra fictícia/);
 assert.equal(a.run('_tabBase'),80);
 assert.ok(a.document.querySelector('[data-abrir-rascunho-sync]'));
});
test('Fortemais saída limpa os recursos do painel após autorizar navegação',async()=>{
 const a=app();a.run("filtro.fmVisao='ferramentas';tela()");await tick();
 a.run("var disposed=0;document.querySelector('[data-fm-pagina=ferramentas]')._fmDispose=()=>disposed++");
 a.document.querySelector('[data-fm-visao=obras]').click();await tick();
 assert.equal(a.run('disposed'),1);assert.equal(a.run('filtro.fmVisao'),'obras');
});
test('Fortemais carregar inicializa somente apoio ausente e preserva apoio inválido',()=>{
 const a=app();
 a.run("var backup=structuredClone(SEED);delete backup.fortemaisApoio;localStorage.getItem=()=>JSON.stringify(backup);E=carregar()");
 assert.equal(a.run('E.fortemaisApoio.schema'),1);assert.equal(a.run('E.fortemaisApoio.simulacoes.length'),0);
 a.run("backup.fortemaisApoio=null;E=carregar()");assert.equal(a.run('E.fortemaisApoio'),null);
 assert.throws(()=>a.run('validarBackup(E)'),/inválid/i);
});
