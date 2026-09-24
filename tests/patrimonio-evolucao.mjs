import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const comBens = (lista) => {
  const s = setup();
  s.run('E.patrimonio=' + JSON.stringify(lista));
  return s;
};

test('avaliações: o valor atual entra no ano da SUA data, e a avaliação explícita vence', () => {
  const {run} = comBens([]);
  const por = x => run(`[...avaliacoesDoBem(${JSON.stringify(x)}).entries()].sort((a,b)=>a[0]-b[0])`);
  assert.deepEqual([...por({valor: 100, avaliadoEm: '2026-03-01'})].map(e => [...e]), [[2026, 100]]);
  // sem data não se chuta o ano: dizer que o valor é de 2026 inventaria valorização
  assert.deepEqual([...por({valor: 100})], []);
  // explícita manda
  assert.deepEqual([...por({valor: 100, avaliadoEm: '2026-03-01', avaliacoes: [{ano: 2026, valor: 130}]})].map(e => [...e]),
    [[2026, 130]]);
  // ano inválido não entra
  assert.deepEqual([...por({avaliacoes: [{ano: 12, valor: 5}, {ano: 2025, valor: 0}]})], []);
});

test('evolução: a valorização do conjunto ignora o bem que entrou no meio', () => {
  const {run} = comBens([
    {id: 'a', nome: 'Casa', avaliacoes: [{ano: 2025, valor: 1000}, {ano: 2026, valor: 1100}]},
    {id: 'b', nome: 'Lote', avaliacoes: [{ano: 2026, valor: 5000}]},   // comprado em 2026
  ]);
  const ev = run('evolucaoPatrimonio(E.patrimonio)');
  assert.deepEqual([...ev.anos], [2025, 2026]);
  assert.deepEqual([...ev.totais], [1000, 6100], 'o total soma tudo o que existe no ano');
  const v = ev.variacao[1];
  /* 6100 contra 1000 daria +510%, e seria mentira: o patrimônio cresceu por
     compra, não por preço. Só a Casa está nos dois anos. */
  assert.equal(v.comparaveis, 1);
  assert.equal(v.entraram, 1);
  assert.equal(Math.round(v.pct), 10, 'a valorização real é a da Casa: +10%');
});

test('evolução: a valorização de um bem usa o ano anterior EM QUE ELE TEM avaliação', () => {
  const {run} = comBens([{id: 'a', nome: 'Sítio', avaliacoes: [{ano: 2021, valor: 200}, {ano: 2026, valor: 300}]}]);
  const por = run("avaliacoesDoBem(E.patrimonio[0])");
  const v = run("variacaoBem(avaliacoesDoBem(E.patrimonio[0]),2026)");
  assert.equal(v.deAno, 2021, 'pula os anos sem avaliação em vez de fingir que não houve');
  assert.equal(Math.round(v.pct), 50);
  assert.equal(run("variacaoBem(avaliacoesDoBem(E.patrimonio[0]),2021)"), null, 'a primeira não tem com o que comparar');
});

test('evolução: bem sem nenhuma avaliação com ano fica fora da tabela', () => {
  const {run} = comBens([
    {id: 'a', nome: 'Com ano', avaliacoes: [{ano: 2026, valor: 10}]},
    {id: 'b', nome: 'Sem ano', valor: 999},
  ]);
  const ev = run('evolucaoPatrimonio(E.patrimonio)');
  assert.deepEqual([...ev.linhas].map(l => l.bem.nome), ['Com ano']);
});

test('tela: o quadro da evolução aparece com a valorização e o aviso do que entrou', () => {
  const {run, document} = comBens([
    {id: 'a', nome: 'Casa', tipo: 'Imóvel', valor: 1100, avaliacoes: [{ano: 2025, valor: 1000}, {ano: 2026, valor: 1100}]},
    {id: 'b', nome: 'Lote', tipo: 'Imóvel', valor: 5000, avaliacoes: [{ano: 2026, valor: 5000}]},
  ]);
  run("atual='patrimonio';const m=document.getElementById('main');m.replaceChildren();vPatrimonio(m)");
  const bloco = document.querySelector('[data-bid="pt-evol"]');
  assert.ok(bloco, 'o quadro tem de existir');
  const txt = bloco.textContent;
  assert.match(txt, /2025/);
  assert.match(txt, /2026/);
  assert.match(txt, /\+10[.,]0%/, 'a valorização real do conjunto');
  assert.match(txt, /1 bem\(ns\) entrou\(aram\) neste ano/, 'o que entrou tem de ser dito');
  assert.match(txt, /Salvar patrimônio em PDF/);
});
