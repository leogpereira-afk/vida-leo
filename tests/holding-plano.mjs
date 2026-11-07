import test from 'node:test';
import assert from 'node:assert/strict';
import '../publico/holding-modelo.js';

const M = globalThis.HoldingModelo;
const novo = (totalCentavos = 200000) => M.salvarImovel([], { id: 'unidade', nome: 'Unidade sintética', totalCentavos });
const serie = { id: 'serie', descricao: 'Parcela do contrato', primeiroVencimento: '2024-01-31', valorCentavos: 10000, quantidade: 3 };
const despesa = { id: 'custo', descricao: 'Custo de teste', tipo: 'condominio', valorCentavos: null, vencimento: null };

test('série mensal conserva o dia original, inclusive após fevereiro e na virada do ano', () => {
  const carteira = M.gravarSerie(novo(), 'unidade', serie);
  assert.deepEqual(carteira[0].parcelas.map(p => p.vencimento), ['2024-01-31','2024-02-29','2024-03-31']);
  assert.deepEqual(carteira[0].parcelas.map(p => p.id), ['serie','serie:2','serie:3']);
  assert.equal(M.gravarSerie(carteira, 'unidade', serie), carteira);
  const virada = M.gravarSerie(novo(), 'unidade', { ...serie, primeiroVencimento: '2026-12-31' });
  assert.deepEqual(virada[0].parcelas.map(p => p.vencimento), ['2026-12-31','2027-01-31','2027-02-28']);
  assert.equal(M.resumo(carteira[0]).pago, 0);
  assert.throws(() => M.gravarSerie(carteira, 'unidade', { ...serie, quantidade: 4 }), /identificador/);
  assert.throws(() => M.gravarSerie(novo(), 'unidade', { ...serie, quantidade: 0 }), /meses/);
});

test('confirmar parcela cria um pagamento datado; repetir, inclusive depois de recarregar, mantém o primeiro pagamento', () => {
  let carteira = M.gravarSerie(novo(), 'unidade', serie);
  carteira = M.pagarParcela(carteira, 'unidade', 'serie:2', '2024-02-15');
  const paga = M.pagamentoDaParcela(carteira[0], 'serie:2');
  assert.deepEqual(paga, { id: 'parcela:serie:2', parcelaId: 'serie:2', data: '2024-02-15', valorCentavos:10000, descricao:serie.descricao });
  const recarregada = JSON.parse(JSON.stringify(carteira));
  assert.equal(M.pagarParcela(recarregada, 'unidade', 'serie:2', '2024-02-16'), recarregada);
  assert.equal(M.resumo(recarregada[0]).pago, 10000);
  assert.equal(recarregada[0].pagamentos.length, 1);
  assert.throws(() => M.editarParcela(carteira, 'unidade', { id:'serie:2', valorCentavos: 5000 }), /pago/);
  assert.throws(() => M.salvarPagamento(carteira, 'unidade', { ...paga, valorCentavos: 5000 }), /vínculo/);
  const corrigida = M.salvarPagamento(carteira, 'unidade', { ...paga, data:'2024-02-14' });
  assert.equal(corrigida[0].pagamentos[0].historico[0].data, '2024-02-15');
});

test('saldo já pago e parcelas ainda previstas limitam planejamento sem contar a parcela paga duas vezes', () => {
  let c = novo(10500);
  c = M.salvarPagamento(c,'unidade',{id:'entrada', data:'2024-01-01', valorCentavos:500});
  assert.throws(() => M.gravarSerie(c,'unidade', { ...serie, quantidade:2, valorCentavos:5001 }), /ultrapassam/);
  c = M.gravarSerie(c, 'unidade', { ...serie, quantidade:2, valorCentavos:5000 });
  c = M.pagarParcela(c, 'unidade', 'serie', '2024-01-31');
  assert.equal(M.resumo(c[0]).pago,5500);
  assert.throws(() => M.salvarImovel(c,{id:'unidade',totalCentavos:10499}), /ultrapassam/);
  c = M.pagarParcela(c, 'unidade', 'serie:2', '2024-02-29');
  assert.deepEqual(M.resumo(c[0]), {pago:10500,saldo:0,percentual:100,status:'Quitado'});
});

