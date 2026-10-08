import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../publico/fortemais-demandas-modelo.js';

const M = globalThis.FortemaisDemandasModelo;
const TODAY = '2026-10-08';
const NOW = `${TODAY}T12:00:00.000Z`;
const TOMORROW = '2026-10-09T12:00:00.000Z';

function contexto(now = NOW) {
  let sequence = 0;
  return {now, autor: 'Léo', uid: () => `gerado-${now}-${++sequence}`};
}

function congelar(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) congelar(child);
    Object.freeze(value);
  }
  return value;
}

function dados() {
  return {etapas: [{id: 'e1', nome: 'Execução'}, {id: 'e2', nome: 'Vistoria'}], itens: []};
}

function criada(input = {}, data = dados(), ctx = contexto()) {
  return M.salvarDemanda(data, {titulo: 'Conferir o projeto', ...input}, null, ctx);
}

function item(id, changes = {}) {
  return {id, titulo: id, descricao: '', etapaId: '', responsavel: '', envolvidos: '',
    prazo: '', prioridade: 'normal', situacao: 'A fazer', proximaAcao: '',
    motivoBloqueio: '', aguardandoQuem: '', retornoPendente: '', checklist: [], links: [],
    historico: [], criadoEm: NOW, atualizadoEm: NOW, concluidoEm: null, ...changes};
}

function ids(items) {
  return items.map(row => row.id);
}

test('dados: obra antiga ganha estrutura vazia sem mutação e obra atual conserva a referência', () => {
  const antiga = congelar({id: 'obra', vendaValor: 500000});
  assert.deepEqual(M.dados(antiga), {etapas: [], itens: []});
  assert.equal(Object.hasOwn(antiga, 'fmDemandas'), false);
  const atual = {fmDemandas: dados()};
  assert.strictEqual(M.dados(atual), atual.fmDemandas);
});

test('criação: normaliza textos, aplica padrões e usa identidade e autoria do contexto', () => {
  const data = congelar(dados());
  const next = criada({id: 'id-injetado', titulo: '  Conferir o projeto  ', descricao: '  Revisão  ',
    responsavel: '  João  ', envolvidos: '  Léo e Ana  ', proximaAcao: '  Telefonar  '}, data);
  const demanda = next.itens[0];
  assert.notStrictEqual(next, data);
  assert.equal(data.itens.length, 0);
  assert.match(demanda.id, /^gerado-/);
  assert.notEqual(demanda.id, 'id-injetado');
  assert.equal(demanda.titulo, 'Conferir o projeto');
  assert.equal(demanda.descricao, 'Revisão');
  assert.equal(demanda.responsavel, 'João');
  assert.equal(demanda.envolvidos, 'Léo e Ana');
  assert.equal(demanda.proximaAcao, 'Telefonar');
  assert.equal(demanda.situacao, 'A fazer');
  assert.equal(demanda.prioridade, 'normal');
  assert.equal(demanda.etapaId, '');
  assert.equal(demanda.prazo, '');
  assert.deepEqual(demanda.checklist, []);
  assert.deepEqual(demanda.links, []);
  assert.equal(demanda.criadoEm, NOW);
  assert.equal(demanda.atualizadoEm, NOW);
  assert.equal(demanda.concluidoEm, null);
  assert.equal(demanda.historico[0].tipo, 'criacao');
  assert.equal(demanda.historico[0].em, NOW);
  assert.equal(demanda.historico[0].autor, 'Léo');
});

test('validação: título obrigatório e edição exige uma demanda existente', () => {
  for (const titulo of ['', '   ', null]) {
    assert.throws(() => M.salvarDemanda(dados(), {titulo}, null, contexto()));
  }
  assert.throws(() => M.salvarDemanda(dados(), {descricao: 'Sem título'}, null, contexto()));
  assert.throws(() => M.salvarDemanda(dados(), {titulo: 'Outra'}, 'desconhecida', contexto()));
  assert.throws(() => M.situacao(dados(), 'desconhecida', 'Resolvida', contexto()));
});

