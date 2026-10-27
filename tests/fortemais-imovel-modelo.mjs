import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({Date});vm.runInContext(readFileSync(new URL('../publico/fortemais-imovel-modelo.js',import.meta.url),'utf8'),ctx);
const M=ctx.FortemaisImovelModelo,simples=x=>JSON.parse(JSON.stringify(x));

test('Imóvel: ausência permanece desconhecida e zero é informação explícita',()=>{
  assert.equal(M.validar(undefined),true);const d=M.cadastro(undefined,{quartos:'',suites:'0',banheiros:'2',responsavel:' Responsável sintético '});
  assert.equal(Object.hasOwn(d,'quartos'),false);assert.equal(d.suites,0);assert.equal(d.banheiros,2);assert.equal(d.responsavel,'Responsável sintético');assert.equal(M.resumo(d).preenchidos,3);
  for(const v of ['-1','1.5','0x10','NaN','Infinity',1000])assert.throws(()=>M.cadastro(d,{vagas:v}),/inteiro|999/);
});
test('Imóvel: características preservam metadados e não duplicam endereço ou áreas',()=>{
  const d={versao:1,fotos:{a:{legenda:'Original'}},capaId:'a'};const foto=JSON.stringify(d),novo=M.cadastro(d,{descricaoComercial:' Casa sintética ',observacoesInternas:' Somente interno '});
  assert.equal(JSON.stringify(d),foto);assert.deepEqual(simples(novo.fotos),d.fotos);assert.equal(novo.capaId,'a');
  for(const k of ['area','areaTerreno','endereco','lote','quadra','inicio','fim'])assert.throws(()=>M.cadastro(d,{[k]:'x'}),/campo/i);
});
test('Imóvel: valida backup estrito, limites, versão, IDs e protótipos',()=>{
  for(const d of [null,[],{}, {versao:2},{versao:1,quartos:'2'},{versao:1,quartos:NaN},{versao:1,responsavel:'x'.repeat(161)},{versao:1,campoNovo:'x'},{versao:1,fotos:[]},{versao:1,fotos:JSON.parse('{"__proto__":{}}')},{versao:1,fotos:{constructor:{}}},{versao:1,fotos:{a:{tipo:'render'}}},{versao:1,fotos:{a:{uso:'publico'}}},{versao:1,fotos:{a:{arquivado:1}}},{versao:1,fotos:{a:{url:'https://example.com'}}}])assert.throws(()=>M.validar(d));
});
test('Imóvel: data de imagem é real e tipo e uso são independentes',()=>{
  assert.throws(()=>M.foto(undefined,'a',{data:'2026-02-30'}),/data/i);
  const d=M.foto(undefined,'a',{data:'2024-02-29',tipo:'projeto',uso:'interno',legenda:' Render sintético '});
  assert.equal(d.fotos.a.tipo,'projeto');assert.equal(d.fotos.a.uso,'interno');assert.equal(d.fotos.a.legenda,'Render sintético');
  assert.deepEqual(simples(M.foto(d,'a',{tipo:'',uso:'',legenda:''}).fotos.a),{data:'2024-02-29'});
});
test('Imóvel: capa arquivada é retirada, original e histórico não são apagados',()=>{
  const original={versao:1,fotos:{a:{legenda:'Original',tipo:'real'}}},capa=M.capa(original,'a'),arq=M.foto(capa,'a',{arquivado:true}),ativo=M.foto(arq,'a',{arquivado:false});
  assert.equal(arq.capaId,undefined);assert.equal(arq.fotos.a.legenda,'Original');assert.equal(ativo.fotos.a.legenda,'Original');assert.equal(capa.capaId,'a');assert.equal(original.capaId,undefined);
  assert.throws(()=>M.capa(arq,'a'),/ativa/i);assert.throws(()=>M.validar({versao:1,capaId:'inexistente'}),/ativa/i);
});
test('Imóvel: galeria só agrega imagem segura no escopo exato da obra, sem duplicar IDs',()=>{
  const a={id:'a',ref:'obra:o',tipo:'image/jpeg',nome:'Original.jpg'},r=M.agrupar([a,{id:'b',ref:'obra:o:demanda:d',tipo:'image/png'},{id:'c',ref:'obra:outra',tipo:'image/png'},{id:'d',ref:'obra:o',tipo:'image/svg+xml'},{id:'e',ref:'obra:o',tipo:'text/html'}],[{...a,blob:'original'},{id:'f',ref:'obra:o',tipo:'image/webp',blob:'pendente'}],'o');
  assert.deepEqual(Array.from(r,a=>a.id),['a','f']);assert.equal(r[0].blob,'original');assert.equal(r[0].nuvem,true);assert.equal(r[1].pendente,true);assert.equal(M.imagemSegura({tipo:'image/svg+xml'}),false);
});
test('Imóvel: resumo conta apenas metadados ativos e não presume o inventário remoto',()=>{
  const r=M.resumo({versao:1,fotos:{a:{},b:{arquivado:true}},responsavel:'Sintético'});assert.equal(r.fotos,1);assert.equal(r.responsavel,'Sintético');assert.equal(r.descricaoComercial,null);assert.equal(r.completo,false);
});
