import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {setup} from './helpers/dom.mjs';

const base = new URL('../publico/', import.meta.url);
const ids = ['corrida', 'hyrox', 'mtb', 'musculacao'];
const cacheKey = id => 'vidaLeo.esportes.estudos.v1.' + id;
const allowedKey = key => ids.some(id => cacheKey(id) === key);
const json = value => JSON.parse(JSON.stringify(value));
const rawArticle = (extra = {}) => ({
  id: '12345678', source: 'MED', title: 'Estudo demonstrativo sobre exercício',
  authorString: 'Autor A, Autor B', journalTitle: 'Periódico de exemplo',
  pubYear: '2026', firstPublicationDate: '2026-10-09',
  ...extra
});
const result = articles => ({hitCount: articles.length, resultList: {result: articles}});
const response = articles => ({ok: true, status: 200, json: async () => result(articles)});

function app({storage = new Map(), fetch: fetchImpl, storedError = false} = {}) {
  let clock = Date.parse('2026-11-17T15:00:00Z');
  const calls = [], writes = [], reads = [];
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const ctx = vm.createContext({
    console, URL, URLSearchParams, Date: FixedDate, AbortController,
    setTimeout, clearTimeout, structuredClone,
    localStorage: {
      getItem(key) { reads.push(key); return storage.get(key) ?? null; },
      setItem(key, value) {
        if (storedError) throw new Error('Quota de teste');
        writes.push(key); storage.set(key, String(value));
      }
    },
    fetch: async (url, options) => {
      calls.push({url: String(url), options});
      return (fetchImpl || (async () => response([rawArticle()])))(url, options);
    }
  });
  ctx.window = ctx;
  Object.defineProperty(ctx, 'E', {
    get() { throw new Error('A biblioteca de esportes não pode consultar dados pessoais'); },
    set() { throw new Error('A biblioteca de esportes não pode modificar o estado pessoal'); }
  });
  for (const file of ['saude-esportes-dados.js', 'saude-esportes-modelo.js']) {
    if (file === 'saude-esportes-dados.js' && !existsSync(new URL(file, base))) continue;
    vm.runInContext(readFileSync(new URL(file, base), 'utf8'), ctx, {filename: file});
  }
  return {
    ctx, model: ctx.SaudeEsportesModelo, data: ctx.SaudeEsportesDados,
    calls, writes, reads, storage,
    setTime: date => { clock = Date.parse(date); },
    setFetch: fn => { fetchImpl = fn; },
    setStorageError: value => { storedError = value; }
  };
}

function ui(options = {}) {
  const a = app(options);
  const {document, HTMLElement} = parseHTML('<!doctype html><html><body></body></html>');
  HTMLElement.prototype.focus = function() {};
  a.ctx.document = document;
  vm.runInContext(readFileSync(new URL('saude-esportes.js', base), 'utf8'), a.ctx);
  const root = a.ctx.saudeEsportes();
  document.body.append(root);
  return {...a, document, root};
}

test('esportes: abrir a biblioteca não consulta a rede nem o estado pessoal', () => {
  const a = app();
  for (const id of ids) {
    const state = a.model.get(id);
    assert.deepEqual(json(state.items), []);
    assert.equal(state.checkedAt, '');
    assert.equal(state.loading, false);
  }
  assert.equal(a.calls.length, 0);
  assert.equal(a.writes.length, 0);
  assert.ok(a.reads.every(allowedKey));
});

