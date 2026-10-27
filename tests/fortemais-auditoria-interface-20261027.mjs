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
const seed={obras:[{id:'obra-sintetica',nome:'Obra fictícia da auditoria'}],naoRelacionado:{preservar:['valor sintético',17]}};

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
function record(app){return app.c.E.fortemaisApoio.simulacoes[0]}
function savedRow(app){const rows=app.p.querySelectorAll('.fmf-saved');assert.equal(rows.length,1);return rows[0]}
const fmt=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3});

function verifyPurchase(app,result){
 const panel=app.p.querySelector('[name="consolidarObra"]').closest('details');
 const materialList=plain(app.c.FortemaisApoioModelo.consolidar(app.c.E.fortemaisApoio,undefined,{engineVersion:app.c.FortemaisFerramentasModelo.VERSION}));
 assert.equal(materialList.length,result.materiais.length,'Nenhum item de v1 pode permanecer na lista atual: '+JSON.stringify({included:record(app).incluirCompra,archived:record(app).arquivada,resultVersion:result.version,engine:app.c.FortemaisFerramentasModelo.VERSION,includeField:app.p.querySelector('[name="incluirCompra"]').value}));
 const rows=[...panel.querySelectorAll('table tr')].slice(1);
 assert.equal(rows.length,result.materiais.length,'Lista apresentada contém os itens atuais');
 result.materiais.forEach((expected,index)=>{
  const actual=materialList[index],cells=rows[index].querySelectorAll('td');
  for(const field of ['nome','spec','unit','liquido','comPerda','embalagens','compra','quantidadePecas'])assert.equal(actual[field],expected[field],`Somente v2: ${field}`);
  assert.ok(cells[0].textContent.includes(expected.nome));
  assert.equal(cells[1].textContent,fmt(expected.liquido));
  const purchase=cells[3].textContent;
  if(expected.quantidadePecas!=null){assert.ok(purchase.startsWith(fmt(expected.quantidadePecas)+' peças · '),purchase);assert.ok(purchase.includes(fmt(expected.compra)+' '+expected.unit+' de matéria-prima com reserva'),purchase)}
  else if(expected.embalagem===1&&expected.unit==='un')assert.equal(purchase,fmt(expected.compra)+' unidades');
  else if(expected.embalagem&&expected.embalagens!=null){
   assert.ok(purchase.startsWith(fmt(expected.embalagens)+' '+expected.unidadeEmbalagem+' · '),purchase);
   assert.ok(purchase.includes(fmt(expected.compra)+' '+expected.unit+' ('),purchase);
  }else assert.equal(purchase,fmt(expected.compra)+' '+expected.unit);
 });
 if(!rows.length)assert.match(panel.textContent,/Nenhum material para comprar neste recorte/);
}

