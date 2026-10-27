import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

// Ciclo DOM com os componentes reais e persistência JSON isolada em memória.
// Não acessa rede, banco de produção, navegador ou qualquer dado de cliente.
const files=['fortemais-apoio-modelo.js','fortemais-ferramentas-modelo.js','fortemais-materiais.js','fortemais-ferramentas-conhecimento.js','fortemais-ferramentas.js'];
const source=new Map(files.map(file=>[file,fs.readFileSync(new URL('../publico/'+file,import.meta.url),'utf8')]));
const plain=value=>JSON.parse(JSON.stringify(value));
const seed={obras:[{id:'obra-sintetica',nome:'Obra fictícia da auditoria'},{id:'obra-b',nome:'Outra obra fictícia'}],naoRelacionado:{preservar:['valor sintético',17]}};

function setup(serialized=JSON.stringify(seed)){
 const {document,window}=parseHTML('<html><body></body></html>');
 // linkedom 0.18.12 desmarca outra opção até ao receber selected=false.
 // No DOM nativo, desmarcar uma opção não limpa a seleção de sua irmã.
 // Limita a correção às instâncias deste harness; não altera o código do app.
 const create=document.createElement.bind(document);
 document.createElement=(tag,...args)=>{
  const element=create(tag,...args);
  if(String(tag).toLowerCase()==='option')Object.defineProperty(element,'selected',{
   get(){return this.hasAttribute('selected')},
   set(value){
    if(value){for(const other of this.parentElement?.querySelectorAll('option[selected]')||[])if(other!==this)other.removeAttribute('selected');this.setAttribute('selected','')}
    else this.removeAttribute('selected');
   }
  });
  return element;
 };
 const timers=new Map(),confirmations=[];let timer=0,saves=0,persisted=serialized;
 const c=vm.createContext({document,window,console,structuredClone,URL,Blob,crypto,atob,
  setTimeout(fn){timers.set(++timer,fn);return timer},clearTimeout(id){timers.delete(id)},
  alert(){},confirm(message){confirmations.push(message);return true},
  E:JSON.parse(serialized),filtro:{},salvar(){persisted=JSON.stringify(c.E);saves++}
 });
 for(const file of files)vm.runInContext(source.get(file),c,{filename:file});
 const p=c.fmFerramentasPainel();document.body.append(p);
 return {c,p,document,confirmations,get saves(){return saves},serialize:()=>persisted};
}

const boot=setup();
const catalog=plain(boot.c.FortemaisFerramentasModelo.catalogo);
assert.equal(catalog.length,25,'A auditoria deve percorrer as 25 ferramentas');

function action(app,name){
 const button=app.p.querySelector('[data-action="'+name+'"]');
 assert.ok(button,'Ação disponível: '+name);assert.equal(button.disabled,false,'Ação habilitada: '+name);
 button.click();
}
function named(root,label){
 const button=[...root.querySelectorAll('button')].find(b=>b.textContent===label);
 assert.ok(button,'Botão disponível: '+label);assert.equal(button.disabled,false,label);
 button.click();
}
function number(app,key,value){
 const input=app.p.querySelector('[name="'+key+'"]');assert.ok(input,'Campo disponível: '+key);
 input.value=String(value);input.dispatchEvent(new app.document.defaultView.Event('input',{bubbles:true}));
}
function select(app,key,value){
 const field=app.p.querySelector('[name="'+key+'"]');assert.ok(field,key);
 const option=field.querySelector('option[value="'+value+'"]');assert.ok(option,value);
 option.selected=true;field.dispatchEvent(new app.document.defaultView.Event('change',{bubbles:true}));
}

