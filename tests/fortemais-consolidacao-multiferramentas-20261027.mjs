// Dados exclusivamente sintéticos; coeficientes de teste não são traços técnicos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['fortemais-ferramentas-modelo.js','fortemais-apoio-modelo.js'])
  vm.runInThisContext(fs.readFileSync(new URL('../publico/'+file,import.meta.url),'utf8'));
const M=globalThis.FortemaisFerramentasModelo,A=globalThis.FortemaisApoioModelo;
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-10,`${message}: ${actual} != ${expected}`);
const consumo=(q=3,patch={})=>({quantidade:q,consumo:1,produto:'Massa sintética A',unidade:'kg',embalagem:4,perdaPct:0,...patch});
const drywall=(q=1,patch={})=>({area:q,perdaPct:0,consumos:[{nome:'Massa sintética A',unidade:'kg',consumo:1,embalagem:4}],...patch});
const concreto=(patch={})=>({modo:'composicao',produto:'Composição sintética CIMENTO-A AREIA-A',elementos:[{largura:1,comprimento:1,espessuraCm:10,quantidade:1}],cimento:250,areia:.5,brita:0,embalagemCimentoKg:50,perdaPct:0,...patch});
const reboco=(patch={})=>({modo:'composicao',produto:'Composição sintética CIMENTO-A AREIA-A',areas:[{largura:1,altura:2.5,faces:1}],aberturas:0,espessuraCm:2,cimento:500,areia:1,cal:0,embalagemCimentoKg:50,perdaPct:0,...patch});
function record(state,id,toolId,inputs,options={}) {
  const sim=options.update?state.simulacoes.find(s=>s.id===id):null;
  return A.salvar(state,{
    nome:'Teste '+id,obraId:options.obraId===undefined?'obra-sintetica-a':options.obraId,
    ambiente:options.ambiente||'Ambiente '+id,etapa:'Teste',elementoId:'Elemento '+id,
    toolId,inputs:structuredClone(inputs),result:options.result===undefined?M.calcular(toolId,inputs):options.result,
    ...(options.incluirCompra===undefined?{}:{incluirCompra:options.incluirCompra})
  },sim?id:null,{id,expected:sim?.ativa,now:'2026-01-01T00:00:00.000Z'});
}
function commonPair() {
  return record(record(undefined,'consumo','consumo',consumo()),'drywall','drywall',drywall());
}

test('concreto e reboco: mesmo cimento e areia identificados consolidam apesar do nome interno da ferramenta',()=>{
  let state=record(undefined,'fundacao','concreto',concreto());
  state=record(state,'parede','reboco',reboco());
  const original=JSON.stringify(state),purchase=A.consolidar(state,'obra-sintetica-a',{engineVersion:M.VERSION});
  // Concreto: 0,1 m³ × 250 kg/m³ = 25 kg; reboco: 0,05 m³ × 500 = 25 kg.
  // Areia: 0,1 × 0,5 + 0,05 × 1 = 0,1 m³. Cimento: (25+25)/50 = 1 saco.
  assert.equal(purchase.length,2,'cimento e areia devem resultar em duas linhas, não quatro');
  const cement=purchase.find(m=>m.unit==='kg'),sand=purchase.find(m=>m.unit==='m³');
  near(cement.liquido,50,'cimento líquido');assert.equal(cement.embalagens,1);near(cement.compra,50,'compra cimento');
  near(sand.compra,.1,'compra areia');assert.equal(JSON.stringify(state),original,'consolidação preserva versões originais');
});

test('concreto e reboco: perdas distintas são ponderadas e arredondadas somente após soma',()=>{
  let state=record(undefined,'fundacao','concreto',concreto({perdaPct:10}));
  state=record(state,'parede','reboco',reboco({perdaPct:20}));
  const cement=A.consolidar(state).filter(m=>m.unit==='kg');
  assert.equal(cement.length,1);near(cement[0].liquido,50,'líquido');near(cement[0].comPerda,57.5,'27,5+30');
  near(cement[0].perdaPct,15,'perda ponderada');assert.equal(cement[0].embalagens,2);near(cement[0].compra,100,'dois sacos');
});