test('despesas das três naturezas têm pagamentos próprios; valor desconhecido ou vencimento ausente é preservado', () => {
  let c = M.gravarDespesa(novo(), 'unidade', despesa);
  assert.equal(c[0].despesas[0].valorCentavos,null);
  assert.equal(c[0].despesas[0].vencimento,null);
  assert.equal(M.resumoDespesas(c[0]).condominio.aInformar,1);
  assert.throws(()=>M.pagarDespesa(c,'unidade','custo','2026-01-03'), /Informe o valor/);
  c = M.gravarDespesa(c,'unidade',{ id:'custo', valorCentavos:850 });
  c = M.gravarDespesa(c,'unidade',{ ...despesa,id:'obra',tipo:'investimento',valorCentavos:1000 });
  c = M.gravarDespesa(c,'unidade',{ ...despesa,id:'taxa',tipo:'impostos',valorCentavos:300 });
  c = M.pagarDespesa(c,'unidade','custo','2026-01-10');
  c = M.pagarDespesa(c,'unidade','taxa','2026-01-11');
  assert.equal(M.pagarDespesa(c,'unidade','taxa','2026-01-15'),c);
  assert.equal(c[0].despesas[0].vencimento,null);
  assert.equal(c[0].despesas[0].pagoEm,'2026-01-10');
  assert.deepEqual(M.resumo(c[0]),{pago:0,saldo:200000,percentual:0,status:'Em pagamento'});
  assert.equal(M.resumoDespesas(c[0]).total.pago,1150);
  assert.equal(M.resumoDespesas(c[0]).investimento.aberto,1000);
  assert.equal(M.resumoDespesas(c[0]).impostos.pago,300);
  assert.throws(()=>M.gravarDespesa(c,'unidade',{id:'taxa',valorCentavos:350}), /já foi pago/);
});

test('despesa mensal gera somente a quantidade escolhida e repetir a série mantém inclusive a baixa', () => {
  const plano = { ...despesa,vencimento:'2025-01-31',valorCentavos:900,quantidade:3 };
  let c = M.gravarDespesa(novo(),'unidade',plano);
  assert.deepEqual(c[0].despesas.map(d=>d.vencimento),['2025-01-31','2025-02-28','2025-03-31']);
  c = M.pagarDespesa(c,'unidade','custo:2','2025-02-10');
  assert.equal(M.gravarDespesa(c,'unidade',plano),c);
  assert.equal(M.resumoDespesas(c[0]).condominio.aberto,1800);
  assert.throws(()=>M.gravarDespesa(novo(),'unidade',{...despesa,quantidade:2}),/primeiro vencimento/);
});

test('legados sem classificação permanecem avulsos e as naturezas de aquisição e despesa não se misturam', () => {
  const c = novo();
  c[0].despesas = [{id:'antigo',descricao:'Impostos e condomínio',valorCentavos:200,pagoEm:null}];
  const anterior = JSON.stringify(c);
  assert.equal(M.tipoDespesa(c[0].despesas[0]),'avulsa');
  assert.equal(M.resumoDespesas(c[0]).avulsa.aberto,200);
  assert.equal(JSON.stringify(c),anterior);
  assert.throws(()=>M.gravarDespesa(c,'unidade',{...despesa,tipo:'aquisicao'}),/Escolha/);
  assert.throws(()=>M.gravarDespesa(c,'unidade',{...despesa,tipo:undefined}),/Escolha/);
  assert.throws(()=>M.salvarPagamento(c,'unidade',{id:'x',tipo:'impostos',data:'2026-01-07',valorCentavos:50}),/despesa/);
});

test('agendar, reagendar e confirmar são etapas distintas da mesma despesa', () => {
  const base = M.gravarDespesa(novo(), 'unidade', { ...despesa, valorCentavos:1000 });
  assert.equal(Object.hasOwn(base[0].despesas[0], 'agendadoPara'), false);
  let c = M.gravarDespesa(base,'unidade',{id:'custo',agendadoPara:'2031-02-10'});
  assert.equal(c[0].despesas.length,1);
  assert.equal(c[0].despesas[0].agendadoPara,'2031-02-10');
  assert.equal(c[0].despesas[0].pagoEm,null);
  assert.equal(c[0].despesas[0].vencimento,null);
  assert.deepEqual(M.resumoDespesas(c[0]).condominio,{pago:0,aberto:1000,aInformar:0,quantidade:1});
  assert.equal(M.gravarDespesa(c,'unidade',{id:'custo',agendadoPara:'2031-02-10'}),c);
  c=M.gravarDespesa(c,'unidade',{id:'custo',agendadoPara:'2031-02-12'});
  assert.equal(c[0].despesas[0].historico.at(-1).agendadoPara,'2031-02-10');
  c=M.pagarDespesa(c,'unidade','custo','2031-02-13');
  assert.equal(c[0].despesas[0].agendadoPara,'2031-02-12');
  assert.equal(c[0].despesas[0].pagoEm,'2031-02-13');
  assert.deepEqual(M.resumoDespesas(c[0]).condominio,{pago:1000,aberto:0,aInformar:0,quantidade:1});
  assert.deepEqual(M.resumo(c[0]),M.resumo(base[0]));
  M.validarCarteira(JSON.parse(JSON.stringify(c)));
});