test('esportes: só aceita identificadores bibliográficos MED e gera links PubMed', () => {
  const {model} = app();
  const items = model.normalizar(result([
    rawArticle({url: 'javascript:alert(1)', fullTextUrl: 'https://example.invalid/evil'}),
    rawArticle({id: '12345678', title: 'Duplicado'}),
    rawArticle({id: 'abc'}),
    rawArticle({id: '1/../../evil'}),
    rawArticle({id: '99887766', source: 'PPR'}),
    rawArticle({id: '99887767', source: 'PMC'}),
    rawArticle({id: '99887768', title: ''}),
    null
  ]));
  assert.equal(items.length, 1);
  assert.equal(items[0].id, '12345678');
  assert.equal(items[0].url, 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
  assert.doesNotMatch(JSON.stringify(items), /javascript:|example\.invalid|fullTextUrl/);
});

test('esportes: respostas vazias são aceitas e estruturas inválidas não viram artigos', () => {
  const {model} = app();
  assert.deepEqual(json(model.normalizar(result([]))), []);
  for (const invalid of [null, undefined, {}, {resultList: null}, {resultList: {result: 'texto'}}]) {
    let normalized;
    try { normalized = model.normalizar(invalid); }
    catch (error) { assert.ok(typeof error.message === 'string'); continue; }
    assert.deepEqual(json(normalized), []);
  }
});

test('esportes: metadados têm tamanho limitado e datas impossíveis não são exibidas', () => {
  const {model} = app();
  const items = model.normalizar(result([
    rawArticle({title: 'T'.repeat(2000), authorString: 'A'.repeat(2000), journalTitle: 'J'.repeat(2000), firstPublicationDate: '2026-02-30'}),
    rawArticle({id: '22345678', firstPublicationDate: '2024-02-29'}),
    rawArticle({id: '32345678', firstPublicationDate: '2026-99-99', pubYear: 'ano inválido'})
  ]));
  assert.ok(items[0].title.length <= 600);
  assert.ok(items[0].authors.length <= 400);
  assert.ok(items[0].journal.length <= 180);
  assert.equal(items[0].date, '');
  assert.equal(items[1].date, '2024-02-29');
  assert.equal(items[2].date, '');
  assert.equal(items[2].year, '');
});

test('esportes: consultas usam datas explícitas e temas genéricos por modalidade', () => {
  const {model} = app();
  const queries = ids.map(id => model.query(id, new Date('2026-11-17T15:00:00Z')));
  assert.equal(new Set(queries).size, ids.length);
  for (const query of queries) {
    assert.equal(typeof query, 'string');
    assert.match(query, /2026-11-17/);
    assert.match(query, /FIRST_PDATE|PUB_YEAR/);
    assert.match(query, /MED/);
    assert.doesNotMatch(query, /leogpereira|gmail|centralLeo|cl_token|sub.?49|4:50|diagn[oó]stico pessoal/i);
  }
  assert.match(queries[0], /running|runners|marathon/i);
  assert.match(queries[1], /hyrox|functional/i);
  assert.match(queries[2], /mountain/i);
  assert.match(queries[3], /resistance|strength/i);
});

test('esportes: sucesso registra apenas metadados, data e cache isolado', async () => {
  const a = app({fetch: async () => response([rawArticle({abstractText: 'Resumo não necessário no cache', patient: 'Dado não permitido'})])});
  await a.model.atualizar('corrida');
  const state = a.model.get('corrida');
  assert.equal(state.items.length, 1);
  assert.equal(state.loading, false);
  assert.equal(state.error, '');
  assert.equal(new Date(state.checkedAt).toISOString(), '2026-11-17T15:00:00.000Z');
  assert.ok(a.writes.length > 0);
  assert.ok(a.writes.every(key => key === cacheKey('corrida')));
  const persisted = a.storage.get(cacheKey('corrida'));
  assert.doesNotMatch(persisted, /abstractText|patient|Resumo não necessário|Dado não permitido/);
  const url = new URL(a.calls[0].url);
  assert.equal(url.origin, 'https://www.ebi.ac.uk');
  assert.equal(url.pathname, '/europepmc/webservices/rest/search');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.has('api_key'), false);
  assert.equal(url.searchParams.has('token'), false);
  assert.doesNotMatch(JSON.stringify(a.calls[0].options || {}), /authorization|cl_token/i);
});

test('esportes: cache reaparece após recarga sem chamada automática à API', async () => {
  const a = app();
  await a.model.atualizar('mtb');
  const stored = json(a.model.get('mtb'));
  const b = app({storage: a.storage});
  assert.deepEqual(json(b.model.get('mtb').items), stored.items);
  assert.equal(b.model.get('mtb').checkedAt, stored.checkedAt);
  assert.equal(b.model.get('mtb').loading, false);
  assert.equal(b.calls.length, 0);
});

test('esportes: cache corrompido não derruba a biblioteca nem acessa outros registros', () => {
  const a = app({storage: new Map([[cacheKey('corrida'), '{json quebrado'], ['centralLeo.v1', '{dados privados}']])});
  assert.deepEqual(json(a.model.get('corrida').items), []);
  assert.equal(a.calls.length, 0);
  assert.ok(a.reads.every(allowedKey));
});