for(const tool of catalog)test('interface completa: '+tool.id+' — salvar, recarregar, retomar, recalcular e arquivar',()=>{
 let app=setup();
 const search=app.p.querySelector('[aria-label="Buscar ferramenta"]');search.value=tool.titulo;search.dispatchEvent(new app.document.defaultView.Event('input',{bubbles:true}));
 const toolButton=app.p.querySelector('[data-tool="'+tool.id+'"]');assert.ok(toolButton);toolButton.click();
 assert.equal(app.p.querySelector('h3').textContent,tool.titulo);
 action(app,'exemplo');
 assert.match(app.p.querySelector('.fmf-message').textContent,/Exemplo fictício calculado/);
 for(const [key,value] of Object.entries({nome:'TESTE SINTÉTICO '+tool.id,ambiente:'Ambiente de teste',etapa:tool.categoria,elementoId:'ELEMENTO-'+tool.id})){
  const input=app.p.querySelector('[name="'+key+'"]');input.value=value;input.dispatchEvent(new app.document.defaultView.Event('input',{bubbles:true}));
 }
 select(app,'obraId','obra-sintetica');
 action(app,'salvar');
 assert.equal(app.saves,1);assert.match(app.p.querySelector('.fmf-message').textContent,/Nova versão salva/);
 assert.equal(record(app).versoes.length,1);assert.equal(record(app).ativa,1);
 const oldId=record(app).id,firstVersion=JSON.stringify(record(app).versoes[0]);
 const firstInputs=plain(record(app).versoes[0].inputs),firstResult=plain(record(app).versoes[0].result);
 assert.equal(firstInputs._exemplo,true);assert.equal(record(app).versoes[0].obraId,'obra-sintetica');
 verifyPurchase(app,firstResult);

 // Recria DOM, VM e estado a partir dos bytes salvos: não reutiliza o painel anterior.
 app=setup(app.serialize());
 named(savedRow(app),'Retomar');
 assert.match(app.p.querySelector('.fmf-message').textContent,/Versão 1 retomada/);
 assert.equal(app.p.querySelector('h3').textContent,tool.titulo);
 assert.equal(app.p.querySelector('[name="nome"]').value,'TESTE SINTÉTICO '+tool.id);
 assert.equal(app.p.querySelector('[name="obraId"]').value,'obra-sintetica');
 assert.deepEqual(plain(record(app).versoes[0].inputs),firstInputs);
 assert.equal(JSON.stringify(record(app).versoes[0]),firstVersion);
 verifyPurchase(app,firstResult);

 const change=tool.id==='terra'?['setores[0].profundidadeCm',40]:tool.id==='produtividade'?['quantidade',200]:tool.id==='residuos'?['volume',20]:tool.id==='barras'?['barra',6]:['perdaPct',50];
 const field=app.p.querySelector('[name="'+change[0]+'"]');assert.ok(field,'Entrada editável para recálculo');
 assert.notEqual(field.value,String(change[1]));
 number(app,...change);
 assert.equal(app.p.querySelector('[data-action="salvar"]').disabled,true,'Medida alterada bloqueia resultado anterior');
 action(app,'calcular');
 assert.match(app.p.querySelector('.fmf-message').textContent,/Estimativa calculada/);
 action(app,'salvar');
 assert.equal(app.saves,1);assert.equal(record(app).id,oldId);
 assert.equal(record(app).versoes.length,2);assert.equal(record(app).ativa,2);
 assert.equal(JSON.stringify(record(app).versoes[0]),firstVersion);
 const secondVersion=plain(record(app).versoes[1]);
 assert.notDeepEqual(secondVersion.inputs,firstInputs);
 assert.notDeepEqual({m:secondVersion.result.materiais,q:secondVersion.result.metricas},{m:firstResult.materiais,q:firstResult.metricas});
 verifyPurchase(app,secondVersion.result);
 assert.match(savedRow(app).textContent,/Histórico \(2\)/);

 app=setup(app.serialize());
 named(savedRow(app),'Retomar');
 assert.match(app.p.querySelector('.fmf-message').textContent,/Versão 2 retomada/);
 assert.equal(app.p.querySelector('[name="'+change[0]+'"]')?.value,String(change[1]));
 assert.deepEqual(plain(record(app).versoes[1]),secondVersion);
 assert.equal(JSON.stringify(record(app).versoes[0]),firstVersion);
 verifyPurchase(app,secondVersion.result);
 const beforeArchive=JSON.stringify(record(app).versoes);
 named(savedRow(app),'Arquivar');
 assert.equal(app.confirmations.at(-1),'Arquivar mantendo todo o histórico?');
 assert.equal(app.saves,1);assert.equal(record(app).arquivada,true);
 assert.equal(JSON.stringify(record(app).versoes),beforeArchive);
 assert.equal(app.p.querySelectorAll('.fmf-saved').length,0);
 assert.match(app.p.querySelector('[name="consolidarObra"]').closest('details').textContent,/Nenhum material para comprar neste recorte/);

 app=setup(app.serialize());
 select(app,'simulacoesSituacao','arquivadas');
 assert.match(savedRow(app).textContent,/Arquivada · fora da compra/);
 assert.match(savedRow(app).textContent,/Histórico \(2\)/);
 assert.equal(JSON.stringify(record(app).versoes),beforeArchive);
 assert.equal(record(app).id,oldId);assert.equal(record(app).ativa,2);
 assert.deepEqual(plain(app.c.E.obras),seed.obras);
 assert.deepEqual(plain(app.c.E.naoRelacionado),seed.naoRelacionado);
 verifyPurchase(app,{materiais:[]});
});
