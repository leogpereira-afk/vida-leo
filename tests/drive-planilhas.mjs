/* A lista de planilhas é a única parte do Drive que ESCREVE (no editor do
   Google, com a sessão do navegador). Por isso o que entra nela precisa de
   porta estreita: só link de planilha do Google, em https. E o id da planilha é
   a chave dela — o teste também guarda a regra de que ele NÃO pode estar escrito
   no index.html, que é servido publicamente. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

const {run} = setup();
const ler = (url) => run('JSON.stringify(driveLinkPlanilha(' + JSON.stringify(url) + '))');

test('Planilhas: link bom entrega id e aba', () => {
  assert.deepEqual(JSON.parse(ler('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?gid=249517961#gid=249517961')),
    {sheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789', gid: '249517961'});
  assert.deepEqual(JSON.parse(ler('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit')),
    {sheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789', gid: ''});
});

test('Planilhas: só planilha do Google, e só https', () => {
  for (const ruim of [
    '',
    'nada',
    'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit',   // é documento, não planilha
    'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',    // é pasta
    'http://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit', // sem https
    'https://docs.google.com.exemplo.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit', // domínio sósia
    'javascript:alert(1)',
    'https://docs.google.com/spreadsheets/d/curto/edit',                                // id curto demais
  ]) assert.equal(ler(ruim), 'null', ruim);
});

test('Planilhas: o endereço montado aponta para o Google e leva a aba', () => {
  const p = {sheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789', gid: '249517961'};
  const editor = run('planilhaUrlEditor(' + JSON.stringify(p) + ')');
  const google = run('planilhaUrlGoogle(' + JSON.stringify(p) + ')');
  for (const u of [editor, google]) assert.ok(u.startsWith('https://docs.google.com/spreadsheets/d/'), u);
  assert.match(editor, /gid=249517961/);
  assert.match(google, /#gid=249517961/);
});

test('Planilhas: id estranho é escapado, nunca concatenado cru', () => {
  const u = run('planilhaUrlEditor({sheetId:"a/../../b?x=1&y=2",gid:"9\\"onerror=1"})');
  assert.ok(!u.includes('../'), u);
  assert.ok(!u.includes('"'), u);
});

test('Planilhas: a lista nasce vazia e mora no estado, não no código', () => {
  assert.equal(run('JSON.stringify(SEED.planilhas)'), '[]');
  /* O index.html é servido em github.io para qualquer pessoa. Um id de planilha
     escrito aqui entregaria o documento a quem abrisse o código-fonte. */
  const html = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  const achados = html.match(/spreadsheets\/d\/[A-Za-z0-9_-]{20,}/g) || [];
  assert.deepEqual(achados, [], 'há id de planilha escrito no HTML público: ' + achados.join(', '));
});

/* ---------------------------------------------------------------- ordem -- */
const ordem = (nomes) =>
  JSON.parse(run('JSON.stringify(planilhaEmOrdem(' + JSON.stringify(nomes.map((nome) => ({nome}))) + ').map(p=>p.nome))'));

test('Planilhas: a lista sai em ordem alfabética', () => {
  assert.deepEqual(
    ordem(['Empréstimos - Impresilk', 'Acessos', 'Caixa Ativo', 'Permuta Hidrocenter',
           'Casa Pampulha Acerto', 'CASA LG 300', 'Casa Pampulha recebimentos']),
    ['Acessos', 'Caixa Ativo', 'CASA LG 300', 'Casa Pampulha Acerto',
     'Casa Pampulha recebimentos', 'Empréstimos - Impresilk', 'Permuta Hidrocenter']);
});

/* A ordem do code point joga acento e maiúscula para FORA do alfabeto: "ÁRVORE"
   iria antes de "Abacate" e "Água" cairia depois de "zebra". É o erro que faz a
   pessoa jurar que a planilha sumiu da lista. */
test('Planilhas: acento e maiúscula não jogam a planilha para fora do alfabeto', () => {
  assert.deepEqual(ordem(['zebra', 'Abacate', 'ÁRVORE']), ['Abacate', 'ÁRVORE', 'zebra']);
  assert.deepEqual(ordem(['Água', 'agua', 'Banana']), ['Água', 'agua', 'Banana']);
});

test('Planilhas: número conta como número — Casa 2 antes de Casa 10', () => {
  assert.deepEqual(ordem(['Casa 10', 'Casa 2', 'Casa 1']), ['Casa 1', 'Casa 2', 'Casa 10']);
});

test('Planilhas: sem nome vai para o fim, não para o começo', () => {
  assert.deepEqual(ordem(['', 'Beta', 'Alfa']), ['Alfa', 'Beta', '']);
});

/* A ordenação é de uma CÓPIA: o que está guardado na nuvem não muda de ordem
   sozinho a cada desenho da tela. */
test('Planilhas: ordenar não mexe na lista guardada', () => {
  const antes = run('JSON.stringify((E.planilhas=[{id:"b",nome:"Beta"},{id:"a",nome:"Alfa"}]).map(p=>p.id))');
  const saida = run('JSON.stringify(planilhaEmOrdem(E.planilhas).map(p=>p.id))');
  const depois = run('JSON.stringify(E.planilhas.map(p=>p.id))');
  assert.equal(saida, '["a","b"]');
  assert.equal(depois, antes, 'a lista guardada foi reordenada no lugar');
});

test('Planilhas: lista ausente ou torta não derruba a tela', () => {
  assert.equal(run('JSON.stringify(planilhaEmOrdem(null))'), '[]');
  assert.equal(run('JSON.stringify(planilhaEmOrdem(undefined))'), '[]');
  assert.equal(run('JSON.stringify(planilhaEmOrdem([null,{nome:"A"}]).map(p=>p&&p.nome||""))'), '["A",""]');
});

/* Renomear tem de caber na LISTA. Antes só dava pela barra de dentro da
   planilha aberta — para trocar um nome era preciso carregar o editor do
   Google inteiro. E botão dentro de botão não existe em HTML: o navegador
   desmonta o de fora e o clique cai em lugar errado. */
test('Planilhas: o lápis de renomear é irmão do cartão, não filho', () => {
  const html = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  assert.match(html, /class="dv-lapis"/, 'não há botão de renomear na lista');
  assert.match(html, /lap\.onclick=\(\)=>modalPlanilha\(pl,r\)/, 'o lápis não abre o modal de edição');
  assert.ok(!/<button class="dv-pasta"[^]{0,400}?<button/.test(html), 'há botão dentro de botão no cartão');
});