test('consumo e drywall: produto igual na mesma obra compra um pacote depois da soma',()=>{
  const state=commonPair(),purchase=A.consolidar(state,'obra-sintetica-a');
  assert.equal(purchase.length,1);near(purchase[0].liquido,4,'3+1 kg');assert.equal(purchase[0].embalagens,1);near(purchase[0].compra,4,'um pacote4');
  assert.equal(state.simulacoes[0].versoes[0].result.materiais[0].embalagens,1);
  assert.equal(state.simulacoes[1].versoes[0].result.materiais[0].embalagens,1,'histórico individual conserva arredondamento próprio');
});

test('consumo e drywall: v2 e v3 substituem quantidade ativa e nunca somam histórico',()=>{
  let state=commonPair();
  const original=JSON.stringify(state.simulacoes.find(s=>s.id==='consumo').versoes[0]);
  const other=JSON.stringify(state.simulacoes.find(s=>s.id==='drywall'));
  state=record(state,'consumo','consumo',consumo(5),{update:true});
  let purchase=A.consolidar(state);near(purchase[0].liquido,6,'v2 5+1');assert.equal(purchase[0].embalagens,2);
  const second=JSON.stringify(state.simulacoes.find(s=>s.id==='consumo').versoes[1]);
  state=record(state,'consumo','consumo',consumo(7),{update:true});
  purchase=A.consolidar(state);near(purchase[0].liquido,8,'v3 7+1');assert.equal(purchase[0].embalagens,2);
  const s=state.simulacoes.find(s=>s.id==='consumo');assert.equal(s.ativa,3);assert.equal(s.versoes.length,3);
  assert.equal(JSON.stringify(s.versoes[0]),original);assert.equal(JSON.stringify(s.versoes[1]),second);
  assert.equal(JSON.stringify(state.simulacoes.find(s=>s.id==='drywall')),other);
});

test('reload JSON conserva contas, versões e compras da obra sem produzir nova versão',()=>{
  let state=commonPair();state=record(state,'consumo','consumo',consumo(5),{update:true});
  const before=JSON.stringify(state),expected=A.consolidar(state);
  const loaded=JSON.parse(before);A.validar(loaded);
  assert.deepEqual(A.consolidar(loaded),expected);assert.equal(JSON.stringify(loaded),before);
  assert.equal(loaded.simulacoes.find(s=>s.id==='consumo').versoes.length,2);
});

test('embalagens diferentes não se juntam mesmo com produto e unidade iguais',()=>{
  const state=record(record(undefined,'consumo','consumo',consumo(3,{embalagem:4})),'drywall','drywall',drywall(1,{consumos:[{nome:'Massa sintética A',unidade:'kg',consumo:1,embalagem:5}]}));
  const purchase=A.consolidar(state);assert.equal(purchase.length,2);assert.deepEqual(purchase.map(m=>m.compra).sort(),[4,5]);
});

test('unidades diferentes não se juntam e não há conversão por densidade presumida',()=>{
  const state=record(record(undefined,'consumo','consumo',consumo(3)),'drywall','drywall',drywall(1,{consumos:[{nome:'Massa sintética A',unidade:'L',consumo:1,embalagem:4}]}));
  const purchase=A.consolidar(state);assert.equal(purchase.length,2);assert.deepEqual(purchase.map(m=>m.unit).sort(),['L','kg']);
});

test('composições com referências diferentes permanecem separadas entre ferramentas',()=>{
  const state=record(record(undefined,'concreto','concreto',concreto({produto:'Composição sintética A'})),'reboco','reboco',reboco({produto:'Composição sintética B'}));
  const purchase=A.consolidar(state);assert.equal(purchase.length,4);assert.equal(purchase.filter(m=>m.unit==='kg').length,2);
});

test('materiais sem identificação não agrupam por coincidência de nome',()=>{
  const state=record(record(undefined,'consumo','consumo',consumo(3,{produto:''})),'drywall','drywall',drywall(1,{consumos:[{nome:'',unidade:'kg',consumo:1,embalagem:4}]}));
  const purchase=A.consolidar(state);assert.equal(purchase.length,2);assert.ok(purchase.every(m=>m.identidadeCompraPendente));
  assert.notEqual(purchase[0].origemSimulacao,purchase[1].origemSimulacao);
});

