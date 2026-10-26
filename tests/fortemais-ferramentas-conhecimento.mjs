import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const modeloSource = fs.readFileSync(new URL('../publico/fortemais-ferramentas-modelo.js', import.meta.url), 'utf8');
const conhecimentoSource = fs.readFileSync(new URL('../publico/fortemais-ferramentas-conhecimento.js', import.meta.url), 'utf8');
const contexto = vm.createContext({structuredClone});
vm.runInContext(modeloSource, contexto);
const modelo = contexto.FortemaisFerramentasModelo;
const catalogoOriginal = JSON.stringify(modelo.catalogo);
vm.runInContext(conhecimentoSource, contexto);
const conhecimento = contexto.FortemaisConhecimento;

test('cada uma das 25 ferramentas tem guia próprio, sem sobras ou duplicatas', () => {
  const idsModelo = Array.from(modelo.catalogo, item => item.id).sort();
  const idsGuias = Array.from(conhecimento.catalogo, item => item.id).sort();
  assert.equal(idsModelo.length, 25);
  assert.deepEqual(idsGuias, idsModelo);
  assert.equal(new Set(idsGuias).size, 25);
  for (const guia of conhecimento.catalogo) assert.equal(conhecimento.porFerramenta(guia.id), guia);
});

test('guias fornecem todas as seções em texto, adequadas a detalhes recolhíveis', () => {
  for (const guia of conhecimento.catalogo) {
    assert.ok(guia.objetivo.trim(), guia.id);
    for (const secao of ['dados', 'formula', 'cuidados', 'dependencias']) {
      assert.ok(Array.isArray(guia[secao]) && guia[secao].length > 0, `${guia.id}: ${secao}`);
      for (const texto of guia[secao]) {
        assert.equal(typeof texto, 'string');
        assert.ok(texto.trim().length > 15, `${guia.id}: ${secao}`);
        assert.doesNotMatch(texto, /<\/?[a-z][^>]*>/i, 'conteúdo editorial não deve incluir HTML');
      }
    }
  }
});

test('referências têm HTTPS, fonte primária, descrição e data de consulta', () => {
  const hosts = new Set([
    'abcp.org.br', 'www.quartzolit.weber', 'www.placo.com.br',
    'voce.mais.gerdau.com.br', 'www2.gerdau.com.br', 'www.gov.br',
    'www.portobello.com.br', 'br.prysmian.com', 'tigresite.s3.amazonaws.com',
    'www.brasilit.com.br', 'www.viapol.com.br', 'www.suvinil.com.br',
    'www.caixa.gov.br', 'knauf.com', 'www.cebrace.com.br',
    'www.infoteca.cnptia.embrapa.br', 'meioambiente.mg.gov.br', 'www.furukawalatam.com'
  ]);
  for (const guia of conhecimento.catalogo) {
    assert.ok(guia.fontes.length > 0, guia.id);
    for (const fonte of guia.fontes) {
      const url = new URL(fonte.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(hosts.has(url.hostname), fonte.url);
      assert.equal(url.username, '');
      assert.equal(url.password, '');
      assert.ok(fonte.titulo.trim() && fonte.trecho.trim());
      assert.equal(fonte.consultadoEm, '2026-10-26');
    }
  }
});

test('as diferenças de unidade e as fontes de dupla contagem estão documentadas', () => {
  const texto = id => JSON.stringify(conhecimento.porFerramenta(id));
  assert.match(texto('gesso'), /kg\/m²\/mm/);
  assert.match(texto('gesso'), /1 cm = 10 mm/);
  assert.match(texto('gesso'), /converte a espessura automaticamente/);
  assert.match(texto('gesso'), /sem multiplicá-lo novamente por 10/);
  assert.match(texto('pintura'), /acabado já considera/);
  assert.match(texto('impermeabilizacao'), /Não multiplicar novamente/);
  assert.match(texto('drywall'), /já incluem perdas/);
  assert.match(texto('terra'), /numerador e denominador/);
  assert.match(texto('consumo'), /já inclui perdas/);
});

test('conhecimento não altera catálogo, cálculos ou coeficientes do modelo', () => {
  assert.equal(contexto.FortemaisFerramentasModelo, modelo);
  assert.equal(JSON.stringify(modelo.catalogo), catalogoOriginal);
  assert.equal(typeof modelo.calcular, 'function');
  const isolado = vm.createContext({});
  vm.runInContext(conhecimentoSource, isolado);
  assert.equal(isolado.FortemaisConhecimento.catalogo.length, 25, 'não depende de DOM ou do modelo');
  assert.equal(isolado.FortemaisFerramentasModelo, undefined);
});

test('API só consulta ids conhecidos e conteúdo compartilhado é imutável', () => {
  for (const id of ['inexistente', '__proto__', 'constructor', '', undefined, null, 1]) {
    assert.equal(conhecimento.porFerramenta(id), null);
  }
  const gesso = conhecimento.porFerramenta('gesso');
  assert.ok(Object.isFrozen(conhecimento));
  assert.ok(Object.isFrozen(conhecimento.catalogo));
  assert.ok(Object.isFrozen(gesso));
  assert.ok(Object.isFrozen(gesso.fontes[0]));
  assert.throws(() => { gesso.formula[0] = 'alterado'; }, TypeError);
  assert.throws(() => { gesso.fontes[0].url = 'javascript:alert(1)'; }, TypeError);
});
