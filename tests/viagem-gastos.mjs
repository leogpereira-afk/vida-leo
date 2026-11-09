import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const json=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function app(){
  const a=setup(),s=new Map();
  a.ctx.localStorage={getItem:k=>s.get(k)||null,setItem:(k,v)=>s.set(k,v),removeItem:k=>s.delete(k)};
  a.run(`E=carregar();E.gastos=[];E.empresasPJ=[];E._mt=100;E.viagens=[{id:'v',evento:'Viagem de ensaio',aviaoId:'principal',status:'Confirmado',ida:'2026-10-30',custos:[]}];arqIndice=async()=>new Map();`);
  a.estado=()=>json(a.run('E'));return a;
}
const custo=(id='hotel')=>({id,descricao:'Hospedagem de ensaio',categoria:'Hotel',valor:2130,situacao:'Pago',pagoEm:'2026-11-03',pago:'Pix'});
function gravar(a,dados,base=null,op={}){a.ctx.q={dados,base,op};return a.run(`viagemGravarCusto('v',q.dados,q.base,q.op)`);}
const botao=(a,texto,raiz=a.document)=>[...raiz.querySelectorAll('button')].find(b=>b.textContent===texto);
async function aviao(a){await a.run(`aviaoGravarRegistro('despesas',{id:'taxa',natureza:'viagem',viagemId:'v',descricao:'Taxa de ensaio',categoria:'Taxas',minhaCota:104.90,data:'2026-10-30',status:'Pago',pagoEm:'2026-11-01'})`);}

test('Gasto direto gera um único lançamento, preserva campos antigos e compartilha a referência do comprovante',async()=>{
  const a=app(),d=custo();await gravar(a,d);await gravar(a,d);
  let e=a.estado();assert.equal(e.gastos.length,1);const id=e.gastos[0].id;
  assert.equal(id,'gasto:viagem:v:custo:hotel');assert.equal(e.gastos[0].pagoEm,'2026-11-03');assert.equal(e.gastos[0].mes,'2026-11');
  assert.equal(e.viagens[0].custos[0].pago,'Pix');assert.equal(e.viagens[0].custos[0].data,undefined);
  assert.equal(a.run(`holdingAnexosCompartilhados('gasto:'+E.gastos[0].id)`),'viagem:v:custo:hotel');
  assert.equal(a.run(`holdingAnexosCompartilhados(viagemRefCusto('v','hotel'))`),'viagem:v:custo:hotel');
  const base=e.viagens[0].custos[0];await gravar(a,{...base,valor:2200.15,pagoEm:'2026-11-04'},base);
  e=a.estado();assert.equal(e.gastos.length,1);assert.equal(e.gastos[0].id,id);assert.equal(e.gastos[0].valor,2200.15);assert.equal(e.gastos[0].data,'2026-11-04');
  a.run('E=carregar();validarBackup(E)');assert.equal(a.estado().gastos[0].id,id);
});

test('Gasto antigo sem confirmação permanece sem baixa; marcar pago exige data válida',async()=>{
  const a=app(),antigo={id:'hotel',categoria:'Hotel',valor:2130,pago:'Pix'};
  a.ctx.antigo=antigo;a.run('E.viagens[0].custos=[antigo]');const antes=a.estado();
  a.run(`modalGastosViagem(E.viagens[0])`);await tick();
  assert.match(a.document.querySelector('.viagem-gastos-detalhes').textContent,/Não informado/);
  assert.match(a.document.querySelector('.viagem-gastos-detalhes').textContent,/Anexar comprovante/);
  assert.deepEqual(a.estado(),antes);
  await assert.rejects(gravar(a,{...antigo,situacao:'Pago'},antigo),/data do pagamento/);assert.deepEqual(a.estado(),antes);
  await assert.rejects(gravar(a,{...antigo,situacao:'Pago',pagoEm:'2026-02-30'},antigo),/data/);assert.deepEqual(a.estado(),antes);
  await gravar(a,{...antigo,situacao:'Pago',pagoEm:'2026-11-03'},antigo);assert.equal(a.estado().gastos.length,1);
});

