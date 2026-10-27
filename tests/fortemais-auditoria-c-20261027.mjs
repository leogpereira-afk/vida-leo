import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {scenarios} from './fixtures/fortemais-auditoria-c.mjs';

for(const f of ['fortemais-ferramentas-modelo.js','fortemais-apoio-modelo.js']) vm.runInThisContext(fs.readFileSync(new URL('../publico/'+f,import.meta.url),'utf8'));
const M=globalThis.FortemaisFerramentasModelo,A=globalThis.FortemaisApoioModelo;
const calc=(id,patch={})=>M.calcular(id,{...structuredClone(scenarios.find(s=>s.id===id).inputs),...patch});
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
const doc=(id,inputs,result)=>({nome:'Teste sintético '+id,obraId:'obra-sintetica',ambiente:'Ambiente de teste',etapa:id,elementoId:'elemento-'+id,toolId:id,inputs:structuredClone(inputs),result:structuredClone(result)});
function saved(state,id,inputs,result,options={}) { return A.salvar(state,doc(id,inputs,result),options.update?options.id:null,{id:options.id||id,expected:options.expected,now:'2026-01-01T00:00:00.000Z'}); }

for(const s of scenarios) {
  test(s.id+': cálculo independente de unidades, reserva, pacotes e compra',()=>{
    const inputs=structuredClone(s.inputs),before=JSON.stringify(inputs),result=M.calcular(s.id,inputs);
    assert.equal(JSON.stringify(inputs),before,'motor não pode mutar as medidas');
    assert.equal(result.materiais.length,s.materials.length);
    s.materials.forEach((expected,index)=>Object.entries(expected).forEach(([k,v])=>typeof v==='number'?near(result.materiais[index][k],v,s.id+'.'+index+'.'+k):assert.equal(result.materiais[index][k],v)));
    for(const [label,expected] of Object.entries(s.metrics)) near(result.metricas.find(m=>m.label===label)?.value,expected,label);
    const state=saved(undefined,s.id,inputs,result),beforeState=JSON.stringify(state),consolidated=A.consolidar(state,'obra-sintetica',{engineVersion:M.VERSION});
    assert.equal(consolidated.length,s.materials.length);
    s.materials.forEach((expected,index)=>['liquido','comPerda','compra','sobra'].forEach(k=>near(consolidated[index][k],expected[k],s.id+'.consolidado.'+k)));
    assert.equal(JSON.stringify(state),beforeState,'consolidar não pode alterar histórico');
  });
  test(s.id+': salvar, serializar, retomar e recalcular conserva v1 e compra só v2',()=>{
    const result=M.calcular(s.id,s.inputs);
    let state=saved(undefined,s.id,s.inputs,result);
    const v1=JSON.stringify(state.simulacoes[0].versoes[0]);
    state=JSON.parse(JSON.stringify(state));
    const updated=structuredClone(s.inputs);
    if('largura' in updated) updated.largura*=2;
    else if('area' in updated) updated.area*=2;
    else if('quantidade' in updated) updated.quantidade*=2;
    else updated.pecas[0].quantidade*=2;
    const v2=M.calcular(s.id,updated);
    state=saved(state,s.id,updated,v2,{id:s.id,expected:1,update:true});
    assert.equal(state.simulacoes.length,1);
    assert.equal(state.simulacoes[0].versoes.length,2);
    assert.equal(state.simulacoes[0].ativa,2);
    assert.equal(JSON.stringify(state.simulacoes[0].versoes[0]),v1);
    const consolidated=A.consolidar(state,'obra-sintetica',{engineVersion:M.VERSION});
    assert.equal(consolidated.length,v2.materiais.length);
    v2.materiais.forEach((m,index)=>near(consolidated[index].compra,m.compra,s.id+'.apenas.v2'));
    const historical=JSON.stringify(state.simulacoes[0].versoes);
    state=A.arquivar(state,s.id);
    assert.equal(A.consolidar(state).length,0);
    assert.equal(JSON.stringify(state.simulacoes[0].versoes),historical);
  });
}

