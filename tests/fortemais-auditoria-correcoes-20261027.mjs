import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

function setup(){
  const {document,window}=parseHTML('<html><body></body></html>'),blobs=[];
  const c=vm.createContext({document,window,structuredClone,crypto,console,Blob,atob,
    URL:class extends URL{static createObjectURL(blob){blobs.push(blob);return 'blob:test'}static revokeObjectURL(){}},
    setTimeout(){return 1},clearTimeout(){},confirm:()=>true,alert(){},salvar(){},filtro:{},E:{obras:[]}});
  for(const f of ['fortemais-ferramentas-modelo.js','fortemais-apoio-modelo.js','fortemais-materiais.js','fortemais-ferramentas.js'])
    vm.runInContext(fs.readFileSync(new URL('../publico/'+f,import.meta.url),'utf8'),c);
  return {c,document,window,blobs};
}

test('rodapé: comprimento comercial zero não equivale a comprar por metro',()=>{
  const {c}=setup(),M=c.FortemaisFerramentasModelo,input=M.catalogo.find(t=>t.id==='rodape').exemplo;
  for(const peca of [0,'0','0,0'])assert.throws(()=>M.calcular('rodape',{...input,peca}),/Embalagem|maior que zero/);
  for(const peca of ['',null,undefined])assert.equal(M.calcular('rodape',{...input,peca}).materiais[0].embalagens,null);
});

test('pisos: cobertura explicitamente zero é inválida mesmo havendo peças por caixa',()=>{
  const {c}=setup(),M=c.FortemaisFerramentasModelo,input=M.catalogo.find(t=>t.id==='pisos').exemplo;
  for(const caixaArea of [0,'0','0,0'])assert.throws(()=>M.calcular('pisos',{...input,caixaArea,pecasCaixa:6}),/Embalagem|maior que zero/);
  for(const caixaArea of ['',null,undefined])assert.ok(Math.abs(M.calcular('pisos',{...input,caixaArea,pecasCaixa:6}).materiais[0].embalagem-2.16)<1e-12);
});

test('peças sob medida: quantidade física aparece no resultado, na compra, no PDF e no CSV',async()=>{
  const {c,document,window,blobs}=setup(),p=c.fmFerramentasPainel();document.body.append(p);
  const search=p.querySelector('[aria-label="Buscar ferramenta"]');search.value='Bancadas';search.oninput();
  p.querySelector('[data-tool="pecas"]').click();p.querySelector('[data-action="exemplo"]').click();
  for(const [name,value] of Object.entries({'pecas[0].nome':'Vidro sintético','pecas[0].material':'Teste 8 mm','pecas[0].largura':'1','pecas[0].altura':'1','pecas[0].quantidade':'2',perdaPct:'10'})){
    const field=p.querySelector('[name="'+name+'"]');field.value=value;field.oninput();
  }
  p.querySelector('[data-action="calcular"]').click();
  const summary=p.querySelector('.fmf-purchase-summary').textContent;
  assert.match(summary,/2 peças · 2,2 m² com reserva/);
  assert.match(p.querySelector('.fmf-materials').textContent,/2 peças · 2,2 m² de matéria-prima com reserva/);
  for(const [name,value] of Object.entries({nome:'Teste de peças',ambiente:'Sala fictícia',etapa:'Teste',elementoId:'Vidro'}))p.querySelector('[name="'+name+'"]').value=value;
  p.querySelector('[name="incluirCompra"] option[value="true"]').selected=true;
  p.querySelector('[data-action="salvar"]').click();
  const purchase=p.querySelector('[name="consolidarObra"]').closest('details');
  assert.match(purchase.textContent,/2 peças · 2,2 m² de matéria-prima com reserva/);
  const {document:pdf}=parseHTML('<html><head></head><body></body></html>');let prints=0;
  window.open=()=>({document:pdf,print(){prints++}});
  [...p.querySelectorAll('button')].find(b=>b.textContent==='PDF / imprimir').click();
  assert.equal(prints,1);assert.match(pdf.body.textContent,/2 peças · 2,2 m² de matéria-prima com reserva/);
  assert.match(pdf.body.textContent,/não cria peças extras/);
  [...p.querySelectorAll('button')].find(b=>b.textContent==='CSV').click();
  const csv=await blobs.at(-1).text(),lines=csv.split('\r\n');
  assert.match(lines[0],/Quantidade de peças sob medida/);assert.match(lines[1],/;"2"$/);
});

test('peças: legado sem contagem permanece intacto e não se mistura com versão nova',()=>{
  const {c}=setup(),M=c.FortemaisFerramentasModelo,A=c.FortemaisApoioModelo;
  const inputs={pecas:[{nome:'Vidro teste',material:'8 mm teste',largura:1,altura:1,quantidade:2}],perdaPct:10};
  const result=M.calcular('pecas',inputs),old=structuredClone(result);old.version='1.3.0';delete old.materiais[0].quantidadePecas;
  const data={nome:'Legado sintético',obraId:null,ambiente:'Teste',etapa:'Teste',elementoId:'Teste',toolId:'pecas',inputs,result:old};
  let state=A.salvar(undefined,data,null,{id:'legacy'});const v1=JSON.stringify(state.simulacoes[0].versoes[0]);
  assert.equal(A.pendenciasCompra(state,undefined,M.VERSION).length,1);
  assert.equal(A.consolidar(state,undefined,{engineVersion:M.VERSION}).length,0);
  state=A.salvar(state,{...data,result},'legacy',{expected:1});
  assert.equal(JSON.stringify(state.simulacoes[0].versoes[0]),v1);
  assert.equal(A.consolidar(state,undefined,{engineVersion:M.VERSION})[0].quantidadePecas,2);
  assert.equal(A.pendenciasCompra(state,undefined,M.VERSION).length,0);
  const invalid=structuredClone(state);invalid.simulacoes[0].versoes[1].result.materiais[0].quantidadePecas=2.5;
  assert.throws(()=>A.validar(invalid),/inválidos/);
});