test('filtro de obra A, obra B e simulações avulsas não mistura compras',()=>{
  let state=commonPair();
  state=record(state,'outra','consumo',consumo(5),{obraId:'obra-sintetica-b'});
  state=record(state,'avulsa','drywall',drywall(2),{obraId:null});
  near(A.consolidar(state,'obra-sintetica-a')[0].liquido,4,'obra A');
  near(A.consolidar(state,'obra-sintetica-b')[0].liquido,5,'obra B');
  near(A.consolidar(state,null)[0].liquido,2,'avulsas');
  near(A.consolidar(state)[0].liquido,11,'todas sem filtro');
  assert.equal(A.consolidar(state,'inexistente').length,0);
});

test('duplicar gera alternativa fora da compra e mantém snapshot independente',()=>{
  const state=commonPair(),before=JSON.stringify(state),purchase=A.consolidar(state);
  const duplicated=A.duplicar(state,'consumo',{id:'alternativa',now:'2026-01-02T00:00:00.000Z'});
  assert.equal(duplicated.simulacoes.length,3);assert.equal(duplicated.simulacoes.find(s=>s.id==='alternativa').incluirCompra,false);
  assert.deepEqual(A.consolidar(duplicated),purchase);assert.equal(JSON.stringify(state),before);
  const input=consumo(100);
  const edited=record(duplicated,'alternativa','consumo',input,{update:true,incluirCompra:false});
  assert.deepEqual(A.consolidar(edited),purchase);assert.equal(edited.simulacoes.find(s=>s.id==='alternativa').versoes.length,2);
});

test('arquivamento remove só contribuição atual, mantém demais ferramentas e todas versões',()=>{
  let state=commonPair();state=record(state,'consumo','consumo',consumo(5),{update:true});
  const original=JSON.stringify(state),versions=JSON.stringify(state.simulacoes.find(s=>s.id==='consumo').versoes);
  const archived=A.arquivar(state,'consumo');
  assert.equal(JSON.stringify(state),original);assert.equal(JSON.stringify(archived.simulacoes.find(s=>s.id==='consumo').versoes),versions);
  const purchase=A.consolidar(archived);assert.equal(purchase.length,1);near(purchase[0].liquido,1,'somente drywall');assert.equal(purchase[0].embalagens,1);
  assert.equal(A.consolidar(A.arquivar(archived,'drywall')).length,0);
});

test('motor anterior fica pendente separado até recálculo e sua versão original nunca muda',()=>{
  const input=consumo(3),old=M.calcular('consumo',input);old.version='motor-antigo-sintetico';
  let state=record(undefined,'antiga','consumo',input,{result:old});state=record(state,'atual','drywall',drywall());
  const previous=JSON.stringify(state.simulacoes.find(s=>s.id==='antiga').versoes[0]);
  const purchase=A.consolidar(state,'obra-sintetica-a',{engineVersion:M.VERSION});near(purchase[0].liquido,1,'somente atual');
  assert.equal(A.pendenciasCompra(state,'obra-sintetica-a',M.VERSION).length,1);
  state=record(state,'antiga','consumo',input,{update:true});
  assert.equal(JSON.stringify(state.simulacoes.find(s=>s.id==='antiga').versoes[0]),previous);
  assert.equal(A.pendenciasCompra(state,'obra-sintetica-a',M.VERSION).length,0);near(A.consolidar(state,undefined,{engineVersion:M.VERSION})[0].liquido,4,'ambas atuais');
});

test('hidráulica e esgoto: planos de corte compatíveis somam barras conservadoramente',()=>{
  const input={trechos:[{comprimento:4,quantidade:2,diametro:25,material:'Material sintético A',sistema:'Sistema sintético A'}],conexoes:[],barra:6,perdaPct:0};
  const state=record(record(undefined,'hidraulica','hidraulica',input),'esgoto','esgoto',input),purchase=A.consolidar(state);
  // Quatro peças de quatro metros não cabem em três barras de seis metros.
  assert.equal(purchase.length,1);assert.equal(purchase[0].purchasePolicy,'cut-plan');
  near(purchase[0].liquido,16,'comprimento líquido');assert.equal(purchase[0].embalagens,4);near(purchase[0].compra,24,'quatro barras');
  assert.match(purchase[0].consolidationNote,/sem reaproveitamento/);
});