for(const id of ['contrapiso','pavimentacao']) {
  test(id+': centímetros decimais e camadas iguais consolidam volume compatível',()=>{
    const input={largura:'2,5',comprimento:'4',perdaPct:'7,5',camadas:[{nome:'Material sintético idêntico',espessuraCm:'2,5'},{nome:'Material sintético idêntico',espessuraCm:'1,5'}]};
    const result=M.calcular(id,input),state=saved(undefined,id,input,result),purchase=A.consolidar(state);
    assert.equal(purchase.length,1);near(purchase[0].liquido,.4,'volume 0,25+0,15');near(purchase[0].compra,.43,'reserva 7,5%');
  });
  test(id+': exige dimensões, camadas e espessura positiva',()=>{
    for(const patch of [{largura:0},{comprimento:-1},{camadas:[]},{camadas:[{nome:'Teste',espessuraCm:0}]},{camadas:[{nome:'Teste',espessuraCm:'abc'}]}]) assert.throws(()=>calc(id,patch));
  });
}

test('formas: estoque suficiente não causa compra negativa e ciclos são inteiros',()=>{
  const material=calc('formas',{estoque:22}).materiais[0];
  assert.equal(material.liquido,0);assert.equal(material.embalagens,0);assert.equal(material.compra,0);
  for(const patch of [{ciclos:0},{ciclos:2.5},{estoque:-1},{painelArea:0}]) assert.throws(()=>calc('formas',patch));
  assert.match(calc('formas').avisos.join(' '),/frentes uniformes.*sequenciais/);
});

test('formas: pacote comercial decimal não arredonda unidade a mais por ruído binário',()=>{
  const result=calc('formas',{area:.3,ciclos:1,estoque:0,painelArea:.1,perdaPct:0});
  assert.equal(result.materiais[0].embalagens,3);
  near(result.materiais[0].compra,.3,'três chapas');
});

test('drywall: ausência de embalagem conserva unidade contínua e embalagens zero são inválidas',()=>{
  const blank=calc('drywall',{consumos:[{nome:'Massa teste',unidade:'kg',consumo:.5,embalagem:''}]}).materiais[0];
  assert.equal(blank.embalagem,null);near(blank.compra,6.75,'compra contínua');
  assert.throws(()=>calc('drywall',{consumos:[{nome:'Placa teste',unidade:'m²',consumo:2,embalagem:0}]}),/Embalagem/);
});

test('peças: quantidades inteiras, dimensões e referência não podem se misturar na compra',()=>{
  for(const patch of [{pecas:[]},{pecas:[{largura:1,altura:1,quantidade:1.5}]},{pecas:[{largura:0,altura:1,quantidade:1}]}]) assert.throws(()=>calc('pecas',patch));
  const input={pecas:[{nome:'Vidro',material:'Sintético 8 mm',largura:2,altura:.5,quantidade:2},{nome:'Vidro',material:'Sintético 8 mm',largura:1,altura:1,quantidade:2},{nome:'Vidro',material:'Sintético 10 mm',largura:1,altura:1,quantidade:2}],perdaPct:0};
  const result=M.calcular('pecas',input),state=saved(undefined,'pecas',input,result);
  assert.equal(A.consolidar(state).length,3,'área igual não significa peça intercambiável');
});

test('paisagismo: malha por células e reserva de mudas sempre produz inteiro',()=>{
  const result=calc('paisagismo',{largura:.5,comprimento:.6,espacamentoX:1,espacamentoY:1,perdaPct:1});
  assert.equal(result.materiais[1].liquido,1);assert.equal(result.materiais[1].compra,2);
  for(const patch of [{espacamentoX:0},{espacamentoX:''},{espacamentoY:undefined}]) assert.throws(()=>calc('paisagismo',patch));
  assert.equal(calc('paisagismo',{espacamentoX:'',espacamentoY:''}).materiais.length,1);
});

