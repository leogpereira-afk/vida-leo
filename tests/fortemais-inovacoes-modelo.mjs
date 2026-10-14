import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../publico/fortemais-inovacoes-modelo.js';

const M = globalThis.FortemaisInovacoesModelo;
const NOW = '2026-10-14T12:00:00.000Z';
const NEXT = '2026-10-15T12:00:00.000Z';

function contexto(now = NOW, autor = 'Pessoa de teste') {
  let sequencia = 0;
  return {now, autor, uid: () => `teste-${now}-${++sequencia}`};
}

function congelar(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(congelar);
    Object.freeze(value);
  }
  return value;
}

function criar(valores = {}, lista, ctx = contexto()) {
  return M.salvar(lista, {titulo: 'Solução para as próximas obras', ...valores}, null, ctx);
}

function copia(value) { return JSON.parse(JSON.stringify(value)); }

test('API: disponível globalmente e constantes não podem ser alteradas', () => {
  assert.equal(Object.isFrozen(M), true);
  assert.equal(Object.isFrozen(M.SITUACOES), true);
  assert.deepEqual(M.SITUACOES, ['Para avaliar', 'Aplicar nas próximas obras', 'Adotada', 'Arquivada']);
});

test('legado: ausência da coleção é aceita sem criar ou modificar dados', () => {
  assert.equal(M.validar(undefined), true);
  assert.deepEqual(M.filtrar(undefined), []);
  assert.deepEqual(M.resumo(undefined), {total: 0, aAplicar: 0, avaliar: 0, adotadas: 0, arquivadas: 0});
  for (const invalido of [null, {}, '', false, 0]) assert.throws(() => M.validar(invalido), /lista/);
});

test('criação: trims, padrões, identidade e autoria são gerados pelo contexto', () => {
  const lista = congelar([]), valores = congelar({titulo: '  Solução nova  ', descricao: '  Material de referência  ', aplicacao: '  Nas áreas externas  ', etapa: '  Acabamento  ', referencia: '  HTTPS://EXAMPLE.TEST/manual  ', id: 'forjado', criadoEm: '2000-01-01T00:00:00.000Z', criadoPor: 'forjado', historico: []});
  const next = M.salvar(lista, valores, null, contexto());
  assert.notStrictEqual(next, lista);
  assert.equal(lista.length, 0);
  const item = next[0];
  assert.equal(item.titulo, 'Solução nova');
  assert.equal(item.descricao, 'Material de referência');
  assert.equal(item.aplicacao, 'Nas áreas externas');
  assert.equal(item.etapa, 'Acabamento');
  assert.equal(item.referencia, 'https://example.test/manual');
  assert.equal(item.situacao, 'Para avaliar');
  assert.notEqual(item.id, 'forjado');
  assert.equal(item.criadoEm, NOW);
  assert.equal(item.atualizadoEm, NOW);
  assert.equal(item.criadoPor, 'Pessoa de teste');
  assert.equal(item.atualizadoPor, 'Pessoa de teste');
  assert.deepEqual(item.historico.map(evento => evento.tipo), ['criacao']);
  assert.equal(item.historico[0].autor, item.criadoPor);
  assert.equal(M.validar(next), true);
});

test('obrigatórios e limites: título vazio, tipos inválidos e textos excessivos são rejeitados sem corte', () => {
  for (const titulo of ['', '   ', null, 123, {}, []]) assert.throws(() => criar({titulo}));
  assert.throws(() => M.salvar([], undefined, null, contexto()), /título/);
  for (const [campo, limite] of Object.entries(M.LIMITES)) {
    if (campo === 'referencia') continue;
    const preenchido = 'a'.repeat(limite);
    assert.equal(criar({[campo]: preenchido})[0][campo], preenchido);
    assert.throws(() => criar({[campo]: preenchido + 'a'}), /máximo/);
    assert.throws(() => criar({[campo]: {texto: 'inválido'}}), /texto válido/);
  }
  for (const situacao of ['Concluída', 1, []]) assert.throws(() => criar({situacao}), /situação/);
  for (const valores of [null, [], 'texto']) assert.throws(() => M.salvar([], valores, null, contexto()), /dados/);
  assert.throws(() => criar({titulo: 'Teste\u0000oculto'}));
});

