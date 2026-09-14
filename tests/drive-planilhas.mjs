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
