import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

/* O PDF dos exames. O que estes testes guardam é o que o médico precisa ler na
 * folha: o rumo em PALAVRA (cor some na fotocópia), a ordem por urgência, e a
 * mesma conta da tela — nunca uma segunda. */
const comExames = (lista) => {
  const s = setup();
  s.run('E.exames=' + JSON.stringify(lista));
  return s;
};

test('PDF: a evolução vai em palavra, dizendo se aproximou ou afastou do alvo', () => {
  const {run} = comExames([
    {id: '1', data: '2026-03-01', exame: 'LDL', valor: '160', unidade: 'mg/dL'},
    {id: '2', data: '2026-09-02', exame: 'LDL', valor: '94', unidade: 'mg/dL'},
  ]);
  const g = run("gruposExames().find(x=>x.nome==='LDL')");
  const txt = run("textoEvolucaoExame(gruposExames().find(x=>x.nome==='LDL'))");
  assert.match(txt, /caiu 41%/, 'o quanto');
  assert.match(txt, /aproximou do alvo/, 'e o rumo, em palavra');
  assert.equal(g.sem, 'ok');
});

test('PDF: subir não é sempre melhorar — o rumo olha o alvo, não o sinal', () => {
  const {run} = comExames([
    {id: '1', data: '2026-03-01', exame: 'HDL', valor: '30', unidade: 'mg/dL'},
    {id: '2', data: '2026-09-02', exame: 'HDL', valor: '45', unidade: 'mg/dL'},
    {id: '3', data: '2026-03-01', exame: 'Glicemia jejum', valor: '80', unidade: 'mg/dL'},
    {id: '4', data: '2026-09-02', exame: 'Glicemia jejum', valor: '110', unidade: 'mg/dL'},
  ]);
  const t = n => run(`textoEvolucaoExame(gruposExames().find(x=>x.nome===${JSON.stringify(n)}))`);
  assert.match(t('HDL'), /subiu .*aproximou do alvo/, 'HDL subindo é melhora');
  assert.match(t('Glicemia jejum'), /subiu .*afastou do alvo/, 'glicemia subindo é piora');
});

test('PDF: uma medição só não inventa tendência', () => {
  const {run} = comExames([{id: '1', data: '2026-09-02', exame: 'Ferritina', valor: '105', unidade: 'ng/mL'}]);
  assert.equal(run("textoEvolucaoExame(gruposExames()[0])"), '1ª medição');
});

test('PDF: unidade diferente não gera variação inventada', () => {
  const {run} = comExames([
    {id: '1', data: '2026-03-01', exame: 'Zinco', valor: '92', unidade: 'µg/dL'},
    {id: '2', data: '2026-09-02', exame: 'Zinco', valor: '9,2', unidade: 'mg/L'},
  ]);
  assert.match(run("textoEvolucaoExame(gruposExames()[0])"), /sem comparação numérica/);
});

test('PDF: a ordem é a da urgência, igual à da tela', () => {
  const {run} = comExames([
    {id: '1', data: '2026-09-02', exame: 'Ferritina', valor: '105', unidade: 'ng/mL'},     // ok
    {id: '2', data: '2026-09-02', exame: 'Creatinina', valor: '1,48', unidade: 'mg/dL'},   // ruim
    {id: '3', data: '2026-09-02', exame: 'Vitamina D', valor: '38', unidade: 'ng/mL'},     // atencao
    {id: '4', data: '2026-09-02', exame: 'Coisa sem régua', valor: '7', unidade: 'xx'},    // sem faixa
  ]);
  assert.deepEqual([...run("gruposExames().map(g=>g.sem)")], ['ruim', 'atencao', 'ok', '']);
});

test('PDF: a tela e o papel leem do MESMO cálculo', () => {
  const {run, document} = comExames([
    {id: '1', data: '2026-03-01', exame: 'LDL', valor: '160', unidade: 'mg/dL'},
    {id: '2', data: '2026-09-02', exame: 'LDL', valor: '94', unidade: 'mg/dL'},
  ]);
  run("atual='saude';const m=document.getElementById('main');m.replaceChildren();vSaude(m)");
  const daTela = document.querySelector('[data-bid="sa-ex"] tbody tr');
  assert.ok(daTela, 'a tela tem de listar o marcador');
  assert.match(daTela.textContent, /LDL/);
  // o mesmo grupo que o PDF usa
  assert.equal(run("gruposExames().length"), 1);
  assert.equal(run("gruposExames()[0].tend.pct.toFixed(0)"), '-41');
});