test('produtividade: conversão pessoa-hora e nenhuma compra de material inventada',()=>{
  const result=calc('produtividade',{quantidade:'2,5',rup:'1,2',equipe:3,horasDia:4});
  near(result.metricas[0].value,3,'pessoa-horas');near(result.metricas[1].value,.25,'dias de equipe');
  assert.deepEqual(result.materiais,[]);assert.equal(result.scene.noGeometry,true);assert.deepEqual(result.scene.elements,[]);
  for(const patch of [{equipe:1.5},{equipe:0},{rup:0},{horasDia:0}]) assert.throws(()=>calc('produtividade',patch));
});

test('consumo: pacote exato, valor mínimo positivo e reserva aplicada uma única vez',()=>{
  const exact=calc('consumo',{quantidade:2.5,consumo:1.2,embalagem:1,perdaPct:0}).materiais[0];
  assert.equal(exact.embalagens,3);
  assert.equal(calc('consumo',{quantidade:1e-15,consumo:1,embalagem:10,perdaPct:0}).materiais[0].embalagens,1);
  const noPack=calc('consumo',{embalagem:''}).materiais[0];assert.equal(noPack.embalagens,null);near(noPack.compra,16.5,'massa com reserva');
});

test('consolidação: arredonda pacotes após somar apenas produto, unidade e embalagem compatíveis',()=>{
  let state;
  for(const [id,input] of [['a',{quantidade:3,consumo:1,produto:'Massa A',unidade:'kg',embalagem:4,perdaPct:0}],['b',{quantidade:1,consumo:1,produto:'Massa A',unidade:'kg',embalagem:4,perdaPct:0}],['c',{quantidade:1,consumo:1,produto:'Massa A',unidade:'L',embalagem:4,perdaPct:0}],['d',{quantidade:1,consumo:1,produto:'Massa B',unidade:'kg',embalagem:4,perdaPct:0}]]) {
    const result=M.calcular('consumo',input);
    state=A.salvar(state,{...doc('consumo',input,result),nome:id,elementoId:id},null,{id});
  }
  const consolidated=A.consolidar(state);
  assert.equal(consolidated.length,3);
  assert.equal(consolidated[0].embalagens,1,'dois ambientes do mesmo produto somam quatro kg, uma embalagem');
});

for(const id of ['consumo','paisagismo']) test(id+': embalagem explicitamente zero não equivale a campo opcional vazio',()=>{
  assert.throws(()=>calc(id,{embalagem:0}),/Embalagem|embalagem|maior que zero/);
});

test('peças sob medida: compra deve conservar também a contagem física, sem transformar reserva em fração de peça',()=>{
  const input={pecas:[{nome:'Vidro sintético',material:'Vidro sintético 8 mm',largura:1,altura:1,quantidade:2}],perdaPct:10};
  const result=M.calcular('pecas',input),state=saved(undefined,'pecas',input,result),purchase=A.consolidar(state)[0];
  // Além da área de corte com reserva, a compra precisa levar o pedido de duas
  // peças de 1×1 m. A reserva de matéria-prima não cria 0,2 vidro instalado.
  assert.ok(purchase.quantidadePecas===2||purchase.quantidadeFisica===2||purchase.pecas===2||(purchase.unit==='un'&&purchase.liquido===2), 'a linha consolidada perdeu a quantidade física de duas peças');
});

test('peças sob medida: contagens de dois ambientes somam só quando dimensões e material são iguais',()=>{
  let state;
  for(const [id,quantity] of [['vidro-a',2],['vidro-b',3]]) {
    const input={pecas:[{nome:'Vidro sintético',material:'Vidro sintético 8 mm',largura:1,altura:1,quantidade:quantity}],perdaPct:10};
    state=A.salvar(state,{...doc('pecas',input,M.calcular('pecas',input)),nome:id,elementoId:id},null,{id});
  }
  const rows=A.consolidar(state);
  assert.equal(rows.length,1);
  const purchase=rows[0];
  assert.ok(purchase.quantidadePecas===5||purchase.quantidadeFisica===5||purchase.pecas===5||(purchase.unit==='un'&&purchase.liquido===5), 'a linha consolidada precisa conservar cinco peças, não só as duas do primeiro ambiente');
});
