import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/dom.mjs';

const resposta = (dados, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => structuredClone(dados) });
const json = valor => JSON.parse(JSON.stringify(valor));
const imovel = () => ({ id: 'imovel-qa', nome: 'Unidade de teste', totalCentavos: 10000, pagamentos: [] });
const parcela = (id, valorCentavos) => ({ id, data: '2026-04-07', descricao: 'Conferência de pagamento', valorCentavos });

function novaCentral({ sincronizar = false, comImovel = true } = {}) {
  const app = setup();
  const valores = new Map([['cl_token', 'sessao-sintetica']]);
  app.ctx.localStorage = {
    getItem: k => valores.get(k) ?? null,
    setItem: (k, v) => valores.set(k, String(v)),
    removeItem: k => valores.delete(k)
  };
  app.ctx.sessionStorage = app.ctx.localStorage;
  app.run('E=carregar(); atual="universo-imoveis"');
  app.run('E.aviao.aportes=[{id:"aporte-qa",valor:10,data:"2026-02-03"}]; E.aviao.despesas=[{id:"despesa-qa",viagemId:"viagem-qa"}]');
  if (comImovel) {
    app.ctx.imovelInicial = imovel();
    app.run('E.holdingImoveis=[structuredClone(imovelInicial)]');
  }
  app.run('E._mt=100; guardarEstadoLocal(E)');
  app.run('window.__testeSync=' + String(sincronizar));
  app.estado = () => json(app.run('E'));
  app.aviaoAntes = json(app.run('E.aviao'));
  app.gravarImovel = (dados, base = null) => { app.ctx.dadosQA = dados; app.ctx.baseQA = base; return app.run('holdingGravarImovel(dadosQA, baseQA)'); };
  app.gravarPagamento = (dados, basePagamento = null, baseImovel = imovel()) => {
    app.ctx.dadosQA = dados; app.ctx.baseQA = baseImovel; app.ctx.pgQA = basePagamento;
    return app.run('holdingGravarPagamento("imovel-qa", dadosQA, pgQA, baseQA)');
  };
  return app;
}

test('abrir a holding e restaurar um backup anterior não materializa coleções nem modifica o avião', () => {
  const app = novaCentral({ comImovel: false });
  const antes = app.estado();
  app.run('tela(); validarBackup(E); E=carregar()');
  assert.ok(app.document.querySelector('.holding-area'));
  assert.deepEqual(app.estado(), antes);
  assert.equal(app.run('Object.hasOwn(E,"holdingImoveis")'), false);
});

test('cadastro, pagamento e correção sobrevivem à recarga e validam no backup com centavos e histórico', async () => {
  const app = novaCentral({ comImovel: false });
  assert.match(await app.gravarImovel(imovel()), /dispositivo/);
  const p = parcela('pagamento-qa', 5500);
  await app.gravarPagamento(p);
  await app.gravarPagamento({ ...p, valorCentavos: 5425 }, p);
  const salvo = app.estado();
  assert.equal(salvo.holdingImoveis[0].pagamentos.length, 1);
  assert.equal(salvo.holdingImoveis[0].pagamentos[0].historico[0].valorCentavos, 5500);
  assert.deepEqual(salvo.aviao, app.aviaoAntes);
  app.run('E=carregar();validarBackup(E)');
  assert.deepEqual(app.estado(), salvo);
  assert.deepEqual(json(app.run('HoldingModelo.resumo(E.holdingImoveis[0])')),
    { pago: 5425, saldo: 4575, percentual: 54.25, status: 'Em pagamento' });
  app.run('E.holdingImoveis[0].pagamentos[0].data="2026-02-30"');
  assert.throws(() => app.run('validarBackup(E)'), /data/);
});

test('falta de espaço ao criar ou corrigir volta ao estado anterior e conserva a marca de gravação', async () => {
  for (const comImovel of [false, true]) {
    const app = novaCentral({ comImovel });
    const anterior = app.estado();
    app.ctx.localStorage.setItem = () => { const e = Error('quota cheia'); e.name = 'QuotaExceededError'; throw e; };
    const tentativa = comImovel ? app.gravarPagamento(parcela('nova', 2000)) : app.gravarImovel(imovel());
    await assert.rejects(tentativa, /Não foi possível salvar neste dispositivo/);
    assert.deepEqual(app.estado(), anterior);
  }
});

