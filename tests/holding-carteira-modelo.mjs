import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { setup } from './helpers/dom.mjs';
import '../publico/holding-carteira-modelo.js';

const M = globalThis.HoldingCarteiraModelo;
const imoveis = [
  {id:'imovel-a',nome:'Unidade de teste A',totalCentavos:100000,pagamentos:[]},
  {id:'imovel-b',nome:'Unidade de teste B',totalCentavos:190000,pagamentos:[]}
];
const cadastro = [{id:'pj-a',nome:'Empresa fictícia',sistemasEmpresa:[{id:'sistema-qa'}]}];
const empresa = {id:'participacao-a',empresaId:'pj-a',participacaoPct:15,valorParticipacaoCentavos:55000};
const comp = {tipo:'empresa',origemId:'participacao-a',competencia:'2026-03'};
const aluguel = {tipo:'imovel',origemId:'imovel-a',competencia:'2026-03'};
const clonar = v => JSON.parse(JSON.stringify(v));

test('avaliação atual e valor da participação compõem patrimônio uma vez, sem derivar do custo de compra nem reaplicar percentual', () => {
  let estado = M.salvarValorImovel(undefined,{imovelId:'imovel-a',valorAtualCentavos:120000},imoveis);
  estado = M.salvarEmpresa(estado,empresa,cadastro);
  const resumo = M.resumo(estado,{imoveis,competencia:'2026-03',valorAeronaveCentavos:4000});
  assert.deepEqual(resumo.patrimonio.total,{conhecido:179000,informados:3,pendentes:1,total:4});
  assert.equal(resumo.patrimonio.empresas.conhecido,55000);
  assert.equal(resumo.patrimonio.imoveis.pendentes,1);
  assert.equal(estado.empresas[0].nome,cadastro[0].nome);
  assert.equal(cadastro[0].participacaoPct,undefined);
  assert.equal(M.salvarEmpresa(estado,empresa,cadastro),estado);
});

test('valor patrimonial zero é informado; dados faltantes, aeronave ausente ou aeronave sem avaliação têm resultados distintos', () => {
  let f = M.salvarValorImovel(undefined,{imovelId:'imovel-a',valorAtualCentavos:0},imoveis);
  const r = aviao => M.resumo(f,{imoveis,competencia:'2026-03',valorAeronaveCentavos:aviao});
  assert.deepEqual(r(undefined).patrimonio.total,{conhecido:0,informados:1,pendentes:1,total:2});
  assert.deepEqual(r(null).patrimonio.total,{conhecido:0,informados:1,pendentes:2,total:3});
  assert.deepEqual(r(0).patrimonio.total,{conhecido:0,informados:2,pendentes:1,total:3});
  f = M.salvarValorImovel(f,{imovelId:'imovel-a',valorAtualCentavos:null},imoveis);
  assert.equal(r(undefined).patrimonio.total.conhecido,null);
  assert.equal(f.imoveis[0].historico[0].antes.valorAtualCentavos,0);
});

test('aluguel e repasse recebidos formam a renda mensal; faturamento fica separado e meses faltantes não são projetados', () => {
  let f = M.salvarEmpresa(undefined,empresa,cadastro);
  f = M.salvarMensal(f,{...comp,faturamentoCentavos:1000000,repasseCentavos:8000},imoveis);
  f = M.salvarMensal(f,{...aluguel,aluguelCentavos:1500},imoveis);
  f = M.salvarMensal(f,{...comp,competencia:'2026-01',faturamentoCentavos:500000,repasseCentavos:0},imoveis);
  const r = M.resumo(f,{imoveis,competencia:'2026-03',quantidadeMeses:6});
  assert.equal(r.mes.renda.conhecido,9500);
  assert.equal(r.mes.renda.pendentes,1);
  assert.equal(r.mes.faturamento.conhecido,1000000);
  assert.equal(r.serie.length,6);
  assert.deepEqual(r.serie.map(m=>m.competencia),['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03']);
  assert.equal(r.serie.at(-2).renda.conhecido,null);
  assert.equal(r.serie.at(-3).repasses.conhecido,0);
});

