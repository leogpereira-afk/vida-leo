/* colunasDoDetalhe monta o UPDATE de uma atividade a partir do detalhe que o
   Strava devolve. A regra da casa é: só grava o que veio — campo ausente não
   pode apagar o que já está no banco. Este teste existe porque best_efforts já
   foi a exceção, e apagar recorde é o erro mais caro deste app: some sem erro
   nenhum e ninguém desconfia por meses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const fonte = stripTypeScriptTypes(
  readFileSync(new URL('../supabase/functions/leo-sync/strava.ts', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '')
    .replace(/^export /gm, ''),
);
const M = vm.runInNewContext(
  fonte + '\n;({colunasDoDetalhe, esforcosDe, linhaDaAtividade})',
  {Deno: {env: {get: () => 'x'}}, Date, Math, JSON, Number, String, Array, Object, URL,
   URLSearchParams, Response, fetch: () => {}, AbortSignal, console},
  {filename: 'strava.ts'},
);

test('Detalhe: corrida sem best_efforts não apaga o recorde guardado', () => {
  const out = M.colunasDoDetalhe({calories: 300}, 'Run');
  assert.ok(!('best_efforts' in out), 'best_efforts entrou no UPDATE e apagaria o que já existe');
  assert.equal(out.calorias, 300);
  assert.equal(out.perf_lido, true);
});

test('Detalhe: corrida COM best_efforts grava o que veio', () => {
  const out = M.colunasDoDetalhe({best_efforts: [{name: '1K', elapsed_time: 308}]}, 'Run');
  assert.equal(out.best_efforts.length, 1);
  assert.equal(out.best_efforts[0].tipo, 'Fastest1k', 'a grafia do Strava tem que ser canonizada');
  assert.equal(out.best_efforts[0].seg, 308);
});

test('Detalhe: lista vazia é resposta e vale (corrida curta demais)', () => {
  const out = M.colunasDoDetalhe({best_efforts: []}, 'Run');
  assert.ok(Array.isArray(out.best_efforts) && out.best_efforts.length === 0);
});

test('Detalhe: nenhum campo ausente entra no UPDATE', () => {
  // musculação sem nada: só o carimbo de "já li este detalhe"
  const out = M.colunasDoDetalhe({}, 'WeightTraining');
  assert.deepEqual(Object.keys(out).sort(), ['atualizado_em', 'perf_lido']);
});

test('Detalhe: campo com valor entra, campo nulo não', () => {
  const out = M.colunasDoDetalhe({calories: 0, average_heartrate: null, max_speed: 4.4}, 'Ride');
  assert.equal(out.calorias, 0, 'zero é valor, não ausência');
  assert.ok(!('fc_media' in out));
  assert.equal(out.vel_max, 4.4);
});