test('primeira gravação aguarda a leitura inicial e preserva outro pagamento, a aeronave e mudanças em outra área', async () => {
  const app = novaCentral({ sincronizar: true });
  const remoto = app.estado();
  remoto.holdingImoveis[0].pagamentos.push(parcela('remoto', 2500));
  remoto.demandas = [{ id: 'demanda-qa', titulo: 'Outro acesso' }];
  remoto._mt = 200;
  let concluir, gets = 0;
  const puts = [];
  app.ctx.fetch = async (_, op) => {
    if (op.method === 'GET') { gets++; return new Promise(resolve => { concluir = resolve; }); }
    puts.push(JSON.parse(op.body)); return resposta({ mt: 300 });
  };
  const inicial = app.run('puxarNuvem()');
  const save = app.gravarPagamento(parcela('local', 3500));
  assert.equal(app.estado().holdingImoveis[0].pagamentos.length, 0);
  concluir(resposta({ dados: remoto, mt: 200 }));
  await inicial;
  assert.match(await save, /sincronizado/);
  assert.equal(gets, 1);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].base, 200);
  assert.deepEqual(puts[0].dados.holdingImoveis[0].pagamentos.map(p => p.id), ['remoto','local']);
  assert.deepEqual(puts[0].dados.aviao, app.aviaoAntes);
  assert.deepEqual(puts[0].dados.demandas, remoto.demandas);
});

test('rascunho fica visível após adoção remota e uma correção obsoleta não apaga a revisão da outra aba', async () => {
  const app = novaCentral({ sincronizar: true });
  app.run('tela(); marcaBase(100,conteudoSync(E))');
  app.document.querySelector('.holding-cartao button').click();
  const nome = app.document.querySelector('.holding-dialog input[name="nome"]');
  assert.ok(nome);
  nome.value = 'Nome digitado'; nome.dispatchEvent(new app.document.defaultView.Event('input', { bubbles: true }));
  assert.ok(app.document.querySelector('[data-holding-rascunho]'));
  const form = app.document.querySelector('.holding-dialog');
  app.run('tela()');
  assert.equal(app.document.querySelector('.holding-dialog'), form);
  assert.equal(form.dataset.holdingAtualizar,'1');
  const remoto = app.estado();
  remoto.holdingImoveis[0].nome = 'Revisado no outro acesso'; remoto._mt = 200;
  app.ctx.remotoQA = { dados: remoto, mt: 200 };
  app.run('adotaNuvem(remotoQA,true)');
  assert.equal(app.document.querySelector('.holding-dialog'), form);
  assert.equal(nome.value, 'Nome digitado');
  assert.ok(app.run('lerRascunhoSync().formularios.some(f=>f.campos.some(c=>c.valor==="Nome digitado"))'));
  await assert.rejects(app.gravarImovel({ ...imovel(), nome: nome.value }, imovel()), /mudou/);
  assert.equal(app.estado().holdingImoveis[0].nome, 'Revisado no outro acesso');
  assert.deepEqual(app.estado().aviao, app.aviaoAntes);
});

test('reenvio do mesmo ID após queda não duplica a parcela nem declara sincronização antes de resposta', async () => {
  const app = novaCentral({ sincronizar: true });
  app.run('marcaBase(100,conteudoSync(E))');
  const payloads = [];
  app.ctx.fetch = async (_, op) => {
    payloads.push(JSON.parse(op.body));
    return payloads.length === 1 ? resposta({}, 503) : resposta({ mt: 300 });
  };
  const dados = parcela('repetido', 4500);
  assert.match(await app.gravarPagamento(dados), /pendente/);
  assert.match(await app.gravarPagamento(dados), /sincronizado/);
  assert.equal(payloads.length, 2);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(app.estado().holdingImoveis[0].pagamentos.length, 1);
});

test('409 mantém a versão legítima do servidor e a versão local recuperável sem anunciar sucesso', async () => {
  const app = novaCentral({ sincronizar: true });
  app.run('marcaBase(100,conteudoSync(E))');
  const remoto = app.estado();
  remoto.holdingImoveis[0].pagamentos.push(parcela('remoto', 1200)); remoto._mt = 200;
  app.ctx.fetch = async (_, op) => op.method === 'PUT' ? resposta({}, 409) : resposta({ dados: remoto, mt: 200 });
  await assert.rejects(app.gravarPagamento(parcela('local', 1800)), /mudou/);
  assert.deepEqual(app.estado().holdingImoveis[0].pagamentos.map(x => x.id), ['remoto']);
  assert.equal(app.run('lerRecuperacaoLocal().dados.holdingImoveis[0].pagamentos[0].id'), 'local');
  assert.deepEqual(app.estado().aviao, app.aviaoAntes);
});

