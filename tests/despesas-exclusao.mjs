import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const json=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(r=>setImmediate(r));
const button=(root,n)=>[...root.querySelectorAll('button')].find(b=>b.textContent===n);
function app(){
  const a=setup(),s=new Map();a.ctx.localStorage={getItem:k=>s.get(k)||null,setItem:(k,v)=>s.set(k,v),removeItem:k=>s.delete(k)};
  a.run(`E=carregar();E.gastos=[];E.empresasPJ=[];E._mt=100;E.holdingImoveis=[{id:'i',nome:'Sala de ensaio',totalCentavos:100000,pagamentos:[{id:'aquisicao',descricao:'Aquisição',data:'2026-11-01',valorCentavos:100000}],despesas:[]}];arqIndice=async()=>new Map();`);
  a.estado=()=>json(a.run('E'));return a;
}
async function despesa(a,paga=true){
  await a.run(`holdingGravarDespesa('i',{id:'condominio',tipo:'condominio',descricao:'Condomínio de ensaio',valorCentavos:12523,vencimento:'2026-11-01'},null,E.holdingImoveis[0])`);
  if(paga)await a.run(`holdingPagarDespesa('i','condominio',E.holdingImoveis[0].despesas[0],E.holdingImoveis[0])`);
  a.run('globalThis.baseDespesa=structuredClone(E.holdingImoveis[0].despesas[0]);globalThis.baseImovel=structuredClone(E.holdingImoveis[0])');
}
const excluir=a=>a.run(`holdingExcluirDespesa('i','condominio',baseDespesa,baseImovel)`);
function abrirImovel(a){a.run(`irTela('universo-imoveis')`);button(a.document,'Despesas').click();}

test('Excluir despesa paga retira o Gasto pelo vínculo e preserva aquisição, outros gastos e arquivo histórico',async()=>{
  const a=app();await despesa(a);a.run(`E.gastos.push({id:'manual',valor:125.23,oque:'Mesmo valor sem vínculo'});E.holdingImoveis.push({id:'outro',nome:'Outro imóvel',pagamentos:[],despesas:[{...baseDespesa}]});`);
  const antes=a.estado();await excluir(a);const e=a.estado(),i=e.holdingImoveis[0];
  assert.equal(i.despesas.length,0);assert.deepEqual(i.pagamentos,antes.holdingImoveis[0].pagamentos);assert.equal(a.run('HoldingModelo.resumo(E.holdingImoveis[0]).percentual'),100);
  assert.deepEqual(e.gastos,[antes.gastos[1]]);assert.deepEqual(e.holdingImoveis[1],antes.holdingImoveis[1]);
  assert.deepEqual(i.despesasExcluidas[0].registro,antes.holdingImoveis[0].despesas[0]);assert.deepEqual(i.despesasExcluidas[0].gasto,antes.gastos[0]);
  assert.equal(i.despesasExcluidas[0].ref,a.run(`HoldingUI.refAnexos('i','despesa','condominio')`));
  a.run('E=carregar();validarBackup(E)');assert.deepEqual(a.estado(),e);
  await assert.rejects(excluir(a),/mudou/);assert.equal(a.estado().holdingImoveis[0].despesasExcluidas.length,1);
});

test('Excluir uma despesa recorrente pendente conserva as demais cobranças e não inventa pagamento',async()=>{
  const a=app();await a.run(`holdingGravarDespesa('i',{id:'serie',tipo:'iptu',descricao:'IPTU de ensaio',valorCentavos:1000,vencimento:'2026-11-30',quantidade:3},null,E.holdingImoveis[0])`);
  const antes=a.estado();await a.run(`holdingExcluirDespesa('i',E.holdingImoveis[0].despesas[1].id,E.holdingImoveis[0].despesas[1],E.holdingImoveis[0])`);
  assert.deepEqual(a.estado().holdingImoveis[0].despesas,[antes.holdingImoveis[0].despesas[0],antes.holdingImoveis[0].despesas[2]]);assert.equal(a.estado().gastos.length,0);assert.equal(a.estado().holdingImoveis[0].despesasExcluidas[0].gasto,null);
});

