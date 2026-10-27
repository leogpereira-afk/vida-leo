import test from 'node:test';
import assert from 'node:assert/strict';
import {cenariosA} from './fixtures/fortemais-auditoria-a.mjs';
await import('../publico/fortemais-ferramentas-modelo.js');
await import('../publico/fortemais-apoio-modelo.js');
const E=globalThis.FortemaisFerramentasModelo;
const A=globalThis.FortemaisApoioModelo;
const clone=x=>JSON.parse(JSON.stringify(x));
const perto=(actual,want,label='')=>assert.ok(Math.abs(actual-want)<=1e-9*Math.max(1,Math.abs(want)),`${label}: ${actual} != ${want}`);
const snapshot=(c,inputs,result)=>({nome:`Teste sintético ${c.nome}`,obraId:null,ambiente:'Ambiente fictício',etapa:'Auditoria',elementoId:'Elemento fictício',toolId:c.id,inputs,result,incluirCompra:true});
const seed=id=>clone(cenariosA.find(c=>c.id===id).inputs);

for(const c of cenariosA){
  test(`auditoria A: ${c.nome} — cálculo e compras explícitos`,()=>{
    const r=E.calcular(c.id,clone(c.inputs));
    assert.equal(r.materiais.length,c.materiais.length);
    for(const [i,expected] of c.materiais.entries()){
      const m=r.materiais[i];
      for(const [j,key] of ['liquido','comPerda','embalagens','compra','sobra'].entries()){
        if(expected[j]===null)assert.equal(m[key],null,`${m.nome} ${key}`);
        else perto(m[key],expected[j],`${m.nome} ${key}`);
      }
      assert.ok(m.compra+1e-9>=m.comPerda,'Compra cobre reserva');
    }
    for(const [label,want] of Object.entries(c.metricas))perto(r.metricas.find(m=>m.label===label)?.value,want,label);
  });
  test(`auditoria A: ${c.nome} — salvar, serializar, retomar e preservar histórico`,()=>{
    const firstInputs=clone(c.inputs),r1=E.calcular(c.id,firstInputs);
    let state=A.salvar(undefined,snapshot(c,firstInputs,r1),null,{id:'sintetico',now:'2026-10-27T12:00:00Z'});
    const originalVersion=JSON.stringify(state.simulacoes[0].versoes[0]);
    state=clone(state); // Mesma serialização usada em persistência; sem banco real.
    assert.deepEqual(A.atual(state.simulacoes[0]).inputs,c.inputs);
    const inputs2={...clone(A.atual(state.simulacoes[0]).inputs),...clone(c.alterar)};
    const r2=E.calcular(c.id,inputs2);
    state=A.salvar(state,snapshot(c,inputs2,r2),'sintetico',{expected:1,now:'2026-10-27T12:01:00Z'});
    state=clone(state);
    assert.equal(state.simulacoes.length,1);
    assert.equal(state.simulacoes[0].ativa,2);
    assert.equal(state.simulacoes[0].versoes.length,2);
    assert.equal(JSON.stringify(state.simulacoes[0].versoes[0]),originalVersion);
    assert.deepEqual(A.atual(state.simulacoes[0]).inputs,inputs2);
    const list=A.consolidar(state,undefined,{engineVersion:E.VERSION});
    assert.equal(list.length,c.compraNova.length);
    list.forEach((m,i)=>perto(m.compra,c.compraNova[i],`${c.id} compra atual ${i}`));
    assert.throws(()=>A.salvar(state,snapshot(c,inputs2,r2),'sintetico',{expected:1}),/atualizada/);
    const versions=JSON.stringify(state.simulacoes[0].versoes);
    state=clone(A.arquivar(state,'sintetico'));
    assert.equal(JSON.stringify(state.simulacoes[0].versoes),versions);
    assert.deepEqual(A.consolidar(state),[]);
  });
}

