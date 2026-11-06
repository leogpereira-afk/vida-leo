import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/dom.mjs';

test('o resumo soma somente aquisições no indicador de aquisição e separa desembolsos de cada natureza', () => {
  const {run,document}=setup();
  run(`
    E.holdingImoveis = [{
      id:'imovel-teste', nome:'Imóvel de ensaio', totalCentavos:120000,
      pagamentos:[{id:'p1', data:'2026-01-02', valorCentavos:30000, descricao:'Entrada'}],
      despesas:[
        {id:'d1', tipo:'investimento', descricao:'Melhoria', valorCentavos:3400, pagoEm:'2026-02-03', vencimento:null},
        {id:'d2', tipo:'condominio', descricao:'Mensalidade', valorCentavos:2800, pagoEm:null, vencimento:null},
        {id:'d3', tipo:'impostos', descricao:'Tributo', valorCentavos:1900, pagoEm:'2026-02-02', vencimento:null}
      ]
    },{ id:'imovel-sem-preco', nome:'Outro imóvel de ensaio', totalCentavos:null, pagamentos:[] }];
    E.aviao.aportes = [{id:'a1',valor:140}];
    E.aviao.valorCotaAtual = 200;
    E.aviao.despesas = [{id:'extra',minhaCota:80,status:'Pago'}];
    const anterior = JSON.stringify(E);
    irTela('universo-holding');
  `);
  const resumo=JSON.parse(run('JSON.stringify(holdingConsolidar(E.holdingImoveis,E.aviao))'));
  assert.equal(resumo.pagoAquisicoes,44000);
  assert.equal(resumo.imoveis.saldo,90000);
  assert.equal(resumo.imoveis.comValor,1);
  assert.equal(resumo.despesas.investimento.pago,3400);
  assert.equal(resumo.despesas.condominio.aberto,2800);
  assert.equal(resumo.despesas.impostos.pago,1900);
  assert.match(document.querySelector('.holding-composicao').textContent,/Impostos/);
  assert.match(document.querySelector('.holding-indicadores').textContent,/Valor informado em 1 de 2/);
  assert.equal(document.querySelectorAll('#main .holding-destino').length,2);
  assert.equal(run('JSON.stringify(E)===anterior'),true);
});

test('trocar a competência muda renda e faturamento, mantém o patrimônio atual e não grava na carteira', () => {
  const {run,document}=setup();
  run(`
    filtro.holdingCompetencia='2026-11';
    E.holdingImoveis=[{id:'un',nome:'Unidade de ensaio',totalCentavos:null,pagamentos:[]}];
    E.holdingFinanceiro={
      imoveis:[{imovelId:'un',valorAtualCentavos:3100000}],
      empresas:[{id:'emp',nome:'Empresa de ensaio',valorParticipacaoCentavos:500000,participacaoPct:20}],
      mensais:[
        {tipo:'imovel',origemId:'un',competencia:'2026-11',aluguelCentavos:14000},
        {tipo:'empresa',origemId:'emp',competencia:'2026-11',repasseCentavos:20000,faturamentoCentavos:90000},
        {tipo:'empresa',origemId:'emp',competencia:'2026-10',repasseCentavos:0,faturamentoCentavos:15000}
      ]
    };
    const baseDashboard=JSON.stringify(E);
    irTela('universo-holding');
  `);
  const cartoes=()=>[...document.querySelectorAll('.holding-kpi-dashboard strong')].map(el=>el.textContent.replace(/\s/g,''));
  assert.deepEqual(cartoes(),['R$36.000,00','R$340,00','R$900,00']);
  document.querySelector('.holding-kpi-dashboard:nth-child(2)').click();
  assert.equal(document.querySelector('.holding-origens-renda').open,true);
  const outubro=[...document.querySelectorAll('.holding-coluna')].find(b=>b.title.startsWith('out.'));
  outubro.click();
  assert.deepEqual(cartoes(),['R$36.000,00','R$0,00','R$150,00']);
  assert.match(document.querySelector('.holding-kpi-dashboard:nth-child(2)').textContent,/Parcial/);
  assert.equal(document.querySelector('.holding-mes-dashboard input').value,'2026-10');
  assert.equal(run('JSON.stringify(E)===baseDashboard'),true);
});
