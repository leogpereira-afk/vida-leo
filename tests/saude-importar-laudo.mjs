import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

/* IMPORTAR LAUDO. O dono manda um check-up com 40 marcadores; digitar um por
 * um não acontece, e o que não acontece não vira histórico. A regra que estes
 * testes guardam é a da casa: nada entra sem o clique dele, o que já existe
 * vem DESMARCADO (não escondido) e o que não foi entendido é DITO. */
const app = (estado = '') => {
  const s = setup();
  s.run("E.exames=[];" + estado);
  return s;
};

test('laudo: lê a lista e devolve os campos que a Saúde usa', () => {
  const {run} = app();
  const r = run(`lerLaudoImportado(${JSON.stringify(JSON.stringify([
    {data: '2026-09-02', exame: 'LDL', valor: 94, unidade: 'mg/dL', medico: 'Laboratório'},
  ]))})`);
  assert.equal(r.bons.length, 1);
  assert.equal(r.bons[0].exame, 'LDL');
  assert.equal(r.bons[0].valor, '94');
  assert.equal(r.bons[0].unidade, 'mg/dL');
  assert.equal(r.bons[0].data, '2026-09-02');
});

test('laudo: o que não foi entendido é dito, não descartado em silêncio', () => {
  const {run} = app();
  const r = run(`lerLaudoImportado(${JSON.stringify(JSON.stringify([
    {data: '2026-09-02', exame: 'HDL', valor: 37},
    {data: '2026-09-02', exame: '', valor: 1},        // sem nome
    {data: 'ontem', exame: 'TSH', valor: 1.79},       // data que não é data
  ]))})`);
  assert.equal(r.bons.length, 1, 'só o bom entra');
  assert.equal(r.descartados.length, 2, 'os dois ruins têm de ser contados');
  assert.ok(r.descartados.some(m => /TSH/.test(m)), 'e dizer qual foi');
});

test('laudo: arquivo que não é lista não derruba a tela', () => {
  const {run} = app();
  assert.match(run("lerLaudoImportado('isso não é json').erro"), /não consegui ler|JSON/i);
  assert.match(run("lerLaudoImportado('{\"a\":1}').erro"), /lista de exames/i);
});

test('laudo: exame já registrado na mesma data é reconhecido', () => {
  const {run} = app("E.exames=[{id:'x',data:'2026-09-02',exame:'LDL',valor:'94'}];");
  assert.equal(run("jaTemExame({data:'2026-09-02',exame:'LDL'})"), true);
  assert.equal(run("jaTemExame({data:'2026-09-02',exame:'ldl'})"), true, 'grafia não separa o mesmo exame');
  assert.equal(run("jaTemExame({data:'2026-03-01',exame:'LDL'})"), false, 'outra data é outro registro');
  assert.equal(run("jaTemExame({data:'2026-09-02',exame:'HDL'})"), false);
});

test('laudo: a janela mostra a prévia e deixa o repetido desmarcado', () => {
  const {run, document} = app("E.exames=[{id:'x',data:'2026-09-02',exame:'LDL',valor:'94'}];");
  run("importarExamesRotina()");
  const area = document.querySelector('.fundo .modal textarea');
  area.value = JSON.stringify([
    {data: '2026-09-02', exame: 'LDL', valor: 94, unidade: 'mg/dL'},
    {data: '2026-09-02', exame: 'HDL', valor: 37, unidade: 'mg/dL'},
  ]);
  [...document.querySelectorAll('.fundo .modal button')].find(b => /Conferir/.test(b.textContent)).onclick();
  const caixas = [...document.querySelectorAll('.fundo .modal tbody input')];
  assert.equal(caixas.length, 2);
  assert.equal(caixas[0].checked, false, 'o já registrado vem desmarcado');
  assert.equal(caixas[1].checked, true, 'o novo vem marcado');
  // e continua na tela: esconder viraria "sumiu"
  assert.match(document.querySelector('.fundo .modal tbody').textContent, /já registrado nesta data/);
  const ok = [...document.querySelectorAll('.fundo .modal button')].find(b => /^Adicionar/.test(b.textContent));
  assert.match(ok.textContent, /Adicionar 1 exame/, 'o botão diz quantos vão entrar');
  ok.onclick();
  const nomes = [...run("E.exames.map(x=>x.exame)")];
  assert.deepEqual(nomes.sort(), ['HDL', 'LDL'], 'só o marcado entrou; o antigo ficou');
});

test('laudo: nada é gravado antes do clique', () => {
  const {run, document} = app();
  run("importarExamesRotina()");
  const area = document.querySelector('.fundo .modal textarea');
  area.value = JSON.stringify([{data: '2026-09-02', exame: 'Ferritina', valor: 105}]);
  [...document.querySelectorAll('.fundo .modal button')].find(b => /Conferir/.test(b.textContent)).onclick();
  assert.equal(run("E.exames.length"), 0, 'conferir não grava');
});

/* A TELA NÃO PODE PINTAR DE VERDE O QUE ESTÁ FORA DA FAIXA QUE ELA MESMA
 * IMPRIME. A regra da testosterona só olhava o piso, então um valor bem acima
 * do topo de 950 que aparece ao lado saía como "No alvo". Este repositório é
 * público: nenhum resultado de exame real entra aqui, nem em comentário. */
test('marcadores: nenhum valor fora da faixa impressa sai como "No alvo"', () => {
  const {run} = setup();
  const marcs = [...run("MARCADORES.map(m=>[m[0],m[1],m[2]])")];
  const forte = [];
  for (const [nome, unidade, faixa] of marcs) {
    const m = String(faixa).match(/^([\d,]+)\s*a\s*([\d,]+)$/);
    if (!m) continue;                       // faixas "< x" e "> x" têm um lado só
    const teto = Number(m[2].replace(',', '.'));
    const piso = Number(m[1].replace(',', '.'));
    forte.push(nome);
    const acima = run(`semaforo(${JSON.stringify({exame: nome, unidade, valor: String(teto * 3), data: '2026-09-02'})})`);
    assert.notEqual(acima, 'ok', `${nome}: ${teto * 3} está acima da faixa ${faixa} e saiu como "No alvo"`);
    const abaixo = run(`semaforo(${JSON.stringify({exame: nome, unidade, valor: String(piso / 3), data: '2026-09-02'})})`);
    assert.notEqual(abaixo, 'ok', `${nome}: ${piso / 3} está abaixo da faixa ${faixa} e saiu como "No alvo"`);
  }
  assert.ok(forte.length >= 5, 'a varredura não achou as faixas de dois lados');
});