test('esportes: recarga valida IDs e reconstrói URLs em cache adulterado', () => {
  const storage = new Map([[cacheKey('corrida'), JSON.stringify({version: 1,
    checkedAt: 'não é data', loading: true,
    items: [
      {id: '12345678', title: 'Válido', url: 'javascript:alert(1)', authors: 'Autor', year: '2026'},
      {id: '../arquivo', title: 'Inválido', url: 'https://example.invalid'}
    ]
  })]]);
  const a = app({storage});
  const state = a.model.get('corrida');
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].url, 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
  assert.equal(state.checkedAt, '');
  assert.equal(state.loading, false);
  assert.equal(a.calls.length, 0);
});

test('esportes: quota de cache mostra aviso sem ocultar consulta bem-sucedida', async () => {
  const a = app({storedError: true});
  await a.model.atualizar('corrida');
  const state = a.model.get('corrida');
  assert.equal(state.error, '');
  assert.equal(state.items.length, 1);
  assert.ok(state.checkedAt);
  assert.ok(state.cacheWarning.length > 0);
  assert.equal(a.storage.has(cacheKey('corrida')), false);
});

test('esportes: falha de rede conserva artigos e data da consulta bem-sucedida', async () => {
  const a = app();
  await a.model.atualizar('corrida');
  const before = json(a.model.get('corrida'));
  a.setTime('2026-11-18T15:00:00Z');
  a.setFetch(async () => { throw new Error('Sem conexão de teste'); });
  await a.model.atualizar('corrida');
  const state = a.model.get('corrida');
  assert.deepEqual(json(state.items), before.items);
  assert.equal(state.checkedAt, before.checkedAt);
  assert.equal(state.loading, false);
  assert.ok(state.error.length > 0);
});

test('esportes: HTTP inválido e JSON quebrado não recebem data de atualização', async () => {
  for (const fetch of [
    async () => ({ok: false, status: 503, json: async () => result([rawArticle()])}),
    async () => ({ok: true, status: 200, json: async () => { throw new SyntaxError('JSON inválido'); }})
  ]) {
    const a = app({fetch});
    await a.model.atualizar('hyrox');
    assert.equal(a.model.get('hyrox').checkedAt, '');
    assert.equal(a.model.get('hyrox').loading, false);
    assert.ok(a.model.get('hyrox').error.length > 0);
  }
});

test('esportes: resposta incompatível conserva a última consulta e seu cache', async () => {
  const a = app();
  await a.model.atualizar('corrida');
  const before = json(a.model.get('corrida'));
  const persisted = a.storage.get(cacheKey('corrida'));
  a.setTime('2026-11-18T15:00:00Z');
  a.setFetch(async () => ({ok: true, json: async () => ({error: 'Serviço inválido'})}));
  await a.model.atualizar('corrida');
  assert.deepEqual(json(a.model.get('corrida').items), before.items);
  assert.equal(a.model.get('corrida').checkedAt, before.checkedAt);
  assert.ok(a.model.get('corrida').error);
  assert.equal(a.storage.get(cacheKey('corrida')), persisted);
});

test('esportes: consulta vazia válida substitui os resultados e informa a nova data', async () => {
  const a = app();
  await a.model.atualizar('corrida');
  a.setTime('2026-11-18T15:00:00Z');
  a.setFetch(async () => response([]));
  await a.model.atualizar('corrida');
  assert.equal(a.model.get('corrida').items.length, 0);
  assert.equal(a.model.get('corrida').error, '');
  assert.equal(new Date(a.model.get('corrida').checkedAt).toISOString(), '2026-11-18T15:00:00.000Z');
});

test('esportes: cliques repetidos compartilham uma consulta em andamento', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const a = app({fetch: async () => pending});
  const first = a.model.atualizar('corrida');
  const second = a.model.atualizar('corrida');
  assert.equal(a.calls.length, 1);
  assert.equal(a.model.get('corrida').loading, true);
  release(response([rawArticle()]));
  await Promise.all([first, second]);
  assert.equal(a.model.get('corrida').items.length, 1);
  assert.equal(a.model.get('corrida').loading, false);
});

