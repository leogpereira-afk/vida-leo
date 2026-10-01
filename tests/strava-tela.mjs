import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

test('Strava abre pelo menu em uma página única, sem botão flutuante', async () => {
  const {run,document}=setup();
  run(`stravaCache={
    atividades:[{id:'123',nome:'Corrida curta',tipo:'Run',inicioLocal:hoje()+'T07:00:00',distanciaM:5000,movingTime:1500,calorias:300}],
    gear:[],atualizadoEm:new Date().toISOString(),em:Date.now()
  };atual='strava';menu();tela()`);
  await Promise.resolve();

  assert.equal(document.querySelector('.stv-hero h1')?.textContent,'Strava');
  assert.equal(document.querySelectorAll('.stv-abas button').length,5);
  assert.deepEqual([...document.querySelectorAll('.stv-corpo > .bloco, .stv-corpo > .stv-resumo-destaque, .stv-corpo > .stv-resumo-apoio')]
    .map(x=>x.getAttribute('data-bid')||x.className),['stv-kpis','stv-resumo-destaque','stv-recentes','stv-resumo-apoio','stv-dicas']);
  assert.equal(document.querySelector('.stv-ultimo .stv-titulo')?.textContent.includes('Corrida curta'),true);
  assert.equal(document.getElementById('stravaBtn'),null);
  assert.equal(document.getElementById('stravaGaveta'),null);
  assert.equal(document.querySelector('.nav button.on')?.textContent.includes('Strava'),true);
  assert.equal(document.querySelector('.aviso[role="alert"]'),null);
});

test('comparação do mês usa os mesmos dias e não o mês anterior inteiro', async () => {
  const {run,document,ctx}=setup();
  const data='2026-10-01T12:00:00-03:00';
  class Clock extends Date {
    constructor(...args){super(...(args.length?args:[data]))}
    static now(){return new Date(data).getTime()}
  }
  ctx.Date=Clock;
  run(`stravaCache={atividades:[
    {id:'1',tipo:'Run',inicioLocal:'2026-10-01T07:00:00',distanciaM:5000,movingTime:1500},
    {id:'2',tipo:'Run',inicioLocal:'2026-09-20T07:00:00',distanciaM:90000,movingTime:20000},
    {id:'3',tipo:'Run',inicioLocal:'2026-09-01T07:00:00',distanciaM:10000,movingTime:3000}
  ],gear:[],em:Date.now()};atual='strava';tela()`);
  await Promise.resolve();

  const mes=document.querySelector('[data-bid="stv-kpis"] .kpi:nth-child(2)');
  assert.match(mes?.textContent||'',/-50% em km vs set até dia 1/);
  assert.equal(document.querySelector('.aviso[role="alert"]'),null);
});