test('datas de agendamento impeditivas e despesa antiga sem campo são tratadas sem gravar uma baixa', () => {
  const base=M.gravarDespesa(novo(),'unidade',{...despesa,valorCentavos:200,vencimento:'2031-01-31'});
  const original=JSON.stringify(base);
  assert.throws(()=>M.gravarDespesa(base,'unidade',{id:'custo',agendadoPara:'2031-02-29'}), /data agendada/);
  assert.throws(()=>M.gravarDespesa(base,'unidade',{...despesa,id:'serie-x',vencimento:'2031-01-31',agendadoPara:'2031-01-20',quantidade:3}),/única despesa/);
  assert.equal(JSON.stringify(base),original);
  const editada=M.gravarDespesa(base,'unidade',{id:'custo',valorCentavos:250,agendadoPara:''});
  assert.equal(Object.hasOwn(editada[0].despesas[0],'agendadoPara'),false);
  const agendada=M.gravarDespesa(editada,'unidade',{id:'custo',agendadoPara:'2031-01-20'});
  const retirada=M.gravarDespesa(agendada,'unidade',{id:'custo',agendadoPara:null});
  assert.equal(retirada[0].despesas[0].agendadoPara,null);
  assert.equal(retirada[0].despesas[0].historico.at(-1).agendadoPara,'2031-01-20');
  assert.equal(retirada[0].despesas[0].pagoEm,null);
});

test('restauração rejeita referências ausentes, duplicidade ou divergência no valor de baixa', () => {
  const c = M.pagarParcela(M.gravarSerie(novo(),'unidade',serie),'unidade','serie','2024-01-15');
  for (const adulterar of [
    d=>{d[0].parcelas=[];},
    d=>{d[0].pagamentos[0].valorCentavos=9000;},
    d=>{d[0].pagamentos.push({...d[0].pagamentos[0],id:'copia'});}
  ]) {
    const alterado = structuredClone(c);
    adulterar(alterado);
    assert.throws(()=>M.validarCarteira(alterado),/vínculo/);
  }
});

test('Reparcelamento distribui centavos, preserva baixas e arquiva o cronograma anterior',()=>{
  let c=M.gravarSerie(novo(20001),'unidade',{...serie,quantidade:2,valorCentavos:5000});
  c=M.pagarParcela(c,'unidade','serie','2024-01-31');
  const antes=structuredClone(c), dados={id:'ajuste',quantidade:3,intervaloMeses:6,primeiroVencimento:'2026-12-31'};
  const previa=M.simularParcelamento(c[0],dados);
  assert.deepEqual(previa.parcelas.map(p=>p.valorCentavos),[5001,5000,5000]);
  assert.equal(previa.ultimoVencimento,'2027-12-31');
  const novoPlano=M.reparcelar(c,'unidade',dados);
  assert.deepEqual(c,antes);
  assert.deepEqual(novoPlano[0].pagamentos,c[0].pagamentos);
  assert.deepEqual(novoPlano[0].parcelas[0],c[0].parcelas[0]);
  assert.deepEqual(novoPlano[0].reparcelamentos[0].parcelasAnteriores,[c[0].parcelas[1]]);
  assert.equal(M.resumo(novoPlano[0]).saldo,15001);
  assert.equal(M.reparcelar(novoPlano,'unidade',dados),novoPlano);
  assert.throws(()=>M.reparcelar(novoPlano,'unidade',{...dados,quantidade:4}),/identificador/);
  assert.equal(M.prazoPlano(novoPlano[0]).completo,true);
  assert.equal(M.prazoPlano(c[0]).completo,false);
});

test('Parcelamento valida entradas e vencimentos sem inventar quitação de plano incompleto',()=>{
  const i=novo(10001)[0],dados={id:'ajuste',quantidade:3,intervaloMeses:1,primeiroVencimento:'2027-01-31'};
  assert.deepEqual(M.simularParcelamento(i,dados).parcelas.map(p=>p.vencimento),['2027-01-31','2027-02-28','2027-03-31']);
  for (const extra of [{quantidade:0},{quantidade:361},{quantidade:1.5},{intervaloMeses:0},{intervaloMeses:5},{primeiroVencimento:'2027-02-30'}]) assert.throws(()=>M.simularParcelamento(i,{...dados,...extra}));
  assert.throws(()=>M.simularParcelamento({...i,totalCentavos:null},dados),/aquisição/);
  assert.throws(()=>M.simularParcelamento(novo(2)[0],dados),/centavo/);
  const quitado=M.salvarPagamento([i],i.id,{id:'pago',data:'2026-11-01',valorCentavos:10001});
  assert.throws(()=>M.reparcelar(quitado,i.id,dados),/quitado/);
  assert.equal(M.prazoPlano(quitado[0]).quitadoEm,'2026-11-01');
  assert.equal(M.prazoPlano(i).completo,false);
});