test('Exclusão rejeita edição concorrente, duplicidade de vínculo e falha local sem apagar parcialmente',async()=>{
  for(const caso of ['desatualizado','duplicado','quota']){
    const a=app();await despesa(a);
    if(caso==='desatualizado')a.run('E.holdingImoveis[0].despesas[0].valorCentavos=15000');
    if(caso==='duplicado')a.run(`E.gastos.push({...E.gastos[0],id:'duplicado'})`);
    if(caso==='quota')a.ctx.localStorage.setItem=()=>{throw Error('quota')};
    const antes=a.estado();await assert.rejects(excluir(a),caso==='quota'?/salvar neste dispositivo/:caso==='duplicado'?/mais de um gasto/:/mudou/);assert.deepEqual(a.estado(),antes);
  }
});

test('Operação compartilhada com aquisição não pode ser excluída como despesa operacional',async()=>{
  const a=app();await despesa(a);a.run(`E.gastos[0].holdingPagamentoId='aquisicao'`);const antes=a.estado();
  await assert.rejects(excluir(a),/aquisição/);assert.deepEqual(a.estado(),antes);
  abrirImovel(a);assert.equal(a.document.querySelectorAll('.holding-apagar-despesa').length,0);
});

test('Conflito remoto só confirma exclusão se o histórico e a retirada de Gastos também estiverem presentes',async()=>{
  for(const perder of ['', 'historico', 'gasto']){
    const a=app();await despesa(a);const gasto=a.estado().gastos[0];a.run('window.__testeSync=true;marcaBase(E._mt,conteudoSync(E))');let remoto,puts=0;
    a.ctx.fetch=async(_,op)=>{if(op.method==='GET')return{ok:true,status:200,json:async()=>({mt:300,dados:remoto})};puts++;remoto=JSON.parse(op.body).dados;
      assert.equal(remoto.holdingImoveis[0].despesas.length,0);assert.equal(remoto.gastos.length,0);assert.equal(remoto.holdingImoveis[0].despesasExcluidas.length,1);
      if(perder==='historico')remoto.holdingImoveis[0].despesasExcluidas=[];if(perder==='gasto')remoto.gastos=[gasto];remoto._mt=300;return{ok:false,status:409,json:async()=>({})};};
    if(perder)await assert.rejects(excluir(a),/mudou/);else assert.match(await excluir(a),/sincronizado/);assert.equal(puts,1);
  }
});

test('Botão do imóvel cancela sem gravar, exclui uma vez e mantém acesso somente de leitura aos comprovantes',async()=>{
  const a=app();await despesa(a);abrirImovel(a);const antes=a.estado();const apagar=button(a.document,'Apagar despesa');assert.ok(apagar);
  const enviar=()=>apagar.closest('form').dispatchEvent(new a.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));
  enviar();await tick();assert.deepEqual(a.estado(),antes);a.ctx.confirm=()=>true;enviar();enviar();await tick();
  assert.equal(a.estado().holdingImoveis[0].despesas.length,0);assert.equal(a.estado().gastos.length,0);assert.equal(a.estado().holdingImoveis[0].despesasExcluidas.length,1);
  const h=a.document.querySelector('.holding-despesas-removidas');assert.ok(h);assert.match(h.textContent,/Condomínio de ensaio/);assert.equal(h.querySelector('input[type=file]').disabled,true);
  assert.match(a.document.querySelector('.holding-feedback').textContent,/Despesa apagada/);
});