test('edição parcial: preserva campos omitidos, identidades e dados financeiros da obra', () => {
  const inicial = criada({etapaId: 'e1', descricao: 'Memorial', responsavel: 'João', prazo: '2026-10-10',
    checklist: [{id: 'c1', texto: 'Conferir planta', feito: true}],
    links: [{id: 'l1', nome: 'Projeto', url: 'https://example.test/projeto'}]});
  const obra = congelar({id: 'o1', vendaValor: 800000, impostoValor: 48000,
    fmPrevisao: {venda: 900000, investidores: [{id: 's1', aporte: 200000}]}, fmDemandas: inicial});
  const before = JSON.stringify(obra);
  const old = inicial.itens[0];
  const next = M.salvarDemanda(M.dados(obra), {titulo: 'Projeto conferido'}, old.id, contexto(TOMORROW));
  assert.equal(JSON.stringify(obra), before);
  assert.equal(next.itens[0].id, old.id);
  assert.equal(next.itens[0].titulo, 'Projeto conferido');
  for (const field of ['descricao', 'responsavel', 'prazo', 'etapaId', 'checklist', 'links', 'criadoEm']) {
    assert.deepEqual(next.itens[0][field], old[field], field);
  }
  assert.deepEqual(next.itens[0].historico.slice(0, old.historico.length), old.historico);
  assert.equal(next.itens[0].historico.at(-1).tipo, 'edicao');
  assert.equal(next.itens[0].atualizadoEm, TOMORROW);
});

test('histórico: resolver, repetir e reabrir preservam eventos anteriores e datas de conclusão', () => {
  const ctx = contexto();
  const initial = criada({}, dados(), ctx);
  const id = initial.itens[0].id;
  const closed = M.situacao(congelar(initial), id, 'Resolvida', contexto(TOMORROW));
  const demanda = closed.itens[0];
  assert.equal(demanda.situacao, 'Resolvida');
  assert.equal(demanda.concluidoEm, TOMORROW);
  assert.deepEqual(demanda.historico.slice(0, initial.itens[0].historico.length), initial.itens[0].historico);
  assert.equal(demanda.historico.at(-1).tipo, 'situacao');
  assert.equal(demanda.historico.at(-1).de, 'A fazer');
  assert.equal(demanda.historico.at(-1).para, 'Resolvida');
  const duplicate = M.situacao(congelar(closed), id, 'Resolvida', contexto('2026-10-10T12:00:00.000Z'));
  assert.strictEqual(duplicate, closed);
  assert.equal(duplicate.itens[0].concluidoEm, TOMORROW);
  const reopened = M.situacao(closed, id, 'Em andamento', contexto('2026-10-11T12:00:00.000Z'));
  assert.equal(reopened.itens[0].concluidoEm, null);
  assert.equal(reopened.itens[0].historico.at(-1).de, 'Resolvida');
  assert.equal(reopened.itens[0].historico.at(-1).para, 'Em andamento');
  assert.deepEqual(reopened.itens[0].historico.slice(0, demanda.historico.length), demanda.historico);
});

test('observações: acrescenta evento sem permitir que um formulário substitua o histórico', () => {
  const initial = criada();
  const old = initial.itens[0];
  const next = M.salvarDemanda(congelar(initial), {observacao: '  Vistoria confirmada  ', historico: [],
    id: 'id-substituto', criadoEm: '2000-01-01T00:00:00.000Z', concluidoEm: NOW},
    old.id, contexto(TOMORROW));
  const current = next.itens[0];
  assert.deepEqual(current.historico.slice(0, old.historico.length), old.historico);
  const observation = current.historico.filter(event => event.tipo === 'observacao');
  assert.equal(observation.length, 1);
  assert.equal(observation[0].texto, 'Vistoria confirmada');
  assert.equal(observation[0].em, TOMORROW);
  assert.equal(Object.hasOwn(current, 'observacao'), false);
  assert.equal(current.id, old.id);
  assert.equal(current.criadoEm, old.criadoEm);
  assert.equal(current.concluidoEm, null);
  assert.equal(new Set(current.historico.map(event => event.id)).size, current.historico.length);
});

test('sem alteração: campos equivalentes e observação vazia não geram gravação ou histórico', () => {
  const initial = congelar(criada());
  const old = initial.itens[0];
  const next = M.salvarDemanda(initial, {titulo: `  ${old.titulo}  `, observacao: '   '}, old.id,
    contexto(TOMORROW));
  assert.strictEqual(next, initial);
  assert.strictEqual(M.situacao(initial, old.id, 'A fazer', contexto(TOMORROW)), initial);
});

