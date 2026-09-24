import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

const css = readFileSync(new URL('../publico/empresas.css', import.meta.url), 'utf8');

/* Os bancos eram uma LISTA vertical: um por linha, e gerente e telefone
 * escondidos dentro do acordeão "Detalhes". */
test('bancos: os cartões ficam lado a lado, não empilhados', () => {
  /* Olha TODAS as regras da grade, não a primeira: uma regra antiga escondida
     mais acima já enganou este teste uma vez. */
  const regras = css.match(/\.bancos-grade\{[^}]*\}/g);
  assert.ok(!regras.some(r => /flex-direction:column/.test(r)), 'coluna era a lista antiga');
  assert.ok(regras.some(r => /display:grid/.test(r) && /repeat\(auto-fill,minmax\(\d+px,1fr\)\)/.test(r)),
    'a grade tem de caber quantos couberem na largura');
  assert.ok(!regras.some(r => /repeat\(2,/.test(r)), 'número fixo de colunas não acompanha a largura');
  // e no celular volta a uma coluna, senão o cartão fica ilegível
  assert.match(css, /@media\(max-width:600px\)[\s\S]*\.bancos-grade\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('bancos: nenhuma regra órfã da lista antiga ficou para trás', () => {
  assert.equal((css.match(/banco-linha/g) || []).length, 0,
    'regra morta faz a próxima pessoa confiar num layout que não existe mais');
});

const comBancos = (lista) => {
  const s = setup();
  s.run('E.bancos=' + JSON.stringify(lista) + ';bancosFonte={contas:[],erro:"",em:"",pendente:null}');
  return s;
};
const CONTA = {id: 'b1', banco: 'Banco de Teste', codigoBanco: '341', titular: 'Empresa Teste',
  agencia: '1234', conta: '56789-0', pix: 'chave@teste', gerente: 'Fulano de Tal', telefone: '(38) 99999-1234'};

test('bancos: número, gerente e telefone ficam no cartão, fora do acordeão', async () => {
  const {run, document} = comBancos([CONTA]);
  await run("(async()=>{atual='bancos';const m=document.getElementById('main');m.replaceChildren();await vBancos(m)})()");
  const card = document.querySelector('.banco-card');
  assert.ok(card, 'o cartão tem de existir');
  const detalhes = card.querySelector('.banco-detalhes');
  const foraDoAcordeao = n => n && !detalhes.contains(n);
  assert.ok(foraDoAcordeao(card.querySelector('.banco-codigo')), 'o número do banco à vista');
  assert.match(card.querySelector('.banco-codigo').textContent, /341/);
  assert.ok(foraDoAcordeao(card.querySelector('.banco-gerente')), 'o gerente à vista');
  assert.match(card.querySelector('.banco-gerente').textContent, /Fulano de Tal/);
  const fone = card.querySelector('.banco-fone');
  assert.ok(foraDoAcordeao(fone), 'o telefone à vista');
  assert.equal(fone.getAttribute('href'), 'tel:38999991234', 'e clicável para ligar');
});

test('bancos: sem logo, o crachá é o número do banco — emoji igual não distingue', async () => {
  const {run, document} = comBancos([CONTA, {...CONTA, id: 'b2', banco: 'Outro Banco', codigoBanco: '001'}]);
  await run("(async()=>{atual='bancos';const m=document.getElementById('main');m.replaceChildren();await vBancos(m)})()");
  const crachas = [...document.querySelectorAll('.banco-icone')].map(n => n.textContent.trim());
  assert.deepEqual(crachas.sort(), ['001', '341'], 'cada banco com o seu número');
});

test('bancos: sem gerente nem telefone, o cartão diz que falta', async () => {
  const {run, document} = comBancos([{id: 'b3', banco: 'Sem contato', titular: 'X'}]);
  await run("(async()=>{atual='bancos';const m=document.getElementById('main');m.replaceChildren();await vBancos(m)})()");
  assert.match(document.querySelector('.banco-contato').textContent, /Sem gerente ou telefone cadastrado/);
});