test('auditoria A: cm e mm equivalentes não multiplicam a perda duas vezes',()=>{
 const a=E.calcular('reboco',cenariosA[2].inputs),b=E.calcular('reboco',cenariosA[3].inputs);
 assert.deepEqual(a.materiais,b.materiais);
});
test('auditoria A: identificados agrupam antes de arredondar; referência incerta fica separada',()=>{
 const c=cenariosA.find(c=>c.id==='gesso');
 const inputs={...c.inputs,areas:[{largura:1,altura:1,faces:1}],aberturas:0,espessuraCm:1,consumo:1,unidadeConsumo:'cm',embalagem:15,perdaPct:0};
 for(const product of ['Gesso sintético identificado','']){
  const input={...inputs,produto:product},result=E.calcular('gesso',input);
  let state=A.salvar(undefined,snapshot(c,input,result),null,{id:'a'});
  state=A.salvar(state,{...snapshot(c,input,result),elementoId:'Outro elemento'},null,{id:'b'});
  const list=A.consolidar(state);
  assert.equal(list.length,product?1:2);
  perto(list.reduce((total,m)=>total+m.compra,0),product?15:30);
 }
});
test('auditoria A: aço conserva planos por simulação sem reempacotar comprimentos',()=>{
 const c=cenariosA.find(c=>c.id==='barras'),input={...c.inputs,pecas:[{comprimento:7,quantidade:1,diametro:10,material:'Aço sintético',kgMetro:.6}],perdaPct:0};
 const result=E.calcular('barras',input);let state;
 for(let i=0;i<3;i++)state=A.salvar(state,{...snapshot(c,input,result),elementoId:`Elemento ${i}`},null,{id:`s${i}`});
 const list=A.consolidar(state);assert.equal(list.length,1);assert.equal(list[0].embalagens,3);assert.equal(list[0].compra,36);
});
test('auditoria A: resultado antigo sinaliza recálculo sem apagar versão antiga',()=>{
 const c=cenariosA[0],r=E.calcular(c.id,c.inputs);r.version='motor-antigo-sintetico';
 const state=A.salvar(undefined,snapshot(c,c.inputs,r),null,{id:'antigo'});
 assert.equal(A.pendenciasCompra(state,undefined,E.VERSION).length,1);
 assert.deepEqual(A.consolidar(state,undefined,{engineVersion:E.VERSION}),[]);
 assert.equal(state.simulacoes[0].versoes[0].result.version,'motor-antigo-sintetico');
});

const invalidos=[
 ['alvenaria','vãos maiores que a parede',{aberturas:[{tipo:'porta',largura:5,altura:2,quantidade:1}]}],
 ['alvenaria','quantidade fracionária de vãos',{aberturas:[{tipo:'porta',largura:1,altura:2,quantidade:1.5}]}],
 ['alvenaria','pacote zero',{milheiro:0}],
 ['alvenaria','janela acima do topo',{aberturas:[{tipo:'janela',largura:1,altura:2,peitoril:2,quantidade:1}]}],
 ['reboco','exclusão maior que superfícies',{aberturas:100}],
 ['reboco','faces fracionárias',{areas:[{largura:4,altura:3,faces:1.5}]}],
 ['reboco','consumo zero',{consumo:0}],
 ['reboco','embalagem zero',{embalagem:0}],
 ['reboco','composição sem cimento',{modo:'composicao',cimento:0,areia:1}],
 ['reboco','unidade desconhecida',{unidadeConsumo:'m'}],
 ['gesso','composição incompatível',{modo:'composicao'}],
 ['gesso','espessura zero',{espessuraCm:0}],
 ['concreto','composição vazia',{modo:'composicao'}],
 ['concreto','elementos fracionários',{elementos:[{largura:1,comprimento:1,espessuraCm:10,quantidade:.5}]}],
 ['concreto','cimento com saco zero',{modo:'composicao',cimento:300,embalagemCimentoKg:0}],
 ['malhas','sobreposição consome largura inteira',{sobreposicao:2}],
 ['malhas','camadas fracionárias',{camadas:1.5}],
 ['barras','peça exige emenda',{pecas:[{comprimento:13,quantidade:1,diametro:10}]}],
 ['barras','cortes fracionários',{pecas:[{comprimento:2,quantidade:1.5,diametro:10}]}],
 ['barras','massa negativa',{pecas:[{comprimento:2,quantidade:1,diametro:10,kgMetro:-.5}]}],
 ['terra','reuso excede demanda',{reuso:21}],
 ['terra','reuso excede material cortado',{setores:[{area:100,profundidadeCm:20,corteCm:1}]}],
 ['terra','carga sem densidade',{densidade:undefined}],
 ['terra','fator solto zero',{fatorSolto:0}],
 ['pisos','exclusão excessiva',{vaoArea:21}],
 ['pisos','peça com largura zero',{pecaLargura:0}],
 ['pisos','caixa sem cobertura nem peças',{caixaArea:undefined,pecasCaixa:undefined}],
 ['pisos','peças por caixa fracionárias',{caixaArea:undefined,pecasCaixa:2.5}],
 ['rodape','vãos excedem perímetro',{vaos:19}],
 ['rodape','altura zero',{alturaCm:0}]
];
for(const [id,descricao,changes] of invalidos)test(`auditoria A: ${id} rejeita ${descricao}`,()=>assert.throws(()=>E.calcular(id,{...seed(id),...changes})));
test('auditoria A: retirada total de área produz zero compra sem número inválido',()=>{
 for(const [id,changes] of [['alvenaria',{largura:1,altura:2}],['reboco',{aberturas:30}],['pisos',{vaoArea:20}],['rodape',{vaos:18}]]){
  const r=E.calcular(id,{...seed(id),...changes});
  assert.equal(r.materiais[0].compra,0,id);assert.equal(r.materiais[0].liquido,0,id);
 }
});
