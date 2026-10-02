import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function app(){
  const a=setup();
  a.run(`E.rendHist={anos:[2024,2025,2026],totalAno:[600,900,0],empresas:{Fortemais:[400,600,0],Impresilk:[200,300,0]},parciais:[2026]};
    E.rendimentos=[
      {id:'jan',data:'2026-01-15',empresa:'Fortemais',instituicao:'Banco A',valor:100},
      {id:'fev',data:'2026-02-20',empresa:'Fortemais',instituicao:'Banco A',valor:50},
      {id:'outra',data:'2026-02-21',empresa:'Impresilk',instituicao:'Banco B',valor:20},
      {id:'sem-data',data:'2026-12-31',empresa:'Fortemais',tipo:'Lucro',valor:500,obs:'lançado em 31/12 — sem data real'}
    ];filtro.rendAno=2026;filtro.rendEmp='Todas';`);
  return a;
}
function dados(run,ano=2026,empresa='Todas',todos=false){
  return JSON.parse(run(`JSON.stringify(dadosGraficosRendimento(histVivo(),E.rendimentos,${ano},${JSON.stringify(empresa)},${todos}))`));
}
function render(a){
  a.run("var pagina=document.createElement('div');pagina.className='pagina';document.body.appendChild(pagina);vRendimentos(pagina);organizarFinanceiro(pagina,'rendimentos')");
  return a.document.querySelector('.pagina');
}

test('gráficos usam o histórico anual e só lançamentos com data real no mês',()=>{
  const {run}=app();
  const antes=run('JSON.stringify(E.rendimentos)');
  const d=dados(run);
  assert.deepEqual(d.anos.map(x=>x.valor),[600,900,670]);
  assert.equal(d.total,670);
  assert.deepEqual(d.meses.map(x=>x.valor),[100,70]);
  assert.equal(d.somaMensal,170);
  assert.equal(d.valorSemMes,500);
  assert.equal(d.semMes.length,1);
  assert.equal(d.anos.at(-1).parcial,true);
  assert.equal(run('JSON.stringify(E.rendimentos)'),antes);
});

test('filtro de empresa e todos os anos preservam a origem não detalhada',()=>{
  const {run}=app();
  const ano=dados(run,2026,'Fortemais');
  assert.equal(ano.total,650);
  assert.deepEqual(ano.meses.map(x=>x.valor),[100,50]);
  assert.deepEqual(ano.fontes.map(x=>x.nome),['Lucro','Banco A']);
  const historico=dados(run,2026,'Fortemais',true);
  assert.equal(historico.total,1650);
  assert.equal(historico.fontes.find(x=>x.nome==='Sem origem detalhada').valor,1000);
  assert.equal(historico.fontes.find(x=>x.nome==='Banco A').valor,150);
});

test('aba Gráficos mostra quatro análises, filtros e tabela acessível',()=>{
  const a=app(),pagina=render(a);
  const botoes=[...pagina.querySelectorAll('.finance-tabs button')];
  assert.deepEqual(botoes.map(x=>x.textContent),['Resumo','Gráficos','Lançamentos','Histórico']);
  assert.equal(pagina.querySelector('.rd-visual').closest('.finance-pane').id,'finance-graficos');
  botoes[1].onclick();
  assert.equal(pagina.querySelector('#finance-graficos').hidden,false);
  assert.equal(pagina.querySelector('#finance-resumo').hidden,true);
  assert.equal(pagina.querySelectorAll('.rd-chart-card').length,4);
  assert.match(pagina.querySelector('.rd-visual').textContent,/500,00/);
  assert.ok(pagina.querySelectorAll('.rd-chart-data table').length>=4);
  assert.ok(pagina.querySelectorAll('.rd-column[data-rd-ano][aria-label]').length>=3);
  assert.equal(pagina.querySelector('.rd-chart-grid').firstElementChild.classList.contains('rd-chart-trend'),true);
  assert.ok(pagina.querySelector('.rd-chart-trend [data-rd-serie=atual] .rd-dual-line'));
  assert.equal(pagina.querySelector('.rd-chart-trend [data-rd-serie=anterior]'),null);
  assert.match(pagina.querySelector('.rd-chart-trend .rd-chart-foot').textContent,/linha cinza não é desenhada/);
  assert.doesNotMatch(pagina.querySelector('.rd-chart-trend .rd-chart-legend').textContent,/Ano parcial/);
});

