import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

/* O ponto de milhar não é vírgula: "5.820" leucócitos virava 5,82 e "201.000"
 * plaquetas virava 201 — comparados a qualquer faixa, seriam alarme falso. */
test('número: ponto de milhar não vira decimal, e decimal continua decimal', () => {
  const {run} = setup();
  const n = v => run(`numeroResultadoSaude(${JSON.stringify(v)})`);
  assert.equal(n('5.820'), 5820, 'leucócitos');
  assert.equal(n('201.000'), 201000, 'plaquetas');
  assert.equal(n('1.480.000'), 1480000);
  assert.equal(n('1.48'), 1.48, 'creatinina continua decimal');
  assert.equal(n('94.0'), 94, 'duas casas não são milhar');
  assert.equal(n('15,1'), 15.1);
  assert.equal(n('1234'), 1234, 'quatro dígitos sem ponto ficam como estão');
  assert.ok(Number.isNaN(n('positivo')));
});

/* A régua tem de ser a do laudo, e a origem vai junto. Faixa de internet
 * diverge entre si e às vezes mede outra coisa com o mesmo nome. */
test('referências: a faixa só vale quando a unidade bate', () => {
  const {run} = setup();
  assert.ok(run("referenciaExtra({exame:'Ureia',valor:'41',unidade:'mg/dL'})"), 'mesma unidade, vale');
  assert.equal(run("referenciaExtra({exame:'Ureia',valor:'41',unidade:'mmol/L'})"), null, 'outra unidade não compara');
  assert.equal(run("referenciaExtra({exame:'Exame que não existe',valor:'1',unidade:''})"), null);
});

test('referências: o semáforo passa a enxergar os exames fora do painel', () => {
  const {run} = setup();
  const s = (exame, valor, unidade) => run(`semaforo(${JSON.stringify({exame, valor, unidade, data: '2026-09-02'})})`);
  assert.equal(s('Ureia', '41,0', 'mg/dL'), 'ruim', 'acima de 40');
  assert.equal(s('Ureia', '30', 'mg/dL'), 'ok');
  assert.equal(s('Leucócitos', '5.820', '/mm3'), 'ok', 'o milhar tem de ser lido certo');
  assert.equal(s('Plaquetas', '201.000', '/mm3'), 'ok');
  assert.equal(s('Potássio', '3,5', 'mg/dL'), 'ruim', 'abaixo de 3,6');
  assert.equal(s('Colesterol total', '149', 'mg/dL'), 'ok');
  assert.equal(s('Colesterol total', '210', 'mg/dL'), 'atencao', 'faixa limite');
  assert.equal(s('Colesterol total', '250', 'mg/dL'), 'ruim');
});

/* Melhor não afirmar do que afirmar errado: os três que o próprio laudo se
 * recusa a enquadrar mostram a explicação e NÃO ganham cor. */
test('referências: o que não tem régua não é pintado', () => {
  const {run} = setup();
  for (const nome of ['PSA livre', 'PSA livre / total', 'Testosterona livre (calculada)']) {
    const r = run(`referenciaExtra({exame:${JSON.stringify(nome)},valor:'1',unidade:''})`);
    assert.ok(r, nome + ' precisa ter texto de referência');
    assert.equal(r[3], null, nome + ' não pode ter regra de cor');
    assert.equal(run(`semaforo({exame:${JSON.stringify(nome)},valor:'1',data:'2026-09-02'})`), '', nome + ' saiu pintado');
  }
});

test('referências: a origem da régua aparece quando não é a do laudo', () => {
  const fonte = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  const tabela = fonte.match(/const REFERENCIAS_EXTRA = \[[\s\S]*?\n\];/)[0];
  const linhas = [...tabela.matchAll(/^\s*\['/gm)];
  assert.ok(linhas.length >= 30, 'a tabela encolheu: ' + linhas.length);
  // toda linha declara de onde veio a régua
  const semFonte = [...tabela.matchAll(/\['([^']+)'[^\n]*\],\s*$/gm)]
    .filter(m => !/'(laudo|geral)'\]/.test(m[0]));
  assert.equal(semFonte.length, 0, 'sem origem: ' + semFonte.map(m => m[1]).join(', '));
  assert.match(fonte, /referência geral/, 'a régua que não é do laudo tem de se declarar na tela');
});