test('prazos: rejeita datas impossíveis, admite ano bissexto e só atrasa após o dia do prazo', () => {
  for (const prazo of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10',
    '2026-10-00', '2026-1-01', '08/10/2026', '2026-10-08T00:00:00Z']) {
    assert.throws(() => criada({prazo}), prazo);
  }
  assert.equal(criada({prazo: '2028-02-29'}).itens[0].prazo, '2028-02-29');
  assert.equal(M.atrasada(item('ontem', {prazo: '2026-10-07'}), TODAY), true);
  assert.equal(M.atrasada(item('hoje', {prazo: TODAY}), TODAY), false);
  assert.equal(M.atrasada(item('amanha', {prazo: '2026-10-09'}), TODAY), false);
  assert.equal(M.atrasada(item('vazio'), TODAY), false);
  assert.equal(M.atrasada(item('resolvida', {prazo: '2026-10-07', situacao: 'Resolvida'}), TODAY), false);
});

test('links: aceita endereços http(s), preserva IDs e rejeita protocolos executáveis ou locais', () => {
  const next = criada({links: [{id: 'site', nome: '  Referência  ', url: '  https://example.test/projeto?a=1  '},
    {id: 'http', nome: 'Consulta', url: 'http://example.test/consulta'}]});
  assert.equal(next.itens[0].links[0].id, 'site');
  assert.equal(next.itens[0].links[0].nome, 'Referência');
  assert.equal(next.itens[0].links[0].url, 'https://example.test/projeto?a=1');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd',
    'mailto:pessoa@example.test', '//example.test', '/arquivo.pdf', 'https://']) {
    assert.throws(() => criada({links: [{nome: 'Inseguro', url}]}), url);
  }
});

test('etapas: impede vínculo externo e remover etapa mantém demanda, itens e histórico anterior', () => {
  assert.throws(() => criada({etapaId: 'etapa-de-outra-obra'}));
  const initial = criada({etapaId: 'e1', checklist: [{id: 'c1', texto: 'Verificar', feito: true}]});
  const old = initial.itens[0];
  const next = M.salvarEtapas(congelar(initial), [{id: 'e2', nome: '  Vistoria final  '}], contexto(TOMORROW));
  assert.deepEqual(next.etapas, [{id: 'e2', nome: 'Vistoria final'}]);
  assert.equal(next.itens.length, 1);
  assert.equal(next.itens[0].id, old.id);
  assert.equal(next.itens[0].etapaId, '');
  assert.deepEqual(next.itens[0].checklist, old.checklist);
  assert.deepEqual(next.itens[0].historico.slice(0, old.historico.length), old.historico);
  assert.equal(next.itens[0].historico.at(-1).tipo, 'edicao');
  assert.equal(initial.itens[0].etapaId, 'e1');
});

test('checklist: alternar conclusão preserva IDs, ordem e demais entradas sem mutar a origem', () => {
  const initial = criada({checklist: [{id: 'c1', texto: '  Conferir memorial  ', feito: false},
    {id: 'c2', texto: 'Revisar planta', feito: true}]});
  const old = initial.itens[0];
  assert.equal(old.checklist[0].texto, 'Conferir memorial');
  const changed = old.checklist.map(row => row.id === 'c1' ? {...row, feito: true} : row);
  const next = M.salvarDemanda(congelar(initial), {checklist: changed}, old.id, contexto(TOMORROW));
  assert.deepEqual(ids(next.itens[0].checklist), ['c1', 'c2']);
  assert.deepEqual(next.itens[0].checklist.map(row => row.feito), [true, true]);
  assert.equal(initial.itens[0].checklist[0].feito, false);
  assert.deepEqual(next.itens[0].checklist[1], old.checklist[1]);
});

test('identidades: aceita IDs explícitos novos e rejeita colisões entre listas e demandas', () => {
  const ctx = contexto();
  const next = M.salvarEtapas(dados(), [{id: 'nova', nome: 'Entrega'}], ctx);
  assert.equal(next.etapas[0].id, 'nova');
  assert.throws(() => M.salvarEtapas(dados(), [{id: 'x', nome: 'A'}, {id: 'x', nome: 'B'}], contexto()));
  assert.throws(() => criada({checklist: [{id: 'x', texto: 'A'}, {id: 'x', texto: 'B'}]}));
  assert.throws(() => criada({links: [{id: 'x', nome: 'A', url: 'https://example.test/a'},
    {id: 'x', nome: 'B', url: 'https://example.test/b'}]}));
  assert.throws(() => criada({checklist: [{id: 'x', texto: 'A'}],
    links: [{id: 'x', nome: 'A', url: 'https://example.test/a'}]}));
  const first = congelar(criada({checklist: [{id: 'c1', texto: 'A'}],
    links: [{id: 'l1', nome: 'Referência', url: 'https://example.test/a'}]}));
  assert.throws(() => criada({titulo: 'Outra', checklist: [{id: 'c1', texto: 'B'}]}, first));
  assert.throws(() => criada({titulo: 'Outra', links: [{id: 'l1', nome: 'Outra',
    url: 'https://example.test/b'}]}, first));
});