test('referência: somente http(s), sem credenciais, caminhos relativos ou esquemas executáveis', () => {
  for (const referencia of ['https://example.test/arquivo?q=abc#parte', 'http://example.test:8080/referencia', 'https://example.test/um%20arquivo']) {
    assert.equal(criar({referencia})[0].referencia, referencia);
  }
  for (const referencia of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///tmp/arquivo', 'blob:https://example.test/id', 'mailto:pessoa@example.test', '//example.test', '/arquivo', 'example.test', 'https://', 'https:///example.test', 'https://pessoa:senha@example.test', 'https://pessoa@example.test', 'https://@example.test', 'https://example.test/um arquivo', 'https://example.test/linha\nnova', 'https:\\example.test']) {
    assert.throws(() => criar({referencia}), /referência/, referencia);
  }
  const limite = 'https://example.test/' + 'a'.repeat(2000 - 'https://example.test/'.length);
  assert.equal(criar({referencia: limite})[0].referencia.length, 2000);
  assert.throws(() => criar({referencia: limite + 'a'}), /2000/);
  assert.throws(() => criar({referencia: 'https://example.test/' + 'á'.repeat(1000)}), /2000/);
});

test('edição parcial: mantém ID, criação, campos omitidos e histórico anterior sem mutar a coleção', () => {
  const initial = congelar(criar({descricao: 'Manual completo', aplicacao: 'Aplicação prevista', etapa: 'Estrutura', referencia: 'https://example.test/manual'}));
  const original = copia(initial), old = initial[0];
  const next = M.salvar(initial, {titulo: 'Título revisto', id: 'forjado', criadoPor: 'forjado', criadoEm: NEXT, atualizadoPor: 'forjado', historico: []}, old.id, {...contexto(NEXT, 'Outra pessoa'), base: copia(old)});
  assert.deepEqual(initial, original);
  assert.notStrictEqual(next, initial);
  assert.notStrictEqual(next[0], old);
  for (const campo of ['id', 'criadoEm', 'criadoPor', 'descricao', 'aplicacao', 'etapa', 'referencia', 'situacao']) assert.deepEqual(next[0][campo], old[campo], campo);
  assert.deepEqual(next[0].historico.slice(0, old.historico.length), old.historico);
  assert.equal(next[0].titulo, 'Título revisto');
  assert.equal(next[0].atualizadoEm, NEXT);
  assert.equal(next[0].atualizadoPor, 'Outra pessoa');
  assert.deepEqual(next[0].historico.at(-1).campos, ['titulo']);
  assert.equal(M.validar(next), true);
});

test('nenhuma mudança: não consome IDs, não grava histórico e mantém referência da coleção', () => {
  const lista = congelar(criar());
  let chamadas = 0;
  const next = M.salvar(lista, {titulo: '  ' + lista[0].titulo + '  ', historico: []}, lista[0].id, {now: NEXT, autor: 'Outra pessoa', uid() {chamadas += 1; return 'não utilizado';}});
  assert.strictEqual(next, lista);
  assert.equal(chamadas, 0);
});

test('arquivar e reabrir preserva conteúdo e registra a transição, sem excluir a inovação', () => {
  const original = congelar(criar({descricao: 'Preservar descoberta', aplicacao: 'Próxima obra'}));
  const id = original[0].id;
  const arquivada = M.salvar(original, {situacao: 'Arquivada'}, id, contexto(NEXT));
  assert.equal(arquivada.length, 1);
  assert.equal(arquivada[0].descricao, 'Preservar descoberta');
  assert.equal(arquivada[0].aplicacao, 'Próxima obra');
  assert.deepEqual(arquivada[0].historico.at(-1), {id: `teste-${NEXT}-1`, em: NEXT, autor: 'Pessoa de teste', tipo: 'situacao', texto: 'Campos atualizados: situação.', campos: ['situacao'], de: 'Para avaliar', para: 'Arquivada'});
  const aberta = M.salvar(congelar(arquivada), {situacao: 'Aplicar nas próximas obras'}, id, contexto('2026-10-16T12:00:00.000Z'));
  assert.equal(aberta[0].id, id);
  assert.equal(aberta[0].criadoEm, NOW);
  assert.equal(aberta[0].historico.length, 3);
  assert.equal(aberta[0].situacao, 'Aplicar nas próximas obras');
  assert.equal(M.validar(aberta), true);
});

