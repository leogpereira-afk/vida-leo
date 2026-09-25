import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const tela = (estado = '') => {
  const s = setup();
  s.run('E.bancos=[];E.contabilidades=[];E.seguros=[];E.documentos=[];E.empresasPJ=[];' +
        'bancosFonte={contas:[],erro:"",em:"",pendente:null};' + estado);
  s.run("atual='bancos';const m=document.getElementById('main');m.replaceChildren();vBancos(m)");
  return s;
};

test('as sete abas existem, na ordem pedida', () => {
  const {document} = tela();
  const abas = [...document.querySelectorAll('.workspace-tabs button')].map(b => b.textContent.trim());
  assert.deepEqual(abas.map(a => a.replace(/^\S+\s/, '')),
    ['Bancos', 'Contabilidade', 'Seguros', 'Documentos PF', 'Documentos PJ', 'Google Drive', 'Organograma']);
});

/* NENHUMA ABA CRIA LISTA NOVA: seguros são os de Gastos, documentos de pessoa
 * são os da tela Documentos, documentos de empresa moram na ficha da empresa.
 * Segunda lista para o mesmo fato diverge na primeira semana. */
test('seguros: a aba lê E.seguros, a mesma lista de Gastos', () => {
  const {run, document} = tela(`filtro.bancoAba='seguros';
    E.seguros=[{id:'s1',titular:'Impresilk',tipo:'Frota',item:'caminhão',seguradora:'Porto',renova:'2027-01-10',valor:500,ciclo:'Mensal',status:'Ativo'}]`);
  const card = document.querySelector('#bancos-seguros .banco-card');
  assert.ok(card, 'o cartão tem de existir');
  assert.match(card.textContent, /Frota · caminhão/);
  assert.match(card.textContent, /Porto/);
  assert.equal(run("E.seguros.length"), 1, 'não pode ter criado cópia');
  assert.match(document.querySelector('#bancos-seguros').textContent, /o mesmo cadastro que aparece em Gastos/);
});

test('seguros: a vigência é lida em cor e em palavra, e vencido não passa por em dia', () => {
  const {document} = tela(`filtro.bancoAba='seguros';
    E.seguros=[{id:'a',titular:'X',tipo:'Vida',renova:'2020-01-01'},{id:'b',titular:'X',tipo:'Casa',renova:'2030-01-01'},{id:'c',titular:'X',tipo:'Carro'}]`);
  const txt = document.querySelector('#bancos-seguros').textContent;
  assert.match(txt, /Venceu em 01\/01\/2020/);
  assert.match(txt, /Renova em 01\/01\/2030/);
  assert.match(txt, /Sem data de renovação/, 'sem data não vira "em dia"');
});

test('documentos PF: agrupa por pessoa e não duplica a lista', () => {
  const {run, document} = tela(`filtro.bancoAba='docpf';
    E.documentos=[{id:'d1',nome:'CNH',dono:'Léo',validade:'2030-01-01'},{id:'d2',nome:'RG',dono:'Esposa'}]`);
  const chips = [...document.querySelectorAll('.bancos-lateral .banco-empresa-chip')].map(b => b.textContent.trim());
  assert.deepEqual(chips.sort(), ['Esposa1', 'Léo1'], 'uma entrada por pessoa, com a contagem');
  assert.equal(run("E.documentos.length"), 2);
  // mostra só a pessoa escolhida
  const cards = [...document.querySelectorAll('#bancos-docpf .banco-card')];
  assert.equal(cards.length, 1, 'uma pessoa por vez');
});

test('documentos PJ: lê da ficha da empresa e oferece o caminho de volta', () => {
  const {document} = tela(`filtro.bancoAba='docpj';
    E.empresasPJ=[{id:'e1',nome:'Impresilk',documentosEmpresa:[{id:'x',nome:'Contrato social',tipo:'Societário'}]}]`);
  const card = document.querySelector('#bancos-docpj .banco-card');
  assert.ok(card, 'o documento da empresa tem de aparecer');
  assert.match(card.textContent, /Contrato social/);
  assert.ok([...card.querySelectorAll('.btn')].some(b => /ficha da empresa/.test(b.textContent)),
    'editar continua sendo na ficha, e o caminho tem de estar dito');
});

/* Assunto sem dado não vira item de menu vazio. */
test('a lateral só lista grupos que existem', () => {
  const {document} = tela("filtro.bancoAba='seguros'");
  assert.equal(document.querySelectorAll('.bancos-lateral .banco-empresa-chip').length, 0);
  assert.match(document.querySelector('#bancos-seguros').textContent, /Nenhuma apólice aqui/);
});

test('cada aba lembra o grupo escolhido separadamente', () => {
  const s = tela(`E.seguros=[{id:'s',titular:'Impresilk'}];E.documentos=[{id:'d',nome:'CNH',dono:'Léo'}]`);
  const pintar = aba => s.run(`filtro.bancoAba='${aba}';(()=>{const alvo=document.getElementById('main');alvo.replaceChildren();vBancos(alvo)})()`);
  pintar('seguros'); pintar('docpf');
  const g = s.run("JSON.stringify(filtro.bancoGrupo)");
  assert.match(g, /"seguros":"Impresilk"/);
  assert.match(g, /"docpf":"Léo"/, 'o grupo de uma aba não pode atropelar o da outra');
});
