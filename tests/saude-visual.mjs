import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

function abrirSaude(dados = '') {
  const {run, document} = setup();
  run("E.perfil=Object.assign({},E.perfil,{nascimento:'1980-01-01'});E.queixas=[];E.consultas=[];E.fisio=[];E.exames=[];E.vacinas=[];E.tratamentos=[];E.peso=[];E.vitais=[];" + dados + ";vSaude(document.getElementById('main'));organizarSaude(document.getElementById('main'))");
  return {run, document};
}

test('resumo de saúde mantém indicadores, documentos, abas e registros acessíveis', () => {
  const {document} = abrirSaude("E.peso=[{id:'p',data:'2026-07-23',peso:81,altura:1.72,cintura:88}]");
  assert.ok(document.querySelector('.topo.saude-hero'), 'o cabeçalho usado por Revisar documentos precisa continuar na tela');
  assert.equal(document.querySelectorAll('.saude-resumo .kpi').length, 6);
  assert.match(document.querySelector('.saude-resumo .kpi:nth-child(2)').textContent, /23\/07\/2026/);
  assert.equal(document.querySelectorAll('.saude-tabs button').length, 5);
  assert.ok(document.querySelector('.saude-acoes select option[value=""]'));
  assert.ok(document.querySelector('.saude-sos'));
  document.querySelector('.saude-tabs [data-area="exames"]').click();
  assert.equal(document.querySelector('#saude-exames').hidden, false);
  assert.equal(document.querySelector('#saude-resumo').hidden, true);
  document.querySelector('.saude-tabs [data-area="resumo"]').click();
  assert.equal(document.querySelector('#saude-resumo').hidden, false);
  assert.ok(document.querySelector('#saude-resumo .saude-resumo-faixa .saude-lembretes'));
});

for (const [botao, modal] of [
  ['Adicionar exame', 'Novo exame'],
  ['Adicionar vacina', 'Nova vacina'],
  ['Registrar pesagem', 'Nova pesagem'],
]) {
  test(`estado vazio de saúde: ${botao} abre o cadastro correspondente`, () => {
    const {document} = abrirSaude();
    const acao = [...document.querySelectorAll('.saude-vazio-acoes button')].find(x => x.textContent === botao);
    assert.ok(acao, `faltou o atalho ${botao}`);
    acao.click();
    assert.match(document.querySelector('.modal')?.textContent ?? '', new RegExp(modal));
  });
}

test('gráfico do peso só aparece quando há duas medições feitas', () => {
  const {document} = abrirSaude("E.peso=[{id:'p1',data:'2026-06-01',peso:84},{id:'p2',data:'2026-07-01',peso:81}]");
  const grafico = document.querySelector('[data-bid="sa-dash"]');
  assert.ok(grafico.querySelector('.grafico'));
  assert.equal(grafico.querySelector('.saude-vazio'), null);
});
