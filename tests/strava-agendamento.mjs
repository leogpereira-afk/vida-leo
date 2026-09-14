/* A tarefa agendada do Strava é feita de números que PRECISAM combinar entre si
   e que moram em arquivos diferentes — o prazo da rodada em strava.ts, a hora de
   disparar na migração. Combinam hoje; o risco é alguém mexer num sem o outro,
   e o estrago ser invisível (duas rodadas vivas gastando o orçamento em dobro,
   ou metade das rodadas batendo numa janela já cheia). Estes testes não abrem
   rede nem banco: só conferem que os números continuam coerentes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const strava = readFileSync(new URL('../supabase/functions/leo-sync/strava.ts', import.meta.url), 'utf8');
const migracao = readFileSync(new URL('../supabase/migrations/0005_strava_cron.sql', import.meta.url), 'utf8');

const num = (nome) => {
  const m = strava.match(new RegExp('const ' + nome + '\\s*=\\s*([0-9_]+)'));
  assert.ok(m, 'não achei a constante ' + nome + ' em strava.ts');
  return Number(m[1].replace(/_/g, ''));
};

test('Agendamento: a trava sobrevive à rodada mais longa', () => {
  const trava = num('TRAVA_MIN') * 60_000;
  const prazo = num('PRAZO_CRON_MS');
  /* Uma chamada ainda pode custar até 20 s (AbortSignal) mais os 3 s de espera
     entre tentativas, e depois disso a rodada ainda grava. Trava mais velha que
     TRAVA_MIN é ROUBADA por quem chegar depois: se a conta não fechar, duas
     rodadas vivas semeiam o mesmo contador e gastam o orçamento em dobro. */
  assert.ok(trava > prazo + 25_000, `TRAVA_MIN (${trava} ms) precisa passar de ${prazo + 25_000} ms`);
});

test('Agendamento: a rodada cabe no tempo que a função tem', () => {
  // o teto de ociosidade de uma Edge Function é 150 s; estourar mata o isolate
  // ANTES do `finally` que destrava, e a trava fica presa
  assert.ok(num('PRAZO_CRON_MS') + 25_000 < 150_000);
});

test('Agendamento: uma rodada por janela de 15 minutos do Strava', () => {
  const m = migracao.match(/cron\.schedule\('leo-strava-detalhes',\s*'([^']+)'/);
  assert.ok(m, 'não achei o agendamento na migração');
  const minutos = m[1].split(' ')[0].split(',').map(Number);
  assert.ok(minutos.length > 0 && minutos.every((x) => Number.isInteger(x) && x >= 0 && x < 60));
  // a janela do Strava vira em :00 :15 :30 :45 — duas rodadas na mesma janela
  // fazem a segunda bater em orçamento cheio e gravar uma pausa à toa
  const janelas = new Set(minutos.map((x) => Math.floor(x / 15)));
  assert.equal(janelas.size, minutos.length, 'duas rodadas caem na mesma janela de 15 min');
  // e nunca em cima da virada, onde mora a corrida do contador
  assert.ok(minutos.every((x) => x % 15 >= 1 && x % 15 <= 13), 'rodada colada na virada da janela');
});

test('Agendamento: o pedido espera a rodada inteira', () => {
  const m = migracao.match(/timeout_milliseconds\s*:=\s*([0-9]+)/);
  assert.ok(m, 'o net.http_post precisa de timeout_milliseconds');
  assert.ok(Number(m[1]) > num('PRAZO_CRON_MS'), 'o pedido desiste antes de a rodada terminar');
});

test('Agendamento: a migração não carrega segredo escrito nem `forcar`', () => {
  // o repositório é PÚBLICO: o segredo nasce dentro do banco (gen_random_bytes)
  assert.match(migracao, /gen_random_bytes/);
  assert.ok(!/\b[0-9a-f]{32,}\b/i.test(migracao), 'parece haver um segredo escrito na migração');
  // `forcar` releria o ano inteiro toda rodada e queimaria o orçamento da fila
  assert.ok(!/forcar/.test(migracao));
});

test('Agendamento: a fila de detalhes não exclui ninguém para sempre', () => {
  /* Havia um CHÃO PERMANENTE: linha com perf_lido=false, calorias já
     preenchidas pela carga inicial e que não fosse corrida ≥ 1 km nunca era
     lida nem marcada. O contador jamais chegava a zero — e o portão da tarefa
     agendada ("ainda falta alguém?") dispararia para sempre, sem nada a fazer. */
  const trecho = strava.slice(strava.indexOf('perf_lido", false'), strava.indexOf('for (const p of fila)'));
  assert.ok(!trecho.includes('.filter('), 'a fila de detalhes voltou a filtrar: alguém pode ficar de fora para sempre');
  assert.ok(trecho.includes('.sort('), 'a fila precisa continuar ordenada por interesse');
});

test('Agendamento: a etapa dos detalhes deixa fichas para a dos tênis', () => {
  assert.ok(num('FOLGA_GEAR') > 0);
  assert.match(strava, /temOrcamento\(s\.o,\s*FOLGA_GEAR\)/);
});
