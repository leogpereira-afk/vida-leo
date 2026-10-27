import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const caminho=new URL('../publico/fortemais-documentos-modelo.js',import.meta.url);
function modelo(){const ctx=vm.createContext({Date});if(existsSync(caminho))vm.runInContext(readFileSync(caminho,'utf8'),ctx);assert.ok(ctx.FortemaisDocumentosModelo,'Modelo de documentos disponível');return ctx.FortemaisDocumentosModelo;}
const simples=x=>JSON.parse(JSON.stringify(x));

test('Documentos: classificação edita só o mapa e preserva os outros arquivos',()=>{
  const M=modelo(),antes={outro:{titulo:'Preservado'}},foto=JSON.stringify(antes);
  const depois=M.salvar(antes,'arquivo-1',{categoria:'  Estrutural  ',titulo:'  Fundação  ',revisao:'R02',dataDocumento:'2026-10-14'});
  assert.deepEqual(simples(depois),{outro:{titulo:'Preservado'},'arquivo-1':{categoria:'Estrutural',titulo:'Fundação',revisao:'R02',dataDocumento:'2026-10-14'}});
  assert.equal(JSON.stringify(antes),foto);assert.equal(M.validar(depois),true);
  assert.throws(()=>M.salvar(depois,'arquivo-1',{ref:'outra',caminho:'outra'}),/campo/i);
});
test('Documentos: mapa recusa poluição de protótipo e estruturas incompatíveis',()=>{
  const M=modelo();assert.equal(M.validar(undefined),true);
  for(const x of [[],null,JSON.parse('{"__proto__":{"titulo":"x"}}'),{constructor:{}},{prototype:{}},{id:{categoria:1}},{id:{arquivado:'sim'}},{id:{campoNovo:'x'}}])assert.throws(()=>M.validar(x),/document|campo|mapa|categoria|arquiv/i);
  assert.throws(()=>M.salvar({},'__proto__',{titulo:'x'}),/identificador/i);
});
test('Documentos: rejeita datas inexistentes e não limita categorias às sugestões',()=>{
  const M=modelo();assert.throws(()=>M.salvar({},'a',{dataDocumento:'2026-02-30'}),/data/i);
  assert.throws(()=>M.salvar({},'a',{dataDocumento:'2026-2-03'}),/data/i);
  const m=M.salvar({},'a',{categoria:'Licença municipal',dataDocumento:'2024-02-29'});
  assert.equal(M.metadados(m,'a').categoria,'Licença municipal');assert.ok(M.categorias(m).includes('Licença municipal'));
});
test('Documentos: agregação inclui filhos da obra e deduplica IDs sem confundir prefixos',()=>{
  const M=modelo(),nuvem=[{id:'a',ref:'obra:o',nome:'Remoto.pdf',tipo:'application/pdf',tam:10},{id:'b',ref:'obra:o:demanda:d',nome:'Filho.pdf'},{id:'fora',ref:'obra:outra:demanda:d'}],local=[{id:'a',ref:'obra:o',nome:'Local.pdf',blob:'bytes'},{id:'c',ref:'obra:o',nome:'Fila.pdf',blob:'pendente'}];
  const rows=M.agrupar(nuvem,local,'o');assert.deepEqual(Array.from(rows,a=>a.id),['a','b','c']);assert.equal(rows[0].nome,'Remoto.pdf');assert.equal(rows[0].blob,'bytes');assert.equal(rows[2].pendente,true);
});
test('Documentos: busca e chips filtram uma coleção sem replicar anexos',()=>{
  const M=modelo(),arqs=[{id:'a',nome:'modelo.dwg',ref:'obra:o'},{id:'b',nome:'Memorial.pdf',ref:'obra:o:demanda:d'},{id:'c',nome:'Antigo.pdf',ref:'obra:o'}],meta={a:{categoria:'Arquitetônico',titulo:'Café principal'},c:{arquivado:true}};
  assert.deepEqual(Array.from(M.filtrar(arqs,meta,{busca:'cafe'}),a=>a.id),['a']);
  assert.deepEqual(Array.from(M.filtrar(arqs,meta,{categoria:'Sem categoria'}),a=>a.id),['b']);
  assert.deepEqual(Array.from(M.filtrar(arqs,meta,{arquivados:true}),a=>a.id),['c']);
  assert.equal(M.filtrar(arqs,meta,{})[0].meta.categoria,'Arquitetônico');
});
test('Documentos: arquivar e desarquivar mantém identidade e conteúdo',()=>{
  const M=modelo(),m={a:{titulo:'Versão anterior',categoria:'Estrutural'}};
  const arquivado=M.salvar(m,'a',{arquivado:true}),ativo=M.salvar(arquivado,'a',{arquivado:false});
  assert.deepEqual(simples(ativo.a),{titulo:'Versão anterior',categoria:'Estrutural',arquivado:false});assert.equal(m.a.arquivado,undefined);
});
test('Documentos: versões vinculam IDs sem substituir conteúdo e rejeitam ciclos',()=>{
  const M=modelo(),m={a:{titulo:'Primeira',revisao:'R01'}};
  const nova=M.salvar(m,'b',{titulo:'Segunda',revisao:'R02',versaoAnteriorId:'a'});
  assert.equal(nova.b.versaoAnteriorId,'a');assert.equal(nova.a.titulo,'Primeira');assert.equal(m.b,undefined);
  assert.throws(()=>M.salvar(nova,'a',{versaoAnteriorId:'b'}),/ciclo/);assert.throws(()=>M.salvar(nova,'b',{versaoAnteriorId:'b'}),/ciclo/);
  assert.equal(M.salvar(nova,'b',{versaoAnteriorId:''}).b.versaoAnteriorId,undefined);
  assert.equal(M.validar({b:{versaoAnteriorId:'anterior-indisponivel'}}),true);
});