const planoQA = { id:'serie-qa', descricao:'Plano de teste', primeiroVencimento:'2027-01-31', valorCentavos:4000, quantidade:2 };
function iniciarPlano(app) {
  app.ctx.planoQA = planoQA;
  app.run('E.holdingImoveis=HoldingModelo.gravarSerie(E.holdingImoveis,"imovel-qa",planoQA); salvar();');
  app.run('globalThis.basePlanoQA=structuredClone(E.holdingImoveis[0]); globalThis.baseParcelaQA=structuredClone(basePlanoQA.parcelas[0]);');
}

test('dois cliques no mesmo Pago geram um único pagamento no PUT, que mantém sua data ao recarregar', async () => {
  const app = novaCentral({ sincronizar:true });
  iniciarPlano(app);
  app.run('marcaBase(100,conteudoSync(E))');
  const enviados = [];
  app.ctx.fetch = async (_, op) => { enviados.push(JSON.parse(op.body)); return resposta({mt:200}); };
  const confirmar = () => app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)');
  const resultados = await Promise.all([confirmar(), confirmar()]);
  assert.ok(resultados.every(t=>t.includes('sincronizado')));
  assert.equal(enviados.length,1);
  const salvo = enviados[0].dados.holdingImoveis[0];
  assert.equal(salvo.pagamentos.length,1);
  assert.equal(salvo.pagamentos[0].parcelaId,'serie-qa');
  assert.equal(salvo.pagamentos[0].data,app.run('hoje()'));
  app.run('E=carregar();validarBackup(E)');
  assert.deepEqual(app.estado().holdingImoveis[0], salvo);
  assert.deepEqual(app.estado().aviao, app.aviaoAntes);
});

test('409 com a mesma parcela já quitada em outra aba reconhece o pagamento do servidor sem duplicar', async () => {
  const app = novaCentral({ sincronizar:true });
  iniciarPlano(app);
  app.run('marcaBase(100,conteudoSync(E))');
  const remoto = app.estado();
  remoto.holdingImoveis = json(app.run('HoldingModelo.pagarParcela(E.holdingImoveis,"imovel-qa","serie-qa",hoje())'));
  app.ctx.carteiraRemota=remoto.holdingImoveis;
  remoto.gastos=json(app.run('holdingIntegrarParcela(carteiraRemota,"imovel-qa","serie-qa").gastos'));
  remoto.demandas = [{ id:'demanda-outra-aba', titulo:'Outro acesso' }]; remoto._mt = 200;
  let puts = 0;
  app.ctx.fetch = async (_, op) => { if (op.method === 'GET') return resposta({mt:200,dados:remoto}); puts++; return resposta({},409); };
  const mensagem = await app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)');
  assert.match(mensagem,/sincronizado/);
  assert.equal(puts,1);
  assert.equal(app.estado().holdingImoveis[0].pagamentos.length,1);
  assert.deepEqual(app.estado().demandas,remoto.demandas);
});

test('o botão Pago recusa um valor alterado depois da abertura da ficha', async () => {
  const app = novaCentral();
  iniciarPlano(app);
  await app.run('holdingEditarParcela("imovel-qa",{id:"serie-qa",valorCentavos:3900},baseParcelaQA,basePlanoQA)');
  await assert.rejects(app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)'),/mudou/);
  assert.equal(app.estado().holdingImoveis[0].pagamentos.length,0);
  assert.equal(app.estado().holdingImoveis[0].parcelas[0].valorCentavos,3900);
});

test('despesa avulsa quitada permanece no backup e mantém a aquisição e a aeronave intactas', async () => {
  const app = novaCentral();
  iniciarPlano(app);
  app.ctx.despesaQA = {id:'tributo-qa',tipo:'impostos',descricao:'Imposto de teste',valorCentavos:1300,vencimento:null};
  await app.run('holdingGravarDespesa("imovel-qa",despesaQA,null,basePlanoQA)');
  const base = app.estado().holdingImoveis[0];
  app.ctx.baseDespesaQA = base.despesas[0];
  await app.run('holdingPagarDespesa("imovel-qa","tributo-qa",baseDespesaQA,basePlanoQA)');
  await app.run('holdingPagarDespesa("imovel-qa","tributo-qa",baseDespesaQA,basePlanoQA)');
  app.run('E=carregar();validarBackup(E)');
  const imovelAtual = app.estado().holdingImoveis[0];
  assert.equal(imovelAtual.despesas.length,1);
  assert.equal(imovelAtual.despesas[0].pagoEm,app.run('hoje()'));
  assert.deepEqual(imovelAtual.pagamentos,base.pagamentos);
  assert.deepEqual(imovelAtual.parcelas,base.parcelas);
  assert.equal(app.run('HoldingModelo.resumo(E.holdingImoveis[0]).percentual'),0);
  assert.equal(app.run('HoldingModelo.resumoDespesas(E.holdingImoveis[0]).impostos.pago'),1300);
  assert.deepEqual(app.estado().aviao,app.aviaoAntes);
});