test('duas linhas comparam o ano escolhido ao anterior sem transformar 31/12 artificial em dezembro',()=>{
  const a=app();
  a.run(`E.rendimentos.push(
    {id:'prev-jan',data:'2025-01-10',empresa:'Fortemais',valor:20},
    {id:'prev-mar',data:'2025-03-10',empresa:'Fortemais',valor:30},
    {id:'prev-artificial',data:'2025-12-31',empresa:'Fortemais',valor:900,obs:'lançado em 31/12 — sem data real'})`);
  const anterior=JSON.parse(a.run("JSON.stringify(mesesComparaveisRendimento(E.rendimentos,2025,'Fortemais'))"));
  assert.equal(anterior.primeiro,0);
  assert.equal(anterior.ultimo,2);
  assert.equal(anterior.meses[1].valor,0);
  assert.equal(anterior.semData,1);
  const pagina=render(a);
  assert.equal(pagina.querySelectorAll('.rd-chart-trend [data-rd-serie] .rd-dual-line').length,2);
  assert.match(pagina.querySelector('.rd-chart-trend .rd-chart-legend').textContent,/2025.*2026/);
  assert.match(pagina.querySelector('.rd-chart-trend .rd-chart-data').textContent,/R\$\s20,00/);
  assert.doesNotMatch(pagina.querySelector('.rd-chart-trend .rd-chart-data').textContent,/R\$\s900,00/);
  assert.equal(a.run('E.rendimentos.length'),7);
});

test('comparação respeita a empresa e omite ano anterior sem meses em comum',()=>{
  const a=app();
  a.run("E.rendimentos.push({id:'prev-outra',data:'2025-01-10',empresa:'Impresilk',valor:999});filtro.rendEmp='Fortemais'");
  const pagina=render(a);
  assert.equal(pagina.querySelector('.rd-chart-trend [data-rd-serie=anterior]'),null);
  assert.match(pagina.querySelector('.rd-chart-trend .rd-chart-foot').textContent,/Não há meses com datas confiáveis nos dois anos/);
});

test('selecionar uma barra anual abre o ano e mantém a aba de gráficos',()=>{
  const a=app(),pagina=render(a);
  pagina.querySelector('[data-aba=graficos]').onclick();
  a.run("atual='rendimentos';tela=()=>{pagina.replaceChildren();vRendimentos(pagina);organizarFinanceiro(pagina,'rendimentos')}");
  pagina.querySelector('[data-rd-ano="2024"]').onclick();
  assert.equal(a.run('filtro.rendAno'),2024);
  assert.equal(pagina.querySelector('[data-aba=graficos]').getAttribute('aria-pressed'),'true');
  assert.match(pagina.querySelector('.rd-visual').textContent,/2024/);
});

test('histórico sem datas não inventa tendência mensal; todos os anos mantém apenas leituras anuais',()=>{
  const a=app();a.run('E.rendimentos=[];filtro.rendAno=2024');
  const pagina=render(a);
  assert.equal(pagina.querySelectorAll('.rd-chart-card').length,2);
  assert.match(pagina.querySelector('.rd-visual-note').textContent,/Não há lançamentos com mês confiável/);
  a.run("filtro.rendAno='todos';pagina.replaceChildren();vRendimentos(pagina);organizarFinanceiro(pagina,'rendimentos')");
  assert.equal(pagina.querySelectorAll('.rd-chart-card').length,2);
  assert.match(pagina.querySelector('.rd-visual-note').textContent,/Selecione um ano/);
});

test('estorno e total zerado não geram percentuais ou eixos inválidos',()=>{
  const a=app();a.run("E.rendHist={anos:[],totalAno:[],empresas:{}};E.rendimentos=[{id:'mais',data:'2026-01-10',empresa:'Teste',valor:100},{id:'menos',data:'2026-02-10',empresa:'Teste',valor:-100}];filtro.rendAno=2026");
  const pagina=render(a);
  assert.equal(dados(a.run).total,0);
  assert.doesNotMatch(pagina.querySelector('.rd-visual').outerHTML,/NaN|Infinity|undefined/);
});

test('navegação dos gastos continua com suas três abas',()=>{
  const {run,document}=app();
  run("var pagina=document.createElement('div');pagina.className='pagina';document.body.appendChild(pagina);organizarFinanceiro(pagina,'gastos')");
  assert.deepEqual([...document.querySelectorAll('.finance-tabs button')].map(x=>x.textContent),['Resumo','Lançamentos','Recorrentes']);
});

test('sem dados, a aba de gráficos explica como começar',()=>{
  const a=app();a.run('E.rendHist={anos:[],totalAno:[],empresas:{}};E.rendimentos=[]');
  const pagina=render(a);
  pagina.querySelector('[data-aba=graficos]').onclick();
  assert.equal(pagina.querySelector('#finance-graficos').hidden,false);
  assert.match(pagina.querySelector('#finance-graficos').textContent,/Sincronize seus dados ou cadastre/);
});