function choose(app,id){
 const tool=catalog.find(t=>t.id===id),search=app.p.querySelector('[aria-label="Buscar ferramenta"]');
 search.value=tool.titulo;search.dispatchEvent(new app.document.defaultView.Event('input',{bubbles:true}));
 app.p.querySelector('[data-tool="'+id+'"]').click();
}
function saved(app,name){return app.c.E.fortemaisApoio.simulacoes.find(s=>s.versoes.at(-1).nome===name)}
function row(app,name){return [...app.p.querySelectorAll('.fmf-saved')].find(r=>r.querySelector('strong').textContent.startsWith(name+' ·'))}
function create(app,tool,name,fields,work='obra-sintetica'){
 choose(app,tool);action(app,'exemplo');
 for(const [key,value] of Object.entries({...fields,nome:name,ambiente:'Ambiente fictício',etapa:'Teste',elementoId:name}))number(app,key,value);
 select(app,'obraId',work);action(app,'calcular');action(app,'salvar');
 assert.match(app.p.querySelector('.fmf-message').textContent,/Nova versão salva/);
}
function expectPurchase(app,work,liquido,compra){
 select(app,'consolidarObra',work);
 const panel=app.p.querySelector('[name="consolidarObra"]').closest('details');
 const rows=[...panel.querySelectorAll('table tr')].slice(1);assert.equal(rows.length,1);
 const cells=rows[0].querySelectorAll('td');assert.ok(cells[0].textContent.includes('Areia média TESTE'));
 assert.equal(cells[1].textContent,liquido);assert.equal(cells[3].textContent,compra+' m³');
}
const layerFields=(cm)=>({'largura':4,'comprimento':5,'camadas[0].nome':'Areia média TESTE','camadas[0].espessuraCm':cm,'perdaPct':10});
const consumptionFields=(quantity)=>({quantidade:quantity,consumo:.05,produto:'Areia média TESTE',unidade:'m³',embalagem:'',perdaPct:10});

test('UI multiferramentas: salvar três, somar, retomar, recalcular duas vezes, filtrar e preservar histórico',()=>{
 let app=setup();
 create(app,'contrapiso','Contrapiso teste',layerFields(5));
 create(app,'pavimentacao','Pavimentação teste',layerFields(10));
 create(app,'consumo','Consumo teste',consumptionFields(10));
 assert.equal(app.c.E.fortemaisApoio.simulacoes.length,3);expectPurchase(app,'obra-sintetica','3,5','3,85');
 const first=JSON.stringify(saved(app,'Contrapiso teste').versoes[0]);
 const other=JSON.stringify(saved(app,'Pavimentação teste'));
 app=setup(app.serialize());expectPurchase(app,'obra-sintetica','3,5','3,85');
 named(row(app,'Contrapiso teste'),'Retomar');
 number(app,'camadas[0].espessuraCm',10);action(app,'calcular');action(app,'salvar');
 assert.equal(saved(app,'Contrapiso teste').versoes.length,2);expectPurchase(app,'obra-sintetica','4,5','4,95');
 const second=JSON.stringify(saved(app,'Contrapiso teste').versoes[1]);
 // Mesmo cálculo salvo novamente gera versão, mas nunca uma contribuição extra na compra.
 action(app,'calcular');action(app,'salvar');
 assert.equal(app.c.E.fortemaisApoio.simulacoes.length,3);assert.equal(saved(app,'Contrapiso teste').versoes.length,3);
 expectPurchase(app,'obra-sintetica','4,5','4,95');
 assert.equal(JSON.stringify(saved(app,'Contrapiso teste').versoes[0]),first);
 assert.equal(JSON.stringify(saved(app,'Contrapiso teste').versoes[1]),second);
 assert.equal(JSON.stringify(saved(app,'Pavimentação teste')),other);
 create(app,'consumo','Outra obra teste',consumptionFields(20),'obra-b');
 create(app,'consumo','Avulsa teste',consumptionFields(10),'');
 expectPurchase(app,'obra-sintetica','4,5','4,95');expectPurchase(app,'obra-b','1','1,1');
 expectPurchase(app,'__avulsas__','0,5','0,55');expectPurchase(app,'','6','6,6');
 named(row(app,'Contrapiso teste'),'Duplicar');
 assert.equal(saved(app,'Contrapiso teste (cópia)').incluirCompra,false);expectPurchase(app,'obra-sintetica','4,5','4,95');
 const allBefore=JSON.stringify(app.c.E.fortemaisApoio);
 app=setup(app.serialize());assert.equal(JSON.stringify(app.c.E.fortemaisApoio),allBefore);
 expectPurchase(app,'obra-sintetica','4,5','4,95');
 named(row(app,'Pavimentação teste'),'Arquivar');expectPurchase(app,'obra-sintetica','2,5','2,75');
 assert.equal(JSON.stringify(saved(app,'Pavimentação teste').versoes),JSON.stringify(JSON.parse(other).versoes));
 assert.equal(JSON.stringify(saved(app,'Contrapiso teste').versoes[0]),first);
 assert.equal(JSON.stringify(saved(app,'Contrapiso teste').versoes[1]),second);
 assert.deepEqual(plain(app.c.E.obras),seed.obras);assert.deepEqual(plain(app.c.E.naoRelacionado),seed.naoRelacionado);
});