test('resumo: bloqueadas e atrasadas também contam como abertas, com resolvidas separadas', () => {
  const data = {etapas: [], itens: [item('aberta'), item('atrasada', {prazo: '2026-10-07'}),
    item('bloqueada', {situacao: 'Bloqueada', prazo: '2026-10-07'}),
    item('aguardando', {situacao: 'Aguardando terceiro'}),
    item('resolvida', {situacao: 'Resolvida', prazo: '2026-10-07', concluidoEm: NOW})]};
  congelar(data);
  assert.deepEqual(M.resumo(data, TODAY), {abertas: 4, atrasadas: 2, bloqueadas: 1, resolvidas: 1});
  assert.deepEqual(new Set(ids(M.filtrar(data, {resumo: 'abertas'}, TODAY))),
    new Set(['aberta', 'atrasada', 'bloqueada', 'aguardando']));
  assert.deepEqual(new Set(ids(M.filtrar(data, {resumo: 'atrasadas'}, TODAY))), new Set(['atrasada', 'bloqueada']));
  assert.deepEqual(ids(M.filtrar(data, {resumo: 'bloqueadas'}, TODAY)), ['bloqueada']);
  assert.deepEqual(ids(M.filtrar(data, {resumo: 'resolvidas'}, TODAY)), ['resolvida']);
});

test('filtros: combina etapa, situação e responsável; busca ignora acentos e inclui detalhes', () => {
  const data = {etapas: dados().etapas, itens: [
    item('certo', {titulo: 'Aprovação técnica', descricao: 'Revisão do projeto', etapaId: 'e1',
      responsavel: 'João', envolvidos: 'Márcia', proximaAcao: 'Conferir fundação', situacao: 'Em andamento'}),
    item('outra-etapa', {titulo: 'Aprovação técnica', etapaId: 'e2', responsavel: 'João', situacao: 'Em andamento'}),
    item('outra-pessoa', {titulo: 'Aprovação técnica', etapaId: 'e1', responsavel: 'Ana', situacao: 'Em andamento'}),
    item('outro-status', {titulo: 'Aprovação técnica', etapaId: 'e1', responsavel: 'João', situacao: 'Bloqueada'}),
    item('sem-vinculo'),
  ]};
  congelar(data);
  assert.deepEqual(ids(M.filtrar(data, {texto: 'aprovacao tecnica', etapa: 'e1', responsavel: 'JOAO',
    situacao: 'Em andamento'}, TODAY)), ['certo']);
  for (const texto of ['REVISAO', 'marcia', 'FUNDACAO']) {
    assert.deepEqual(ids(M.filtrar(data, {texto}, TODAY)), ['certo'], texto);
  }
  assert.deepEqual(ids(M.filtrar(data, {etapa: 'sem-etapa'}, TODAY)), ['sem-vinculo']);
  assert.deepEqual(ids(M.filtrar(data, {responsavel: 'sem-responsavel'}, TODAY)), ['sem-vinculo']);
});

test('ordenação: abertas antes de resolvidas; atraso, prioridade e prazo ordenam o trabalho', () => {
  const rows = [
    item('resolvida-antiga', {situacao: 'Resolvida', concluidoEm: '2026-10-01T12:00:00.000Z'}),
    item('normal-longe', {prazo: '2026-10-20'}),
    item('alta-sem-prazo', {prioridade: 'alta'}),
    item('atrasada-baixa', {prioridade: 'baixa', prazo: '2026-10-01'}),
    item('resolvida-recente', {situacao: 'Resolvida', concluidoEm: NOW}),
    item('normal-perto', {prazo: '2026-10-09'}),
    item('alta-perto', {prioridade: 'alta', prazo: '2026-10-10'}),
    item('atrasada-alta', {prioridade: 'alta', prazo: '2026-10-07'}),
    item('baixa', {prioridade: 'baixa', prazo: TODAY}),
  ];
  const data = congelar({etapas: [], itens: rows});
  assert.deepEqual(ids(M.filtrar(data, {}, TODAY)), ['atrasada-alta', 'atrasada-baixa',
    'alta-perto', 'alta-sem-prazo', 'normal-perto', 'normal-longe', 'baixa',
    'resolvida-recente', 'resolvida-antiga']);
  assert.deepEqual(ids(data.itens), rows.map(row => row.id));
});