test('ID sumido e snapshot concorrente: bloqueiam gravação sem recriar ou sobrescrever', () => {
  const original = congelar(criar());
  const id = original[0].id;
  assert.throws(() => M.salvar(original, {titulo: 'Outra'}, 'sumido', contexto(NEXT)), /não foi encontrada/);
  const next = M.salvar(original, {descricao: 'Outra pessoa editou'}, id, contexto(NEXT));
  assert.throws(() => M.salvar(next, {titulo: 'Meu rascunho'}, id, {...contexto(NEXT), base: original[0]}), /mudou/);
  assert.equal(next[0].titulo, original[0].titulo);
  const equivalente = Object.fromEntries(Object.entries(next[0]).reverse());
  assert.equal(M.salvar(next, {titulo: next[0].titulo}, id, {...contexto(NEXT), base: equivalente}), next);
});

test('identidade: gerador não reutiliza IDs de registros ou eventos e falha com colisões persistentes', () => {
  const initial = criar();
  const ocupados = [initial[0].id, initial[0].historico[0].id];
  const fila = [...ocupados, 'evento-novo', ...ocupados, 'item-novo'];
  const next = criar({titulo: 'Outra solução'}, congelar(initial), {now: NEXT, autor: 'Pessoa de teste', uid: () => fila.shift()});
  assert.equal(next[1].id, 'item-novo');
  assert.equal(next[1].historico[0].id, 'evento-novo');
  assert.equal(M.validar(next), true);
  assert.throws(() => criar({}, initial, {now: NEXT, autor: 'Pessoa de teste', uid: () => initial[0].id}), /identificador único/);
});

test('datas e autoria: falhas no contexto ou relógio anterior à última alteração são explícitas', () => {
  for (const ctx of [null, {}, {...contexto(), now: 'data-inválida'}, {...contexto(), autor: ''}, {...contexto(), autor: {}}, {...contexto(), uid: null}]) assert.throws(() => criar({}, [], ctx), /data e o autor/);
  const original = criar();
  assert.throws(() => M.salvar(original, {titulo: 'Revista'}, original[0].id, contexto('2026-10-13T12:00:00.000Z')), /anterior/);
  assert.equal(criar({}, [], contexto('2026-10-14T09:00:00-03:00'))[0].criadoEm, NOW);
});

test('backup: aceita coleção válida congelada sem normalizar ou alterar o conteúdo', () => {
  const lista = congelar(criar({referencia: 'https://example.test/'}));
  const antes = JSON.stringify(lista);
  assert.equal(M.validar(lista), true);
  assert.equal(JSON.stringify(lista), antes);
  const opcionalAusente = copia(lista);
  delete opcionalAusente[0].descricao;
  delete opcionalAusente[0].etapa;
  assert.equal(M.validar(opcionalAusente), true);
});

test('backup: rejeita coleção malformada, IDs duplicados, campos inesperados e conteúdo inválido', () => {
  const original = criar();
  const invalidas = [
    [null], [undefined], new Array(1), [[], {}], [...copia(original), ...copia(original)],
    [{...copia(original)[0], titulo: ''}], [{...copia(original)[0], titulo: 'a'.repeat(161)}],
    [{...copia(original)[0], descricao: 123}], [{...copia(original)[0], situacao: 'Outra'}],
    [{...copia(original)[0], referencia: 'javascript:alert(1)'}],
    [{...copia(original)[0], referencia: 'https://pessoa:senha@example.test'}],
    [{...copia(original)[0], extra: 'Campo estranho'}],
    [Object.assign(new Date(), copia(original)[0])], [Object.create(original[0])]
  ];
  for (const lista of invalidas) assert.throws(() => M.validar(lista));
  for (const campo of ['id', 'titulo', 'situacao', 'criadoEm', 'criadoPor', 'atualizadoEm', 'atualizadoPor', 'historico']) {
    const lista = copia(original); delete lista[0][campo];
    assert.throws(() => M.validar(lista), undefined, campo);
  }
});