test('hidráulica e esgoto: sistema diferente impede mistura de barras e conexões',()=>{
  const base={trechos:[{comprimento:4,quantidade:2,diametro:25,material:'Material sintético A',sistema:'fria'}],conexoes:[],barra:6,perdaPct:0};
  const second={...structuredClone(base),trechos:[{...base.trechos[0],sistema:'esgoto'}]};
  const state=record(record(undefined,'hidraulica','hidraulica',base),'esgoto','esgoto',second),purchase=A.consolidar(state);
  assert.equal(purchase.length,2);assert.ok(purchase.every(m=>m.embalagens===2));
});

test('planos de corte: recálculo substitui plano anterior sem somar barras históricas',()=>{
  const input={trechos:[{comprimento:4,quantidade:2,diametro:25,material:'Material sintético A',sistema:'Sistema sintético A'}],conexoes:[],barra:6,perdaPct:0};
  let state=record(record(undefined,'hidraulica','hidraulica',input),'esgoto','esgoto',input);
  const previous=JSON.stringify(state.simulacoes[0].versoes[0]);
  const changed={...input,trechos:[{...input.trechos[0],quantidade:1}]};state=record(state,'hidraulica','hidraulica',changed,{update:true});
  const purchase=A.consolidar(state);assert.equal(purchase[0].embalagens,3);near(purchase[0].compra,18,'plano novo1 mais plano2');
  assert.equal(JSON.stringify(state.simulacoes[0].versoes[0]),previous);
});

test('compra contínua e pacote comercial não se convertem silenciosamente entre ferramentas',()=>{
  const state=record(record(undefined,'consumo','consumo',consumo(3,{embalagem:''})),'drywall','drywall',drywall());
  const purchase=A.consolidar(state);assert.equal(purchase.length,2);
  near(purchase.find(m=>m.embalagem===null).compra,3,'massa a granel');near(purchase.find(m=>m.embalagem===4).compra,4,'pacote comercial');
});

test('contrapiso, pavimentação e consumo: material contínuo idêntico ignora apenas rótulo de pacote inexistente',()=>{
  const layer=(cm)=>({largura:5,comprimento:4,camadas:[{nome:'Areia média TESTE',espessuraCm:cm}],perdaPct:10});
  let state=record(undefined,'contrapiso','contrapiso',layer(5));
  state=record(state,'pavimentacao','pavimentacao',layer(10));
  state=record(state,'consumo','consumo',consumo(.5,{produto:'Areia média TESTE',unidade:'m³',embalagem:'',perdaPct:10}));
  const before=JSON.stringify(state),purchase=A.consolidar(state);
  assert.equal(purchase.length,1,'20×0,05 + 20×0,1 + 0,5 são o mesmo material contínuo');
  near(purchase[0].liquido,3.5,'volume líquido');near(purchase[0].compra,3.85,'volume com10%');
  assert.equal(purchase[0].embalagem,null);assert.equal(purchase[0].embalagens,null);
  assert.equal(JSON.stringify(state),before,'rótulo canônico não altera resultados e entradas do histórico');
});

test('canonicalização de nomes internos não renomeia texto livre de produto informado em consumo',()=>{
  const nome='cimento da composição informada';
  const state=record(undefined,'livre','consumo',consumo(3,{produto:nome}));
  assert.equal(A.consolidar(state)[0].nome,nome);
});

test('material legado sem unidade não dispara alias nem altera o histórico',()=>{
  const result={version:M.VERSION,materiais:[{nome:'Material legado',liquido:1,comPerda:1,embalagem:null}]};
  const state=record(undefined,'legado-unidade','consumo',consumo(),{result}),before=JSON.stringify(state);
  A.validar(state);
  const purchase=A.consolidar(state);
  assert.equal(purchase.length,1);assert.equal(purchase[0].nome,'Material legado');
  assert.equal(purchase[0].unit,undefined);assert.equal(purchase[0].compra,1);
  assert.equal(JSON.stringify(state),before);
});
