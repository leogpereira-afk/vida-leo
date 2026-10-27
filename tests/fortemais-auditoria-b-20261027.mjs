import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {auditCasesB, cable, tube} from './fixtures/fortemais-auditoria-b.mjs';

for (const file of ['fortemais-ferramentas-modelo.js','fortemais-apoio-modelo.js']) vm.runInThisContext(fs.readFileSync(new URL('../publico/'+file,import.meta.url),'utf8'));
const M=globalThis.FortemaisFerramentasModelo, A=globalThis.FortemaisApoioModelo;
const near=(actual,expected,label='')=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-10,`${label}: ${actual} ≠ ${expected}`);
const save=(state,fixture,id=fixture.id,result=M.calcular(fixture.tool,fixture.inputs))=>A.salvar(state,{nome:'Teste '+id,obraId:'obra-sintetica-b',ambiente:'Ambiente fictício',etapa:fixture.tool,elementoId:id,toolId:fixture.tool,inputs:fixture.inputs,result},null,{id,now:'2000-01-01T00:00:00.000Z'});
const checkMaterials=(actual,expected)=>{
  assert.equal(actual.length,expected.length);
  expected.forEach(([liquido,comPerda,compra,embalagens],i)=>{
    const m=actual[i];near(m.liquido,liquido,'líquido '+i);near(m.comPerda,comPerda,'reserva '+i);near(m.compra,compra,'compra '+i);assert.equal(m.embalagens,embalagens);near(m.sobra,compra-comPerda,'sobra '+i);
  });
};

for(const fixture of auditCasesB){
  test('auditoria B: '+fixture.id+' — cálculo, compra, histórico e arquivo',()=>{
    const original=structuredClone(fixture.inputs), result=M.calcular(fixture.tool,fixture.inputs);
    assert.deepEqual(fixture.inputs,original,'calcular não altera entrada');
    checkMaterials(result.materiais,fixture.materials);
    for(const [label,expected] of Object.entries(fixture.metrics||{})) near(result.metricas.find(m=>m.label===label)?.value,expected,label);
    let state=save(undefined,fixture), historical=structuredClone(state.simulacoes[0].versoes[0]);
    checkMaterials(A.consolidar(state,'obra-sintetica-b',{engineVersion:M.VERSION}),fixture.materials);
    state=A.salvar(state,{...historical,inputs:structuredClone(original),result:M.calcular(fixture.tool,original)},fixture.id,{expected:1,now:'2000-01-02T00:00:00.000Z'});
    assert.equal(state.simulacoes.length,1);assert.equal(state.simulacoes[0].ativa,2);assert.equal(state.simulacoes[0].versoes.length,2);assert.deepEqual(state.simulacoes[0].versoes[0],historical);
    checkMaterials(A.consolidar(state),fixture.materials); // Não conta v1 + v2.
    const versions=structuredClone(state.simulacoes[0].versoes);state=A.arquivar(state,fixture.id);
    assert.deepEqual(state.simulacoes[0].versoes,versions);assert.deepEqual(A.consolidar(state),[]);
  });
}

test('auditoria B: consolidação reutiliza embalagem de tinta mas não mistura referências',()=>{
  const base={id:'a',tool:'pintura',inputs:{produto:'Tinta fictícia A',area:50,rendimento:10,demao:1,modo:'demao',embalagem:18,perdaPct:0}};
  let state=save(undefined,base);state=save(state,{...base,id:'b'});
  checkMaterials(A.consolidar(state),[[10,10,18,1]]);
  state=save(state,{...base,id:'c',inputs:{...base.inputs,produto:'Tinta fictícia B'}});
  checkMaterials(A.consolidar(state),[[10,10,18,1],[5,5,18,1]]);
});

test('auditoria B: hidráulica conserva planos de corte entre simulações',()=>{
  const base={id:'corte-a',tool:'hidraulica',inputs:{trechos:[tube(4,1)],barra:6,perdaPct:0}};
  const state=save(save(undefined,base),{...base,id:'corte-b'});
  checkMaterials(A.consolidar(state),[[8,8,12,2]]);
  assert.match(A.consolidar(state)[0].consolidationNote,/sem reaproveitamento/);
});

test('auditoria B: cabos identificados compartilham rolo entre simulações, seções diferentes ficam separadas',()=>{
  const base={id:'cabo-a',tool:'eletrica',inputs:{produto:'Eletroduto fictício',trechos:[cable('A',20)],embalagem:100,perdaPct:0}};
  let state=save(save(undefined,base),{...base,id:'cabo-b'});
  checkMaterials(A.consolidar(state),[[40,40,40,null],[40,40,100,1]]);
  state=save(state,{...base,id:'cabo-c',inputs:{...base.inputs,trechos:[cable('A',20,{secao:4})]}});
  checkMaterials(A.consolidar(state),[[60,60,60,null],[40,40,100,1],[20,20,100,1]]);
});

test('auditoria B: mantas de formatos diferentes não são o mesmo produto de compra',()=>{
  const base={id:'manta-a',tool:'impermeabilizacao',inputs:{produto:'Manta fictícia',area:10,perimetro:0,altura:0,aberturas:0,modo:'rolo',roloLargura:1,roloComprimento:10,sobreposicao:0,perdaPct:0}};
  const state=save(save(undefined,base),{...base,id:'manta-b',inputs:{...base.inputs,roloLargura:2,roloComprimento:5}});
  checkMaterials(A.consolidar(state),[[10,10,10,1],[10,10,10,1]]);
});

