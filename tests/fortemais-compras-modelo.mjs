import test from 'node:test';
import assert from 'node:assert/strict';
import '../publico/fortemais-compras-modelo.js';
const M=globalThis.FortemaisComprasModelo;
const item=(patch={})=>({id:'i-1',descricao:'Material fictício',especificacao:'Modelo sintético',quantidade:3,unidade:'un',recebido:0,estimado:null,cotado:null,comprado:null,...patch});
const lista=(patch={})=>({id:'l-1',titulo:'Lista fictícia',solicitante:'Pessoa de teste',data:'2026-10-26',prazo:'2026-10-27',prioridade:'normal',obs:'',fornecedor:'',situacao:'solicitado',itens:[item()],ajustes:Object.fromEntries(M.BASES.map(b=>[b,{frete:0,desconto:0}])),...patch});
const dados=l=>({versao:1,listas:l||[lista()]});

test('Compras: início sem preço distingue ausente de zero conhecido',()=>{
  const d=dados();assert.equal(M.validar(undefined),true);assert.equal(M.validar(d),true);
  assert.equal(M.resumo(d,'2026-10-26').estimado.centavos,null);assert.equal(M.resumo(d).estimado.completo,false);
  d.listas[0].itens[0].estimado=0;const r=M.resumo(d);assert.equal(r.estimado.centavos,0);assert.equal(r.estimado.completo,true);assert.equal(r.cotado.centavos,null);
});
test('Compras: totais separam três bases e aplicam frete e desconto somente na base escolhida',()=>{
  const l=lista({itens:[item({estimado:105,cotado:100,comprado:90}),item({id:'i-2',quantidade:1.5,estimado:101,cotado:98,comprado:null})]});l.ajustes.cotado={frete:50,desconto:20};
  assert.equal(M.validar(dados([l])),true);assert.equal(M.totalLista(l,'estimado').centavos,467);assert.equal(M.totalLista(l,'cotado').centavos,477);assert.equal(M.totalLista(l,'comprado').centavos,270);assert.equal(M.totalLista(l,'comprado').completo,false);assert.equal(M.totalLista(l,'comprado').informados,1);
});
test('Compras: arredondamento em centavos ocorre por item e quantidade tem até três casas',()=>{
  assert.equal(M.totalItem(item({quantidade:0.1,estimado:5}),'estimado'),1);assert.equal(M.totalItem(item({quantidade:0.001,estimado:1500}),'estimado'),2);
  assert.throws(()=>M.validar(dados([lista({itens:[item({quantidade:1.0001})]})])),/quantidade/);
});
test('Compras: canceladas ficam fora dos totais, atrasos e pendências',()=>{
  const r=M.resumo(dados([lista({id:'a',prazo:'2026-10-20',itens:[item({estimado:100})]}),lista({id:'b',situacao:'cancelado',prazo:'2026-10-19',itens:[item({estimado:99999})]})]),'2026-10-26');
  assert.equal(r.totalListas,2);assert.equal(r.ativas,1);assert.equal(r.canceladas,1);assert.equal(r.pendentes,1);assert.equal(r.atrasadas,1);assert.equal(r.estimado.centavos,300);assert.equal(r.itensPendentes,1);
});
test('Compras: recebimento parcial e total derivam a situação e preservam preços',()=>{
  const d=dados([lista({situacao:'comprado',itens:[item({comprado:50})]})]),antes=JSON.stringify(d);let n=M.receber(d,'l-1',{'i-1':1});assert.equal(n.listas[0].situacao,'parcial');assert.equal(M.resumo(n).parciais,1);
  n=M.receber(n,'l-1',{'i-1':3});assert.equal(n.listas[0].situacao,'recebido');assert.equal(M.resumo(n).pendentes,0);assert.equal(M.resumo(n).comprado.centavos,150);assert.equal(JSON.stringify(d),antes);
  assert.throws(()=>M.receber(d,'l-1',{'i-1':4}),/superar/);assert.throws(()=>M.receber(d,'l-1',{'de-outra-lista':1}),/Estrutura/);
});
test('Compras: salvamento não altera a entrada e recusa lista de outra obra',()=>{
  const d=dados(),antes=JSON.stringify(d),entrada=lista({titulo:'Lista editada'});delete entrada.id;
  const n=M.salvar(d,entrada,'l-1',()=>{throw Error('ID existente deve permanecer');});assert.equal(n.listas[0].id,'l-1');assert.equal(n.listas[0].titulo,'Lista editada');assert.equal(JSON.stringify(d),antes);assert.equal(entrada.id,undefined);
  assert.throws(()=>M.salvar(d,entrada,'outra',()=>''),/não pertence/);
});
for(const [nome,alterar] of [
  ['data inexistente',l=>l.data='2026-02-30'],['valor negativo',l=>l.itens[0].comprado=-1],['centavos fracionários',l=>l.itens[0].estimado=1.5],['quantidade vazia',l=>l.itens[0].quantidade=0],['recebimento acima do pedido',l=>l.itens[0].recebido=4],['situação recebida sem conferência',l=>l.situacao='recebido'],['itens repetidos',l=>l.itens.push({...l.itens[0]})],['desconto excessivo',l=>{l.itens[0].cotado=100;l.ajustes.cotado.desconto=301;}],['recebimento incompatível com situação',l=>l.itens[0].recebido=1],['campo financeiro desconhecido',l=>l.gasto=100],['ID inseguro',l=>l.id='a:compra:b']
])test('Compras: validação rejeita '+nome,()=>{const l=lista();alterar(l);assert.throws(()=>M.validar(dados([l])));});
test('Compras: versão desconhecida e soma que excede precisão são recusadas',()=>{
  assert.throws(()=>M.validar({versao:2,listas:[]}),/Formato/);const itens=Array.from({length:10},(_,i)=>item({id:'i-'+i,quantidade:1e6,estimado:1e9}));assert.throws(()=>M.validar(dados([lista({itens})])),/limite/);
});
