import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

/* Dois laboratórios escrevem a MESMA unidade de dois jeitos. Comparar o texto
 * cru fazia a Central tratar como grandezas diferentes: sumia a faixa e a
 * evolução virava "sem comparação numérica" — justamente no segundo laudo,
 * que é quando a evolução finalmente existe. */
test('unidade: o mesmo é o mesmo, escrito de qualquer jeito', () => {
  const {run} = setup();
  const igual = (a, b) => run(`mesmaUnidade(${JSON.stringify(a)},${JSON.stringify(b)})`);
  assert.ok(igual('g%', 'g/dL'), 'hemoglobina');
  assert.ok(igual('milh/mm3', 'milhões/mm³'), 'hemácias');
  assert.ok(igual('/mm3', '/mm³'), 'leucócitos');
  assert.ok(igual('mcg/dL', 'µg/dL'), 'ferro');
  assert.ok(igual('µU/mL', 'µUI/mL'), 'insulina');
  assert.ok(igual('mg/dL', 'MG/DL '), 'caixa e espaço não separam');
});

/* O CASO RUIM PRIMEIRO: o que NÃO é igual tem de continuar diferente.
 * Chutar equivalência em exame de sangue é pior do que não comparar. */
test('unidade: o que é diferente continua diferente', () => {
  const {run} = setup();
  const igual = (a, b) => run(`mesmaUnidade(${JSON.stringify(a)},${JSON.stringify(b)})`);
  assert.ok(!igual('mg/dL', 'mg/L'), 'dez vezes de diferença');
  assert.ok(!igual('ng/mL', 'pg/mL'), 'mil vezes de diferença');
  assert.ok(!igual('U/L', 'ug/L'));
  assert.ok(!igual('%', 'mg/dL'));
});

test('evolução: laudos de laboratórios diferentes passam a se comparar', () => {
  const {run} = setup();
  run(`E.exames=[
    {id:'1',data:'2026-09-02',exame:'Hemoglobina',valor:'15,0',unidade:'g%'},
    {id:'2',data:'2026-09-12',exame:'Hemoglobina',valor:'15,6',unidade:'g/dL'}
  ]`);
  const txt = run("textoEvolucaoExame(gruposExames()[0])");
  assert.match(txt, /subiu 4%/, 'antes dizia "sem comparação numérica"');
});

test('referência: a faixa continua valendo com a unidade escrita de outro jeito', () => {
  const {run} = setup();
  // a tabela guarda 'g%'; o laudo novo traz 'g/dL'
  assert.ok(run("referenciaExtra({exame:'Hemoglobina',valor:'15,6',unidade:'g/dL'})"), 'a faixa tem de ser encontrada');
  assert.equal(run("semaforo({exame:'Hemoglobina',valor:'19,0',unidade:'g/dL',data:'2026-09-12'})"), 'ruim', 'acima de 18,0');
  assert.equal(run("semaforo({exame:'Hemoglobina',valor:'15',unidade:'g/dL',data:'2026-09-12'})"), 'ok');
});
