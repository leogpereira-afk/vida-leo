import test from 'node:test';
import assert from 'node:assert/strict';
import '../publico/holding-modelo.js';
const { centavos, resumo, salvarImovel, salvarPagamento, validarCarteira } = globalThis.HoldingModelo;

const propriedade = (totalCentavos = 100000) => salvarImovel([], { id: 'imovel-a', nome: 'Imóvel de demonstração', totalCentavos });
const lancamento = (id, valorCentavos, descricao = '') => ({ id, data: '2026-03-12', valorCentavos, descricao });

test('aceita notação brasileira e decimais simples sem arredondar nem confundir milhares', () => {
  for (const [texto, valor] of [
    ['R$ 1.234.567,89', 123456789], ['1.234', 123400], ['12.34', 1234], ['12,3', 1230],
    ['0,01', 1], ['1250', 125000], ['0', 0], ['', null], [null, null]
  ]) assert.equal(centavos(texto), valor);
  for (const texto of ['1,239', '1.2.3', '-2', '42x', '1.23,45', '1e2', '9007199254740992']) {
    assert.throws(() => centavos(texto));
  }
});

test('a soma dos lançamentos calcula saldo, percentual pago e quitação ao centavo', () => {
  let itens = propriedade(10001);
  assert.deepEqual(resumo(itens[0]), { pago: 0, saldo: 10001, percentual: 0, status: 'Em pagamento' });
  itens = salvarPagamento(itens, 'imovel-a', lancamento('p1', 10000));
  assert.equal(resumo(itens[0]).saldo, 1);
  assert.ok(resumo(itens[0]).percentual < 100);
  assert.equal(resumo(itens[0]).status, 'Em pagamento');
  itens = salvarPagamento(itens, 'imovel-a', lancamento('p2', 1));
  assert.deepEqual(resumo(itens[0]), { pago: 10001, saldo: 0, percentual: 100, status: 'Quitado' });
});

test('pagamentos sem total ficam identificados e passam a representar um percentual quando o total é informado', () => {
  let itens = propriedade(null);
  itens = salvarPagamento(itens, 'imovel-a', lancamento('p1', 25000));
  assert.deepEqual(resumo(itens[0]), { pago: 25000, saldo: null, percentual: null, status: 'A informar' });
  itens = salvarImovel(itens, { id: 'imovel-a', totalCentavos: 100000 });
  assert.equal(resumo(itens[0]).percentual, 25);
});

test('pagamento repetido pelo mesmo ID permanece único e correção guarda a versão anterior', () => {
  const base = propriedade();
  let itens = salvarPagamento(base, 'imovel-a', lancamento('p1', 10000, 'Entrada'));
  const versaoAntes = JSON.stringify(itens);
  assert.equal(salvarPagamento(itens, 'imovel-a', lancamento('p1', 10000, 'Entrada')), itens);
  const editado = salvarPagamento(itens, 'imovel-a', { id: 'p1', data: '2026-03-14', valorCentavos: 9999, descricao: 'Revisada' });
  assert.equal(JSON.stringify(itens), versaoAntes);
  assert.equal(base[0].pagamentos.length, 0);
  assert.equal(editado[0].pagamentos.length, 1);
  const p = editado[0].pagamentos[0];
  assert.equal(p.historico.length, 1);
  assert.equal(p.historico[0].data, '2026-03-12');
  assert.equal(p.historico[0].valorCentavos, 10000);
  assert.equal(p.historico[0].descricao, 'Entrada');
  assert.equal(resumo(editado[0]).pago, 9999);
  assert.deepEqual(validarCarteira(JSON.parse(JSON.stringify(editado))), editado);
});

test('correções preservam outros imóveis, informações extras e lançamentos existentes', () => {
  let itens = propriedade();
  itens = salvarImovel(itens, { id: 'imovel-b', nome: 'Outra unidade', totalCentavos: 50000 });
  itens[0].origem = 'registro de teste';
  itens = salvarPagamento(itens, 'imovel-b', lancamento('b1', 50000));
  const segundo = itens[1];
  const revisada = salvarImovel(itens, { id: 'imovel-a', nome: 'Primeira unidade' });
  const final = salvarPagamento(revisada, 'imovel-a', lancamento('a1', 10000));
  assert.equal(final[1], segundo);
  assert.equal(final[0].origem, 'registro de teste');
  assert.equal(final[0].totalCentavos, 100000);
  assert.equal(resumo(final[1]).status, 'Quitado');
});

test('recusa histórico malformado ou com data inválida ao reler os dados', () => {
  const itens = salvarPagamento(propriedade(), 'imovel-a', lancamento('p1', 1000));
  const [p] = itens[0].pagamentos;
  p.historico = 'danificado';
  assert.throws(() => validarCarteira(itens), /histórico/);
  p.historico = [{ data: '2026-02-30', valorCentavos: 700 }];
  assert.throws(() => validarCarteira(itens), /data/);
  assert.throws(() => validarCarteira([null]), /imóvel/);
});

test('recusa excedente, redução de custo abaixo do pago e registros inválidos sem alterar a carteira', () => {
  const itens = salvarPagamento(propriedade(), 'imovel-a', lancamento('p1', 60000));
  const antes = JSON.stringify(itens);
  assert.throws(() => salvarPagamento(itens, 'imovel-a', lancamento('p2', 40001)), /ultrapassa/);
  assert.throws(() => salvarImovel(itens, { id: 'imovel-a', totalCentavos: 59999 }), /ultrapassa/);
  for (const valor of [-1, 0, 1.2, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => salvarPagamento(itens, 'imovel-a', lancamento('invalido', valor)));
    assert.throws(() => salvarImovel(itens, { id: 'imovel-a', totalCentavos: valor }));
  }
  assert.throws(() => salvarPagamento(itens, 'imovel-a', { ...lancamento('p2', 1), data: '2026-02-29' }), /data/);
  assert.throws(() => salvarPagamento(itens, '', lancamento('p2', 1)), /identificador/);
  assert.throws(() => salvarPagamento(itens, 'outro', lancamento('p2', 1)), /encontrado/);
  assert.throws(() => salvarImovel(itens, { id: 'imovel-b', nome: '   ' }), /nome/);
  assert.throws(() => validarCarteira([...itens, itens[0]]), /identificador/);
  assert.equal(JSON.stringify(itens), antes);
});