test('corrigir uma competência mantém o histórico, os outros campos e os outros meses; reenviar não duplica', () => {
  let f = M.salvarEmpresa(undefined,empresa,cadastro);
  f = M.salvarMensal(f,{...comp,faturamentoCentavos:7050,repasseCentavos:0},imoveis);
  f = M.salvarMensal(f,{...comp,competencia:'2026-02',repasseCentavos:1200},imoveis);
  const antes = structuredClone(f);
  const corrigido = M.salvarMensal(f,{...comp,repasseCentavos:760},imoveis);
  assert.equal(corrigido.mensais.length,2);
  assert.deepEqual(f,antes);
  assert.equal(corrigido.mensais[0].faturamentoCentavos,7050);
  assert.equal(corrigido.mensais[0].historico[0].antes.repasseCentavos,0);
  assert.deepEqual(corrigido.mensais[1],antes.mensais[1]);
  assert.equal(M.salvarMensal(corrigido,{...comp,repasseCentavos:760},imoveis),corrigido);
  const recarregado = clonar(corrigido);
  M.validar(recarregado,imoveis);
  assert.deepEqual(recarregado,corrigido);
});

test('recusa vínculos, datas, duplicidade e valor inválidos; impede transferir histórico mensal de uma empresa para outra', () => {
  let f = M.salvarEmpresa(undefined,empresa,cadastro);
  assert.throws(()=>M.salvarEmpresa(f,{...empresa,id:'copia'},cadastro),/já está/);
  assert.throws(()=>M.salvarEmpresa(f,{...empresa,empresaId:'desconhecida'},cadastro),/cadastro/);
  assert.throws(()=>M.salvarEmpresa(f,{...empresa,participacaoPct:110},cadastro),/100%/);
  assert.throws(()=>M.salvarValorImovel(f,{imovelId:'desconhecido',valorAtualCentavos:600},imoveis),/não encontrado/);
  assert.throws(()=>M.salvarMensal(f,{...aluguel,aluguelCentavos:-1},imoveis),/zero ou positivo/);
  assert.throws(()=>M.salvarMensal(f,{...aluguel,competencia:'2026-13'},imoveis),/competência/);
  assert.throws(()=>M.salvarMensal(f,{...aluguel,faturamentoCentavos:0},imoveis),/empresas/);
  f = M.salvarMensal(f,{...comp,repasseCentavos:100},imoveis);
  assert.throws(()=>M.validar({...f,mensais:[...f.mensais,...f.mensais]},imoveis),/duplicado/);
  assert.throws(()=>M.salvarEmpresa(f,{...empresa,empresaId:null,nome:'Novo nome'},cadastro),/outra participação/);
});

function central(sincronizar = false) {
  const app = setup();
  for (const arquivo of ['holding-carteira-modelo','holding-carteira-central']) {
    if (app.run(arquivo.endsWith('modelo') ? 'typeof HoldingCarteiraModelo' : 'typeof holdingApiCarteira') === 'undefined') {
      vm.runInContext(readFileSync(new URL('../publico/'+arquivo+'.js',import.meta.url),'utf8'),app.ctx);
    }
  }
  const valores = new Map([['cl_token','sessao-ficticia']]);
  app.ctx.localStorage = {getItem:k=>valores.get(k) ?? null,setItem:(k,v)=>valores.set(k,String(v)),removeItem:k=>valores.delete(k)};
  app.ctx.sessionStorage = app.ctx.localStorage;
  app.ctx.imoveisQA = structuredClone(imoveis); app.ctx.cadastroQA = structuredClone(cadastro);
  app.run('E=carregar(); E.holdingImoveis=imoveisQA; E.empresasPJ=cadastroQA; E.aviao.nome="Aeronave de teste"; E._mt=100; guardarEstadoLocal(E); E=carregar(); globalThis.q=holdingApiCarteira()');
  app.run('window.__testeSync='+String(sincronizar));
  app.ctx.empresaQA = structuredClone(empresa);
  return app;
}