function planoIntegrado(app) {
  iniciarPlano(app);
  app.run('E.holdingImoveis[0].gastosEmpresaId="empresa-qa";E.empresasPJ=[{id:"empresa-qa",nome:"Empresa de ensaio"}];E.gastos=[]');
}

test('baixa integrada salva pagamento e gasto juntos, reutiliza vínculo e resiste à repetição e recarga', async()=>{
  const app=novaCentral();planoIntegrado(app);
  const pagar=()=>app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)');
  await Promise.all([pagar(),pagar()]);
  const estado=app.estado(),g=estado.gastos[0],pg=estado.holdingImoveis[0].pagamentos[0];
  assert.equal(estado.gastos.length,1);assert.equal(g.valor,pg.valorCentavos/100);
  assert.equal(g.pagoEm,pg.data);assert.equal(g.mes,pg.data.slice(0,7));
  assert.equal(g.empresaId,'empresa-qa');assert.equal(g.situacao,'Pago');
  assert.equal(g.holdingImovelId,'imovel-qa');assert.equal(g.holdingParcelaId,'serie-qa');
  app.run('E=carregar()');await pagar();assert.deepEqual(app.estado().gastos,estado.gastos);
  app.run('E.gastos[0].id="legado";E.gastos[0].obs="Observação preservada";');
  await pagar();assert.equal(app.estado().gastos.length,1);assert.equal(app.estado().gastos[0].id,'legado');assert.equal(app.estado().gastos[0].obs,'Observação preservada');
});

test('quota e empresa ausente impedem baixa parcial da parcela integrada', async()=>{
  for (const modo of ['quota','empresa']) {
    const app=novaCentral();planoIntegrado(app);
    if(modo==='empresa')app.run('E.empresasPJ=[]');
    const antes=app.estado();
    if(modo==='quota')app.ctx.localStorage.setItem=()=>{throw Error('quota cheia')};
    await assert.rejects(app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)'),/salvar|empresa/);
    assert.deepEqual(app.estado(),antes);
  }
});

test('envio integrado inclui ambas as coleções em um PUT e conflito com outra aba mantém uma baixa e um gasto', async()=>{
  const app=novaCentral({sincronizar:true});planoIntegrado(app);
  app.run('marcaBase(100,conteudoSync(E))');
  let remoto,puts=0;
  app.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return resposta({mt:200,dados:remoto});
    puts++;const enviado=JSON.parse(op.body);
    assert.equal(enviado.dados.gastos.length,1);
    assert.equal(enviado.dados.holdingImoveis[0].pagamentos.length,1);
    remoto=enviado.dados;remoto._mt=200;
    return resposta({},409);
  };
  await assert.match(await app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)'),/sincronizado/);
  assert.equal(puts,1);assert.equal(app.estado().gastos.length,1);
});

test('releitura remota com baixa sem gasto não informa integração concluída', async()=>{
  const app=novaCentral({sincronizar:true});planoIntegrado(app);
  app.run('marcaBase(100,conteudoSync(E))');
  let remoto;
  app.ctx.fetch=async(_,op)=>{
    if(op.method==='GET')return resposta({mt:200,dados:remoto});
    remoto=JSON.parse(op.body).dados;remoto.gastos=[];remoto._mt=200;
    return resposta({},409);
  };
  await assert.rejects(app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)'),/mudou/);
  assert.equal(app.estado().gastos.length,0);
});

test('o gasto vinculado resolve a mesma referência dos comprovantes da parcela', async()=>{
  const app=novaCentral();planoIntegrado(app);
  await app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)');
  const ref=app.run('HoldingUI.refAnexos("imovel-qa","parcela","serie-qa")');
  assert.equal(app.run('holdingAnexosCompartilhados("gasto:"+E.gastos[0].id)'),ref);
  assert.equal(app.run('holdingAnexosCompartilhados(HoldingUI.refAnexos("imovel-qa","parcela","serie-qa"))'),ref);
  assert.equal(app.run('holdingAnexosCompartilhados("gasto:nao-vinculado")'),null);
});