test('Detalhamento soma custos diretos e do avião uma vez e clicar no valor não abre a edição da viagem',async()=>{
  const a=app();await gravar(a,custo());await aviao(a);
  a.run(`E.aviao.despesas.push({id:'cancelado',viagemId:'v',descricao:'Cancelado',minhaCota:999,status:'Cancelado'});E.aviao.mensalidades.push({id:'mensal',minhaCota:888,status:'Pago',pagoEm:'2026-11-01'});filtro.aviaoAba='viagens';vAviao(document.getElementById('main'))`);
  const antes=a.estado();a.document.querySelector('.viagem-valor-detalhar').click();
  assert.equal(a.document.querySelectorAll('.viagem-gasto-item').length,2);assert.equal(a.run('custoViagem(E.viagens[0])'),2234.9);
  assert.match(a.document.querySelector('.viagem-gastos-totais').textContent,/2\.234,90/);assert.deepEqual(a.estado(),antes);
  botao(a,'Fechar').click();a.run(`irTela('viagens')`);a.document.querySelector('.viagem-valor-detalhar').click();
  assert.equal(a.document.querySelectorAll('.fundo').length,1);assert.match(a.document.querySelector('.fundo h3').textContent,/Gastos detalhados/);
});

test('Cancelar exclusão preserva tudo; confirmar remove só a despesa selecionada e seu Gasto e conserva histórico',async()=>{
  const a=app();await gravar(a,custo());await aviao(a);a.run(`E.gastos.push({id:'manual',oque:'Outro gasto',valor:50});modalGastosViagem(E.viagens[0])`);
  const antes=a.estado();botao(a,'Apagar despesa').click();await tick();assert.deepEqual(a.estado(),antes);
  a.ctx.confirm=()=>true;botao(a,'Apagar despesa').click();await tick();
  let e=a.estado();assert.equal(e.viagens[0].custos.length,0);assert.equal(e.aviao.despesas.length,1);assert.equal(e.gastos.length,2);
  assert.equal(e.viagens[0].custosExcluidos.length,1);assert.deepEqual(e.viagens[0].custosExcluidos[0].registro,antes.viagens[0].custos[0]);
  assert.equal(e.viagens[0].custosExcluidos[0].gasto.id,antes.gastos[0].id);assert.equal(a.run('custoViagem(E.viagens[0])'),104.90);
  assert.equal(a.document.querySelectorAll('.viagem-gasto-item').length,1);
  assert.match(a.document.querySelector('.viagem-gastos-removidos').textContent,/Despesas removidas \(1\)/);
  assert.equal(a.document.querySelector('.viagem-gastos-removidos input[type=file]').disabled,true);
  botao(a,'Apagar despesa').click();await tick();e=a.estado();
  assert.equal(e.aviao.despesas.length,0);assert.equal(e.aviao.registrosExcluidos[0].registro.id,'taxa');
  assert.deepEqual(e.gastos,[{id:'manual',oque:'Outro gasto',valor:50}]);assert.equal(a.run('custoViagem(E.viagens[0])'),0);
  assert.match(a.document.querySelector('.viagem-gastos-removidos').textContent,/Despesas removidas \(2\)/);
  a.run('E=carregar();validarBackup(E)');assert.equal(a.estado().viagens[0].custosExcluidos.length,1);
});

test('Reabrir pagamento retira apenas o gasto vinculado e pagar novamente reutiliza o id e comprovante',async()=>{
  const a=app();await gravar(a,custo());let e=a.estado();const id=e.gastos[0].id;
  await gravar(a,{...e.viagens[0].custos[0],situacao:'Pendente',pagoEm:''},e.viagens[0].custos[0]);e=a.estado();
  assert.equal(e.gastos.length,0);assert.equal(e.viagens[0].custos[0].historicoGastos[0].gasto.id,id);
  assert.equal(a.run(`holdingAnexosCompartilhados('viagem:v:custo:hotel')`),'viagem:v:custo:hotel');
  await gravar(a,{...e.viagens[0].custos[0],situacao:'Pago',pagoEm:'2026-11-04'},e.viagens[0].custos[0]);
  assert.equal(a.estado().gastos[0].id,id);assert.equal(a.estado().gastos.length,1);
});