test('backup: rejeita datas impossíveis e autoria ou histórico incoerentes', () => {
  const original = criar();
  for (const patch of [
    {criadoEm: '2026-02-30T12:00:00.000Z'}, {criadoEm: '14/10/2026'},
    {atualizadoEm: '2026-10-13T12:00:00.000Z'}, {criadoPor: ''}, {atualizadoPor: 'Autor trocado'},
    {historico: []}, {historico: [null]}, {historico: new Array(1)}, {historico: {}},
    {historico: [{...original[0].historico[0], id: original[0].id}]},
    {historico: [{...original[0].historico[0], tipo: 'apagamento'}]},
    {historico: [{...original[0].historico[0], em: NEXT}]},
    {historico: [{...original[0].historico[0], campos: new Array(1)}]},
    {historico: [{...original[0].historico[0], de: 'Para avaliar', para: 'Arquivada'}]},
    {historico: [{...original[0].historico[0], extra: true}]}
  ]) assert.throws(() => M.validar([{...copia(original)[0], ...patch}]));
  const editada = M.salvar(original, {situacao: 'Adotada'}, original[0].id, contexto(NEXT));
  for (const patch of [{de: 'Outra'}, {para: 'Outra'}, {de: 'Adotada', para: 'Adotada'}, {campos: ['titulo', 'titulo']}, {campos: ['estranho']}]) {
    const lista = copia(editada); Object.assign(lista[0].historico[1], patch);
    assert.throws(() => M.validar(lista));
  }
});

test('filtros: busca sem acentos nos campos úteis e combina etapa e situação sem alterar a lista', () => {
  const ctx = contexto();
  let lista = criar({titulo: 'Ventilação', descricao: 'Proteção acústica', aplicacao: 'Área técnica', etapa: 'Execução', referencia: 'https://example.test/manual'}, [], ctx);
  lista = criar({titulo: 'Outra ideia', descricao: 'Memorial', etapa: 'Projetos', situacao: 'Aplicar nas próximas obras'}, lista, ctx);
  lista = criar({titulo: 'Solução sem etapa', situacao: 'Arquivada'}, lista, ctx);
  congelar(lista);
  for (const texto of ['VENTILACAO', 'protecao acustica', 'area tecnica', 'execucao', 'example.test/manual']) assert.equal(M.filtrar(lista, {texto})[0].titulo, 'Ventilação');
  assert.equal(M.filtrar(lista, {etapa: 'EXECUCAO', situacao: 'para avaliar'}).length, 1);
  assert.equal(M.filtrar(lista, {etapa: 'Projetos', situacao: 'Para avaliar'}).length, 0);
  assert.equal(M.filtrar(lista, {etapa: 'sem-etapa'})[0].titulo, 'Solução sem etapa');
  assert.equal(M.filtrar(lista, {etapa: 'todas', situacao: 'Todas'}).length, 3);
  assert.equal(M.filtrar(lista, {texto: 'inexistente'}).length, 0);
  assert.equal(lista.length, 3);
  assert.notStrictEqual(M.filtrar(lista), lista);
});

test('resumo: números vêm da mesma coleção e contam separadamente avaliação, aplicação, adoção e arquivo', () => {
  const ctx = contexto();
  let lista = [];
  for (const situacao of [...M.SITUACOES, 'Aplicar nas próximas obras']) lista = criar({situacao}, lista, ctx);
  assert.deepEqual(M.resumo(congelar(lista)), {total: 5, aAplicar: 2, avaliar: 1, adotadas: 1, arquivadas: 1});
  const total = M.resumo(lista);
  assert.equal(total.total, total.aAplicar + total.avaliar + total.adotadas + total.arquivadas);
  for (const [situacao, quantidade] of M.SITUACOES.map(situacao => [situacao, situacao === 'Aplicar nas próximas obras' ? 2 : 1])) assert.equal(M.filtrar(lista, {situacao}).length, quantidade);
});