test('upload compartilhado reusa comprovante histórico pelo conteúdo, mesmo com outro nome',async()=>{
  const app=novaCentral();planoIntegrado(app);
  app.ctx.crypto=(await import('node:crypto')).webcrypto;
  const file=new Blob(['pdf de teste'],{type:'application/pdf'});file.name='outro nome.pdf';
  app.ctx.fileQA=file;
  app.ctx.historicoQA={id:'comprovante-antigo',tam:file.size,nome:'nome antigo.pdf',blob:file};
  app.run('arqPor=async()=>[historicoQA]');
  const r=await app.run('holdingIdComprovante("holding:imovel-qa:parcela:serie-qa",fileQA)');
  assert.equal(r.id,'comprovante-antigo');assert.equal(r.existente.id,'comprovante-antigo');
  app.run('arqPor=async()=>[]');
  const [a,b]=await Promise.all([app.run('holdingIdComprovante("holding:imovel-qa:parcela:serie-qa",fileQA)'),app.run('holdingIdComprovante("holding:imovel-qa:parcela:serie-qa",fileQA)')]);
  assert.equal(a.id,b.id);
  const outro=await app.run('holdingIdComprovante("holding:imovel-qa:parcela:outra",fileQA)');
  assert.notEqual(a.id,outro.id);
});

test('gasto vinculado protege valor e data na ficha e fica fora da repetição mensal',async()=>{
  const app=novaCentral();planoIntegrado(app);
  await app.run('holdingPagarParcela("imovel-qa","serie-qa",baseParcelaQA,basePlanoQA)');
  app.run('modalLancamentoGasto(E.gastos[0])');
  for(const name of ['valor','mes','data','situacao','pagoEm','empresaId'])assert.equal(app.document.querySelector('.ff-form [name="'+name+'"]').disabled,true);
  app.run('document.querySelector(".fundo")?.remove();financeiroRepetirGastos(E.gastos,"2027-01")');
  assert.equal(app.document.querySelectorAll('.ff-repeat-row').length,0);
});

test('Ajustar plano preserva gasto e pagamento já baixado, persiste e rejeita edição concorrente',async()=>{
  const app=novaCentral();
  app.run(`E.empresasPJ=[{id:'empresa',nome:'Empresa sintética'}];E.holdingImoveis[0].gastosEmpresaId='empresa';
    E.holdingImoveis=HoldingModelo.gravarSerie(E.holdingImoveis,'imovel-qa',{id:'prev',descricao:'Parcela',quantidade:2,valorCentavos:5000,primeiroVencimento:'2026-11-30'});`);
  await app.run(`holdingPagarParcela('imovel-qa','prev',E.holdingImoveis[0].parcelas[0],E.holdingImoveis[0])`);
  const antes=app.estado();
  app.run(`globalThis.baseAjuste=structuredClone(E.holdingImoveis[0]);globalThis.ajusteQA={id:'ajuste',quantidade:3,primeiroVencimento:'2026-12-31',intervaloMeses:1}`);
  await app.run(`holdingReparcelar('imovel-qa',ajusteQA,baseAjuste)`);
  assert.deepEqual(app.estado().gastos,antes.gastos);
  assert.deepEqual(app.estado().holdingImoveis[0].pagamentos,antes.holdingImoveis[0].pagamentos);
  await app.run(`holdingReparcelar('imovel-qa',ajusteQA,baseAjuste)`);
  assert.equal(app.estado().holdingImoveis[0].reparcelamentos.length,1);
  app.run('E=carregar();validarBackup(E)');
  assert.equal(app.estado().holdingImoveis[0].parcelas.length,4);
  const antesConflito=app.estado();
  await assert.rejects(app.run(`holdingReparcelar('imovel-qa',{...ajusteQA,id:'outra'},baseAjuste)`),/mudou/);
  assert.deepEqual(app.estado(),antesConflito);
  app.run('globalThis.baseAjuste=structuredClone(E.holdingImoveis[0])');
  app.ctx.localStorage.setItem=()=>{throw Error('QuotaExceededError')};
  await assert.rejects(app.run(`holdingReparcelar('imovel-qa',{...ajusteQA,id:'quota'},baseAjuste)`),/Não foi possível salvar/);
  assert.deepEqual(app.estado(),antesConflito);
});