test('auditoria B: material sem especificação preserva a origem e não une compras',()=>{
  const base={id:'sem-a',tool:'dados',inputs:{trechos:[cable('A',10,{papel:''})],embalagem:100,perdaPct:0}};
  const state=save(save(undefined,base),{...base,id:'sem-b'}), materials=A.consolidar(state);
  checkMaterials(materials,[[10,10,100,1],[10,10,100,1]]);
  assert.ok(materials.every(m=>m.identidadeCompraPendente&&m.origemSimulacao));
});

const invalidCases=[
 ['eletrica','trajeto sem ID',{trechos:[cable('',5)]}],
 ['eletrica','trajeto repetido de tamanho divergente',{trechos:[cable('A',5),cable('A',6)]}],
 ['eletrica','tipo de cabo ausente',{trechos:[cable('A',5,{modo:''})]}],
 ['eletrica','condutores fracionados',{trechos:[cable('A',5,{condutores:1.5})]}],
 ['eletrica','seção negativa',{trechos:[cable('A',5,{secao:-2.5})]}],
 ['dados','folga negativa',{trechos:[cable('A',5,{extra:-1})]}],
 ['dados','trajeto vazio',{trechos:[]}],
 ['hidraulica','peça maior que barra',{trechos:[tube(7,1)],barra:6}],
 ['hidraulica','quantidade fracionária',{trechos:[tube(2,1.5)],barra:6}],
 ['esgoto','diâmetro zero',{trechos:[tube(2,1,{diametro:0})],barra:6}],
 ['esgoto','limite de cortes',{trechos:[tube(2,5001)],barra:6}],
 ['cobertura','cobertura útil zero',{largura:3,comprimento:4,inclinacao:0,cobertura:0}],
 ['cobertura','inclinação negativa',{largura:3,comprimento:4,inclinacao:-2,cobertura:2}],
 ['impermeabilizacao','exclusão maior',{area:10,perimetro:0,altura:0,aberturas:11,modo:'total',consumo:3,embalagem:20}],
 ['impermeabilizacao','sobreposição inválida',{area:10,perimetro:0,altura:0,aberturas:0,modo:'rolo',roloLargura:1,roloComprimento:10,sobreposicao:1}],
 ['impermeabilizacao','demãos fracionadas',{area:10,perimetro:0,altura:0,aberturas:0,modo:'liquido',consumo:1,demao:1.5,embalagem:20}],
 ['pintura','rendimento zero',{area:10,rendimento:0,demao:2,modo:'demao',embalagem:18}],
 ['pintura','demãos fracionadas',{area:10,rendimento:10,demao:1.5,modo:'demao',embalagem:18}],
 ['pintura','modo inválido',{area:10,rendimento:10,demao:1,modo:'inesperado',embalagem:18}],
 ['residuos','carga sem densidade',{volume:10,caminhao:5,carga:6}],
 ['residuos','caçamba zero',{volume:10,caminhao:0}],
 ['residuos','volume infinito',{volume:Infinity,caminhao:5}]
];
for(const [id,description,inputs] of invalidCases)test('auditoria B: rejeita '+id+' / '+description,()=>assert.throws(()=>M.calcular(id,inputs)));

for(const tool of ['eletrica','dados']){
  test('auditoria B: '+tool+' rejeita embalagem zero explícita',()=>{
    for(const embalagem of [0,'0','0,0']) assert.throws(()=>M.calcular(tool,{produto:'Eletroduto fictício',trechos:[cable('A',10)],embalagem,perdaPct:10}),/Embalagem|embalagem/);
  });
  test('auditoria B: '+tool+' permite embalagem ausente e mantém compra contínua',()=>{
    for(const embalagem of ['',null,undefined]){
      const result=M.calcular(tool,{produto:'Eletroduto fictício',trechos:[cable('A',10)],embalagem,perdaPct:10});
      const material=result.materiais.find(m=>m.nome==='Cabo');
      assert.equal(material.embalagem,null);assert.equal(material.embalagens,null);
      near(material.liquido,10);near(material.comPerda,11);near(material.compra,11);
    }
  });
}

test('auditoria B: alterar entrada cria nova versão e compra somente quantidade nova',()=>{
  const first={id:'recálculo-pintura',tool:'pintura',inputs:{produto:'Tinta fictícia',area:50,rendimento:10,demao:2,modo:'demao',embalagem:18,perdaPct:10}};
  let state=save(undefined,first), old=structuredClone(state.simulacoes[0].versoes[0]);
  const inputs={...first.inputs,area:100};
  state=A.salvar(state,{...old,inputs,result:M.calcular('pintura',inputs)},first.id,{expected:1});
  assert.deepEqual(state.simulacoes[0].versoes[0],old);
  checkMaterials(A.consolidar(state),[[20,22,36,2]]);
  assert.throws(()=>A.salvar(state,{...old,inputs,result:M.calcular('pintura',inputs)},first.id,{expected:1}),/atualizada/);
});