test('Custo do avião tem exclusão direta: cancelar preserva, confirmar retira custo e Gasto e atualiza os totais',async()=>{
  for(const tipo of ['mensalidades','despesas']){
    const a=app();a.ctx.dados=tipo==='mensalidades'?{id:'custo',competencia:'2026-11-01',vencimento:'2026-11-05',minhaCota:100.10,status:'Pago',pagoEm:'2026-11-05'}:{id:'custo',natureza:'avulso',descricao:'Internet de ensaio',categoria:'Internet / Comunicação',data:'2026-11-05',minhaCota:100.10,status:'Pago',pagoEm:'2026-11-05'};
    await a.run(`aviaoGravarRegistro('${tipo}',dados)`);a.run(`filtro.aviaoAba='custos';irTela('aviao')`);const antes=a.estado();const apagar=button(a.document,'Apagar custo');assert.ok(apagar);
    apagar.click();await tick();assert.deepEqual(a.estado(),antes);a.ctx.confirm=()=>true;apagar.click();apagar.click();await tick();
    assert.equal(a.estado().aviao[tipo].length,0);assert.equal(a.estado().gastos.length,0);assert.equal(a.run('aviaoResumoCustos(E.aviao).total'),0);
    assert.equal(a.estado().aviao.registrosExcluidos.length,1);assert.ok(a.document.querySelector('.aviao-historico-removidos'));assert.match(a.document.querySelector('.aviao-baixa-feedback').textContent,/Custo apagado/);
  }
});

test('Botões mostram conflito sem retirar a linha e permitem tentar novamente após conferência',async()=>{
  const a=app();await despesa(a);abrirImovel(a);a.ctx.confirm=()=>true;a.run(`E.holdingImoveis[0].despesas[0].valorCentavos=15000`);
  const form=a.document.querySelector('.holding-exclusao');form.dispatchEvent(new a.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.match(form.querySelector('[role=alert]').textContent,/mudou/);assert.equal(form.querySelector('button').disabled,false);assert.equal(a.estado().gastos.length,1);
  await a.run(`aviaoGravarRegistro('mensalidades',{id:'m',competencia:'2026-11-01',vencimento:'2026-11-05',minhaCota:100,status:'Pago',pagoEm:'2026-11-05'})`);
  a.run(`filtro.aviaoAba='custos';irTela('aviao');E.aviao.mensalidades[0].minhaCota=110`);
  const antes=a.estado();button(a.document,'Apagar custo').click();await tick();assert.deepEqual(a.estado(),antes);
  assert.match(a.document.querySelector('.aviao-exclusao-status').textContent,/mudou/);assert.equal(button(a.document,'Apagar custo').disabled,false);
});

test('Exclusão do imóvel aguarda upload em andamento e conserva uma despesa com valor a informar no histórico',async()=>{
  const a=app();await despesa(a,false);abrirImovel(a);a.ctx.confirm=()=>true;
  const form=a.document.querySelector('.holding-exclusao'),upload=a.document.createElement('button');upload.className='solta';upload.setAttribute('aria-busy','true');a.document.querySelector('.holding-area').append(upload);
  form.dispatchEvent(new a.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.match(form.textContent,/envio do comprovante/);assert.equal(a.estado().holdingImoveis[0].despesas.length,1);
  a.run(`E.holdingImoveis[0].despesas[0].valorCentavos=null;globalThis.baseDespesa=structuredClone(E.holdingImoveis[0].despesas[0])`);
  await excluir(a);assert.equal(a.estado().holdingImoveis[0].despesasExcluidas[0].registro.valorCentavos,null);assert.equal(a.estado().gastos.length,0);
});

test('Custos apagados da planilha não reaparecem ao importar novamente a mesma origem',async()=>{
  const a=app();a.run(`E.aviao.mensalidades=[{id:'m',chave:'mes-1',competencia:'2026-11-01',vencimento:'2026-11-05',minhaCota:100,status:'A Vencer'}];E.aviao.despesas=[{id:'d',chave:'extra-1',descricao:'Taxa',data:'2026-11-05',minhaCota:10,status:'Pendente'}];globalThis.pacote=structuredClone(E.aviao)`);
  for(const tipo of ['mensalidades','despesas'])await a.run(`aviaoGravarRegistro('${tipo}',E.aviao.${tipo}[0],E.aviao.${tipo}[0],{excluir:true})`);
  a.run(`E.aviao=mesclarAviaoImportado(E.aviao,pacote)`);
  assert.equal(a.estado().aviao.mensalidades.length,0);assert.equal(a.estado().aviao.despesas.length,0);assert.equal(a.estado().aviao.registrosExcluidos.length,2);assert.equal(a.estado().gastos.length,0);
});