test('esportes: falha libera nova tentativa e não contamina as outras modalidades', async () => {
  const a = app({fetch: async () => { throw new Error('Falha transitória'); }});
  await a.model.atualizar('corrida');
  a.setFetch(async () => response([rawArticle({id: '87654321'})]));
  await a.model.atualizar('corrida');
  assert.equal(a.calls.length, 2);
  assert.equal(a.model.get('corrida').error, '');
  assert.equal(a.model.get('corrida').items[0].id, '87654321');
  for (const id of ids.filter(id => id !== 'corrida')) {
    assert.equal(a.model.get(id).items.length, 0);
    assert.equal(a.model.get(id).checkedAt, '');
  }
});

test('esportes: atualizar todas consulta cada modalidade sem tocar no estado pessoal', async () => {
  const a = app();
  await a.model.atualizarTodas();
  assert.equal(a.calls.length, ids.length);
  assert.equal(new Set(a.calls.map(call => new URL(call.url).searchParams.get('query'))).size, ids.length);
  for (const id of ids) {
    assert.equal(a.model.get(id).loading, false);
    assert.ok(a.model.get(id).checkedAt);
  }
  assert.ok(a.writes.every(allowedKey));
});

test('esportes: abas distintas preservam as consultas de outras modalidades no cache', async () => {
  const storage = new Map();
  const a = app({storage, fetch: async () => response([rawArticle({id: '12345678', title: 'Corrida em uma aba'})])});
  const b = app({storage, fetch: async () => response([rawArticle({id: '87654321', title: 'HYROX em outra aba'})])});
  await a.model.atualizar('corrida');
  b.setTime('2026-11-18T15:00:00Z');
  await b.model.atualizar('hyrox');
  const recarregada = app({storage});
  assert.equal(recarregada.model.get('corrida').items[0].id, '12345678');
  assert.equal(recarregada.model.get('hyrox').items[0].id, '87654321');
  assert.equal(recarregada.model.get('corrida').checkedAt, '2026-11-17T15:00:00.000Z');
  assert.equal(recarregada.model.get('hyrox').checkedAt, '2026-11-18T15:00:00.000Z');
  assert.deepEqual([...storage.keys()].sort(), [cacheKey('corrida'), cacheKey('hyrox')].sort());
});

test('esportes: identificador desconhecido não dispara pesquisa arbitrária', async () => {
  const a = app();
  try { await a.model.atualizar('consulta privada arbitrária'); } catch {}
  assert.equal(a.calls.length, 0);
  assert.equal(a.writes.length, 0);
});

test('esportes: conteúdo mantém quatro modalidades e referências existentes', () => {
  const {data} = app();
  assert.ok(data, 'Dados editoriais precisam estar disponíveis');
  const modalities = data.modalities;
  assert.deepEqual(json(modalities.map(item => item.id)).sort(), [...ids].sort());
  const references = data.sources;
  assert.ok(references && Object.keys(references).length >= 8);
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.sources)) {
      for (const id of value.sources) assert.ok(references[id], `Fonte ausente: ${id}`);
    }
    for (const child of Object.values(value)) inspect(child);
  }
  modalities.forEach(inspect);
  for (const item of modalities) {
    assert.ok(item.training.length >= 4, `${item.id}: exercícios`);
    assert.ok(item.glossary.length >= 4, `${item.id}: vocabulário`);
    assert.ok(item.gear.length >= 3, `${item.id}: equipamentos`);
    assert.ok(item.care.length >= 2, `${item.id}: cuidados`);
  }
  for (const ref of Object.values(references)) {
    assert.equal(new URL(ref.url).protocol, 'https:');
  }
});