test('Formulário desatualizado e falha de armazenamento não apagam fonte, gasto nem histórico parcialmente',async()=>{
  const a=app();await gravar(a,custo());const base=a.estado().viagens[0].custos[0];
  await gravar(a,{...base,valor:2300},base);const antes=a.estado();
  await assert.rejects(gravar(a,base,base,{excluir:true}),/mudou/);assert.deepEqual(a.estado(),antes);
  a.ctx.localStorage.setItem=()=>{throw Error('quota')};
  const atual=antes.viagens[0].custos[0];await assert.rejects(gravar(a,atual,atual,{excluir:true}),/salvar neste dispositivo/);assert.deepEqual(a.estado(),antes);
});

test('Exclusão confirma fonte, Gastos e arquivo histórico juntos no estado remoto',async()=>{
  for(const origem of ['viagem','aviao'])for(const perderHistorico of [false,true]){
    const a=app();if(origem==='viagem')await gravar(a,custo());else await aviao(a);
    a.run(`globalThis.base=structuredClone(${origem==='viagem'?'E.viagens[0].custos[0]':'E.aviao.despesas[0]'});window.__testeSync=true;marcaBase(E._mt,conteudoSync(E))`);
    let remoto,puts=0;
    a.ctx.fetch=async(_,op)=>{if(op.method==='GET')return{ok:true,status:200,json:async()=>({mt:300,dados:remoto})};puts++;remoto=JSON.parse(op.body).dados;
      assert.equal(remoto.gastos.length,0);assert.equal((origem==='viagem'?remoto.viagens[0].custosExcluidos:remoto.aviao.registrosExcluidos).length,1);
      if(perderHistorico){if(origem==='viagem')remoto.viagens[0].custosExcluidos=[];else remoto.aviao.registrosExcluidos=[];}
      remoto._mt=300;return{ok:false,status:409,json:async()=>({})};};
    const p=a.run(origem==='viagem'?`viagemGravarCusto('v',base,base,{excluir:true})`:`aviaoGravarRegistro('despesas',base,base,{excluir:true})`);
    if(perderHistorico)await assert.rejects(p,/mudou/);else assert.match(await p,/sincronizado/);assert.equal(puts,1);
  }
});

test('Gastos protege dados financeiros do custo direto e abre a origem para editar ou apagar',async()=>{
  const a=app();await gravar(a,custo());a.run(`modalLancamentoGasto(E.gastos[0])`);
  for(const nome of ['valor','mes','data','pagoEm','empresaId','situacao'])assert.equal(a.document.querySelector('[name='+nome+']').disabled,true);
  botao(a,'Abrir gasto da viagem').click();assert.match(a.document.querySelector('.fundo h3').textContent,/Gastos detalhados/);assert.ok(botao(a,'Apagar despesa'));
});

test('Centro de custo abre editor único sem deixar formulário antigo da viagem sobreposto',()=>{
  const a=app();a.run(`modalViagem(E.viagens[0])`);botao(a,'Ver gastos e comprovantes').click();
  assert.equal(a.document.querySelectorAll('.fundo').length,1);assert.match(a.document.querySelector('.fundo h3').textContent,/Gastos detalhados/);
});

test('Texto da despesa é escapado e custo sem identificador não cria vínculos inventados',()=>{
  const a=app();a.run(`E.viagens[0].custos=[{descricao:'<img src=x onerror=alert(1)>',valor:10}];modalGastosViagem(E.viagens[0])`);
  assert.equal(a.document.querySelector('.viagem-gastos-detalhes img'),null);assert.equal(botao(a,'Apagar despesa'),undefined);
  assert.equal(a.estado().gastos.length,0);assert.match(a.document.querySelector('.viagem-gasto-item').textContent,/Identificador/);
});