test('adaptador materializa apenas ao salvar, recarrega valores e preserva avião, aquisição, Empresas e Rendimentos', async () => {
  const app = central(), inicial = clonar(app.run('E'));
  assert.deepEqual(clonar(app.run('q.listar()')),M.vazio());
  assert.equal(app.run('Object.hasOwn(E,"holdingFinanceiro")'),false);
  await app.run('q.gravarEmpresa(empresaQA,null)');
  app.ctx.mensalQA = {...comp,repasseCentavos:122,faturamentoCentavos:500};
  await app.run('q.gravarMensal(mensalQA,null)');
  await app.run('q.gravarValorImovel({imovelId:"imovel-a",valorAtualCentavos:880000},null)');
  app.run('E=carregar();validarBackup(E)');
  const salvo = clonar(app.run('E'));
  for (const chave of ['aviao','empresasPJ','rendimentos','holdingImoveis']) assert.deepEqual(salvo[chave],inicial[chave]);
  assert.equal(app.run('q.lerMensal("empresa","participacao-a","2026-03").repasseCentavos'),122);
  assert.equal(app.run('q.lerValorImovel("imovel-a").valorAtualCentavos'),880000);
});

test('falha no armazenamento desfaz a primeira gravação e correção obsoleta não substitui valor salvo', async () => {
  const app = central();
  const escrever = app.ctx.localStorage.setItem;
  app.ctx.localStorage.setItem = () => { throw Object.assign(Error('quota cheia'),{name:'QuotaExceededError'}); };
  await assert.rejects(app.run('q.gravarEmpresa(empresaQA,null)'),/salvar neste dispositivo/);
  assert.equal(app.run('Object.hasOwn(E,"holdingFinanceiro")'),false);
  assert.equal(app.run('E._mt'),100);
  app.ctx.localStorage.setItem = escrever;
  await app.run('q.gravarEmpresa(empresaQA,null);');
  app.run('globalThis.v1=q.listarEmpresas()[0]');
  await app.run('q.gravarEmpresa({...empresaQA,valorParticipacaoCentavos:82000},v1)');
  await assert.rejects(app.run('q.gravarEmpresa({...empresaQA,valorParticipacaoCentavos:100},v1)'), /mudou/);
  assert.equal(app.run('q.listarEmpresas()[0].valorParticipacaoCentavos'),82000);
});

test('reenvio após interrupção não duplica a competência e 409 preserva alteração remota e cópia local',async()=>{
  const app=central(true), resposta=(dados,status=200)=>({status,ok:status<300,json:async()=>structuredClone(dados)});
  app.run('marcaBase(100,conteudoSync(E))');
  app.ctx.mensalQA={...aluguel,aluguelCentavos:1100};
  let tentativa=0;
  app.ctx.fetch=async()=>++tentativa===1?resposta({},503):resposta({mt:101});
  assert.match(await app.run('q.gravarMensal(mensalQA,null)'),/pendente/);
  assert.match(await app.run('q.gravarMensal(mensalQA,null)'),/sincronizado/);
  assert.equal(app.run('q.listarMensais().length'),1);
  const remoto=clonar(app.run('E'));
  remoto.holdingFinanceiro=M.salvarMensal(remoto.holdingFinanceiro,{...aluguel,aluguelCentavos:9400},imoveis);
  remoto._mt=200;
  app.ctx.fetch=async(_,op)=>op.method==='PUT'?resposta({},409):resposta({dados:remoto,mt:200});
  app.run('globalThis.baseMes=q.lerMensal("imovel","imovel-a","2026-03")');
  await assert.rejects(app.run('q.gravarMensal({...mensalQA,aluguelCentavos:2200},baseMes)'),/mudou/);
  assert.equal(app.run('q.listarMensais()[0].aluguelCentavos'),9400);
  assert.equal(app.run('lerRecuperacaoLocal().dados.holdingFinanceiro.mensais[0].aluguelCentavos'),2200);
});