test('esportes: imagens locais referenciadas existem e não dependem de URLs pessoais', () => {
  const {data} = app();
  assert.ok(data, 'Dados editoriais precisam estar disponíveis');
  const images = data.modalities.map(item => item.image).filter(Boolean);
  assert.equal(images.length, 4, 'Uma imagem principal para cada modalidade');
  for (const image of images) {
    const path = typeof image === 'string' ? image : image.src;
    assert.ok(path && !/^(?:https?:|data:|file:)/i.test(path), 'Imagem deve ser um asset local');
    assert.ok(existsSync(new URL(path.replace(/^\.\//, ''), base)), `Imagem ausente: ${path}`);
  }
});

test('esportes UI: quatro modalidades abrem suas seções sem rede ou dados pessoais', () => {
  const a = ui();
  assert.equal(a.root.querySelectorAll('[data-esp-modalidade]').length, 4);
  for (const id of ids) {
    a.root.querySelector(`[data-esp-modalidade="${id}"]`).click();
    assert.equal(a.ctx.SaudeEsportesUI.modalidade, id);
    assert.equal(a.root.querySelectorAll('[role="tab"]').length, 5);
    assert.ok(a.root.querySelector('[role="tabpanel"] [data-esp-item]'));
    for (const section of ['glossary', 'gear', 'care', 'studies']) {
      a.root.querySelector(`[data-esp-tab="${section}"]`).click();
      assert.equal(a.ctx.SaudeEsportesUI.secao, section);
      assert.equal(a.root.querySelector(`[data-esp-tab="${section}"]`).getAttribute('aria-selected'), 'true');
      assert.ok(a.root.querySelector('[role="tabpanel"]').textContent.length > 30);
    }
    a.root.querySelector('.esp-voltar').click();
    assert.equal(a.ctx.SaudeEsportesUI.modalidade, '');
  }
  assert.equal(a.calls.length, 0);
  assert.equal(a.writes.length, 0);
});

test('esportes UI: busca ignora acentos, mostra vazio e permite limpar o filtro', () => {
  const a = ui();
  a.root.querySelector('[data-esp-modalidade="corrida"]').click();
  a.root.querySelector('[data-esp-tab="glossary"]').click();
  let input = a.root.querySelector('input[type="search"]');
  input.value = 'cadencia'; input.oninput();
  assert.equal(a.root.querySelectorAll('[data-esp-item]').length, 1);
  assert.match(a.root.querySelector('[data-esp-item]').textContent, /Cadência/);
  input.value = 'zzzzz-termo-inexistente'; input.oninput();
  assert.equal(a.root.querySelectorAll('[data-esp-item]').length, 0);
  assert.match(a.root.textContent, /Nenhum conteúdo encontrado/);
  [...a.root.querySelectorAll('button')].find(button => button.textContent === 'Limpar').click();
  assert.equal(input.value, '');
  assert.ok(a.root.querySelectorAll('[data-esp-item]').length > 1);
  a.root.querySelector('.esp-voltar').click();
  assert.equal(a.root.querySelector('input[type="search"]').value, '');
});

test('esportes UI: abas aceitam teclado e mantêm associação ao painel', () => {
  const a = ui();
  a.root.querySelector('[data-esp-modalidade="corrida"]').click();
  let prevented = false;
  a.root.querySelector('[data-esp-tab="training"]').onkeydown({key: 'ArrowRight', preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(a.ctx.SaudeEsportesUI.secao, 'glossary');
  const selected = a.root.querySelector('[role="tab"][aria-selected="true"]');
  const panel = a.root.querySelector('[role="tabpanel"]');
  assert.equal(selected.getAttribute('aria-controls'), panel.id);
  assert.equal(panel.getAttribute('aria-labelledby'), selected.id);
  selected.onkeydown({key: 'End', preventDefault() {}});
  assert.equal(a.ctx.SaudeEsportesUI.secao, 'studies');
});

test('esportes UI: atualização real do botão mostra fontes não revisadas e preserva editorial', async () => {
  const a = ui();
  const editorial = JSON.stringify(a.data);
  a.root.querySelector('[data-esp-modalidade="corrida"]').click();
  await a.root.querySelector('[data-esp-atualizar="corrida"]').onclick();
  assert.equal(a.calls.length, 1);
  assert.match(a.root.querySelector('.esp-feedback').textContent, /Consulta concluída/);
  a.root.querySelector('[data-esp-tab="studies"]').click();
  assert.equal(a.root.querySelectorAll('.esp-fonte-nova').length, 1);
  assert.match(a.root.querySelector('.esp-recentes').textContent, /Ainda não revisadas/);
  assert.match(a.root.querySelector('.esp-recentes').textContent, /não mudam automaticamente/);
  assert.match(a.root.querySelector('.esp-datas').textContent, /Revisão do conteúdo.*Última consulta/);
  assert.equal(JSON.stringify(a.data), editorial);
});

test('esportes UI: títulos hostis são texto, e links não permitem código executável', async () => {
  const hostile = '&lt;img src=x onerror="alert(1)"&gt; Estudo hostil';
  const a = ui({fetch: async () => response([rawArticle({title: hostile, authorString: '<script>alert(1)</script>'})])});
  a.root.querySelector('[data-esp-modalidade="corrida"]').click();
  await a.root.querySelector('[data-esp-atualizar="corrida"]').onclick();
  a.root.querySelector('[data-esp-tab="studies"]').click();
  const card = a.root.querySelector('.esp-fonte-nova');
  assert.match(card.textContent, /Estudo hostil/);
  assert.equal(card.querySelectorAll('img,script,[onerror],[onload]').length, 0);
  const link = card.querySelector('a');
  assert.equal(link.getAttribute('href'), 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
  assert.match(link.rel, /noopener/);
  assert.match(link.rel, /noreferrer/);
  const firstSource = Object.values(a.data.sources)[0];
  firstSource.url = 'javascript:alert(1)';
  a.root.querySelector('[data-esp-tab="training"]').click();
  a.root.querySelector('[data-esp-tab="studies"]').click();
  assert.equal(a.root.querySelector('a[href^="javascript:"]'), null);
});

test('esportes UI: falha após sucesso mantém resultados e não anuncia sucesso falso', async () => {
  const a = ui();
  a.root.querySelector('[data-esp-modalidade="corrida"]').click();
  await a.root.querySelector('[data-esp-atualizar="corrida"]').onclick();
  a.setFetch(async () => { throw new Error('Offline'); });
  await a.root.querySelector('[data-esp-atualizar="corrida"]').onclick();
  const feedback = a.root.querySelector('.esp-feedback');
  assert.equal(feedback.dataset.nivel, 'erro');
  assert.doesNotMatch(feedback.textContent, /Consulta concluída/);
  a.root.querySelector('[data-esp-tab="studies"]').click();
  assert.equal(a.root.querySelectorAll('.esp-fonte-nova').length, 1);
  assert.ok(a.root.querySelector('[role="alert"]'));
});

test('esportes UI: botão fica ocupado até a consulta encerrar e bloqueia repetição', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const a = ui({fetch: async () => pending});
  a.root.querySelector('[data-esp-modalidade="corrida"]').click();
  const task = a.root.querySelector('[data-esp-atualizar="corrida"]').onclick();
  assert.equal(a.root.getAttribute('aria-busy'), 'true');
  assert.equal(a.root.querySelector('[data-esp-atualizar="corrida"]').disabled, true);
  await a.root.querySelector('[data-esp-atualizar="corrida"]').onclick();
  assert.equal(a.calls.length, 1);
  release(response([rawArticle()])); await task;
  assert.equal(a.root.getAttribute('aria-busy'), 'false');
  assert.equal(a.root.querySelector('[data-esp-atualizar="corrida"]').disabled, false);
});

test('esportes integração: área fica dentro de Saúde e não altera seus cadastros', () => {
  const a = setup();
  for (const file of ['saude-modelo.js', 'saude-painel.js', 'saude-esportes-dados.js', 'saude-esportes-modelo.js', 'saude-esportes.js']) {
    a.run(readFileSync(new URL(file, base), 'utf8'));
  }
  a.run("atual='saude';tela=()=>{};SaudeUI.area='esportes';var estadoAntesEsportes=JSON.stringify(E);saudePainel(document.getElementById('main'))");
  assert.ok(a.document.querySelector('#sui-area [data-esportes="biblioteca"]'));
  const nav = [...a.document.querySelectorAll('[aria-label="Áreas de saúde"] button')];
  assert.ok(nav.some(button => /Esportes/.test(button.textContent) && button.getAttribute('aria-pressed') === 'true'));
  const select = a.document.querySelector('select[aria-label="Área da Saúde"]');
  assert.ok([...select.options].some(option => option.value === 'esportes'));
  assert.equal(a.run('JSON.stringify(E)'), a.run('estadoAntesEsportes'));
  assert.equal(a.document.querySelector('#main .sui-periodo-detalhes'), null, 'Filtros clínicos não devem confundir a biblioteca');
});

test('esportes integração: página carrega dados e modelo antes da interface', () => {
  const html = readFileSync(new URL('index.html', base), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => match[1].split('?')[0]);
  const order = ['saude-esportes-dados.js', 'saude-esportes-modelo.js', 'saude-esportes.js'].map(file => scripts.findIndex(src => src.endsWith(file)));
  assert.ok(order.every(index => index >= 0), 'Scripts de esportes precisam estar na página');
  assert.ok(order[0] < order[1] && order[1] < order[2], 'Dependências carregadas antes da UI');
  assert.match(html, /href=["'][^"']*saude-esportes\.css(?:\?[^"']*)?["']/);
});
