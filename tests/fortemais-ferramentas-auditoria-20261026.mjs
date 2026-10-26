import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../publico/fortemais-ferramentas-modelo.js', import.meta.url), 'utf8');
vm.runInThisContext(source);
vm.runInThisContext(fs.readFileSync(new URL('../publico/fortemais-apoio-modelo.js', import.meta.url), 'utf8'));
vm.runInThisContext(fs.readFileSync(new URL('../publico/fortemais-materiais.js', import.meta.url), 'utf8'));
const M = globalThis.FortemaisFerramentasModelo;
const A = globalThis.FortemaisApoioModelo;
const example = id => structuredClone(M.catalogo.find(tool => tool.id === id).exemplo);
const record = (state, id, toolId, inputs, result = M.calcular(toolId, inputs)) => A.salvar(state, {nome:id, obraId:'obra-teste', ambiente:'Teste', etapa:toolId, elementoId:id, toolId, inputs, result}, null, {id});

test('concreto exige fornecimento explícito e conserva FCK na compra', () => {
  assert.throws(() => M.calcular('concreto', {...example('concreto'), modo:''}), /Fornecimento|opção/);
  let state;
  for (const fck of [20, 30]) state = record(state, 'fck-'+fck, 'concreto', {...example('concreto'), fck});
  const materials = A.consolidar(state);
  assert.equal(materials.length, 2);
  assert.match(materials[0].spec, /20 MPa/);
  assert.match(materials[1].spec, /30 MPa/);
  for (const fck of [0, -1, 'abc']) assert.throws(() => M.calcular('concreto', {...example('concreto'), fck}), /FCK/);
});

test('contagens comerciais rejeitam frações e contagens inseguras', () => {
  assert.throws(() => M.calcular('alvenaria', {...example('alvenaria'), milheiro:1.5}), /inteira/);
  assert.throws(() => M.calcular('pisos', {...example('pisos'), caixaArea:'', pecasCaixa:1.5}), /inteira/);
  assert.throws(() => M.calcular('malhas', {...example('malhas'), camadas:Number.MAX_SAFE_INTEGER+1}), /inteira|segura|limite/);
});

test('paisagismo exige os dois espaçamentos quando plantio é informado', () => {
  for (const patch of [{espacamentoY:''}, {espacamentoX:0}, {espacamentoX:''}]) {
    assert.throws(() => M.calcular('paisagismo', {...example('paisagismo'), ...patch}), /Espaçamento|espaçamento/);
  }
  assert.equal(M.calcular('paisagismo', {...example('paisagismo'), espacamentoX:'', espacamentoY:''}).materiais.length, 1);
});

test('arredondamento tolera apenas ruído decimal e preserva demanda positiva mínima', () => {
  const wall = M.calcular('alvenaria', {...example('alvenaria'), largura:1.6, altura:3.2, perdaPct:0});
  assert.equal(wall.materiais[0].liquido, 64);
  const waste = M.calcular('residuos', {volume:1e-12, caminhao:5});
  assert.equal(waste.metricas.find(m => m.label === 'Viagens / caçambas').value, 1);
  const earth = M.calcular('terra', {setores:[{area:1, profundidadeCm:1e-10}], reuso:0, fatorSolto:1, fatorNatural:1, caminhao:5});
  assert.equal(earth.metricas.find(m => m.label === 'Viagens de compra').value, 1);
});

test('aberturas válidas não dependem de caber lado a lado no desenho ilustrativo', () => {
  const inputs = {...example('alvenaria'), largura:4, altura:3, temAberturas:'sim', aberturas:[
    {tipo:'janela', largura:3, altura:1, quantidade:1, peitoril:.2},
    {tipo:'janela', largura:3, altura:1, quantidade:1, peitoril:1.8}
  ]};
  const result = M.calcular('alvenaria', inputs);
  assert.equal(result.metricas[0].value, 6);
  assert.equal(result.scene.noGeometry, true);
  assert.match(result.scene.caption, /posição|posições/);
  const floorWindow = M.calcular('alvenaria', {...inputs, aberturas:[{tipo:'janela', largura:1, altura:2, quantidade:1, peitoril:0}]});
  assert.equal(floorWindow.metricas[0].value, 10);
  assert.throws(() => M.calcular('alvenaria', {...inputs, aberturas:[{tipo:'porta', largura:5, altura:1, quantidade:1}]}), /largura|cabem|parede/);
});

test('paginação de telas limita a visualização sem percorrer bilhões de camadas', () => {
  const context = vm.createContext({structuredClone});
  vm.runInContext(source, context);
  const result = vm.runInContext("FortemaisFerramentasModelo.calcular('malhas', {largura:4,comprimento:6,painelLargura:2,painelComprimento:3,sobreposicao:0,camadas:1000000000,perdaPct:0})", context, {timeout:500});
  assert.equal(result.materiais[0].liquido, 4000000000);
  assert.ok(result.scene.elements.length <= 4000);
  assert.ok(result.avisos.some(s => /limitada/.test(s)));
});

test('gesso e reboco convertem consumo por milímetro sem alterar o coeficiente informado', () => {
  for (const id of ['gesso', 'reboco']) {
    const common = {...example(id), areas:[{largura:2, altura:5, faces:1}], espessuraCm:1, perdaPct:0, embalagem:20};
    const perCm = M.calcular(id, {...common, consumo:10, unidadeConsumo:'cm'});
    const perMm = M.calcular(id, {...common, consumo:1, unidadeConsumo:'mm'});
    assert.equal(perCm.materiais[0].liquido, 100);
    assert.equal(perMm.materiais[0].liquido, 100);
    assert.match(perMm.memoria.join(' '), /mm/);
  }
});

test('compra parcial exclui motor antigo e lista pendências sem alterar histórico', () => {
  let state = record(undefined, 'atual', 'concreto', example('concreto'));
  const oldResult = M.calcular('concreto', example('concreto')); oldResult.version = 'anterior';
  state = record(state, 'antiga', 'concreto', example('concreto'), oldResult);
  const before = JSON.stringify(state);
  const pending = A.pendenciasCompra(state, 'obra-teste', M.VERSION);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'antiga');
  const current = A.consolidar(state, 'obra-teste', {engineVersion:M.VERSION});
  assert.equal(current.length, 1);
  assert.ok(Math.abs(current[0].liquido-.6) < 1e-12);
  assert.equal(JSON.stringify(state), before);
  assert.equal(A.pendenciasCompra(state, 'outra-obra', M.VERSION).length, 0);
});

test('25 ferramentas continuam com exemplos finitos sem entrada mutada', () => {
  assert.equal(M.catalogo.length, 25);
  for (const tool of M.catalogo) {
    const inputs = example(tool.id), before = JSON.stringify(inputs);
    const result = M.calcular(tool.id, inputs);
    assert.equal(JSON.stringify(inputs), before, tool.id);
    const finite = value => {if (typeof value === 'number') assert.ok(Number.isFinite(value), tool.id); else if (value && typeof value === 'object') Object.values(value).forEach(finite)};
    finite(result);
  }
});

test('consumo e embalagem preenchidos pelo usuário preservam referências do preset', () => {
  const library = globalThis.FortemaisMateriais;
  for (const [id, completion, different] of [
    ['reboco-20', {consumo:1.5}, {embalagem:30}],
    ['knauf-1.8', {consumo:2}, {unidade:'m'}],
    ['piso-60-60', {caixaArea:2.16, pecasCaixa:6}, {pecaLargura:80}]
  ]) {
    const inputs = {...library.aplicar(id, {}), ...completion};
    assert.equal(library.selecionado(inputs)?.id, id);
    assert.ok(library.referencias(inputs).length > 0);
    assert.equal(library.selecionado({...inputs, ...different}), null);
  }
});

test('levantamentos independentes conferem quantidades e compra dos 25 exemplos fictícios', () => {
  // Valores de referência obtidos pelas medidas e unidades de cada exemplo, antes do arredondamento comercial.
  const expected = {
    alvenaria: [[188,207,207]], reboco: [[150,180,9]], gesso: [[150,180,9]],
    concreto: [[.6,.66,null]], malhas: [[18,18,18]], barras: [[12,24,2]],
    terra: [[2.4,2.4,null]], pisos: [[20,23.76,11]], rodape: [[16,18,18]],
    eletrica: [[12,13.2,null],[36,100,1]], hidraulica: [[15,24,4],[2,2,2]], esgoto: [[15,24,4],[2,2,2]],
    cobertura: [[48.16*Math.sqrt(1.09),54,36]], impermeabilizacao: [[76.2,90,5]], pintura: [[20,36,2]],
    contrapiso: [[1,1.1,null]], pavimentacao: [[1,1.1,null]], formas: [[15,17.6,8]],
    drywall: [[40,46.08,16],[60,66,22]], pecas: [[1.2,1.2,null]], paisagismo: [[20,21,42],[20,21,21]],
    produtividade: [], residuos: [], dados: [[23,100,1]], consumo: [[30,40,2]]
  };
  assert.equal(Object.keys(expected).length, 25);
  for (const [id, values] of Object.entries(expected)) {
    const result = M.calcular(id, example(id));
    assert.equal(result.materiais.length, values.length, id);
    values.forEach(([liquid, purchase, packages], i) => {
      const material = result.materiais[i];
      assert.ok(Math.abs(material.liquido-liquid) < 1e-9, id+' líquido '+i);
      assert.ok(Math.abs(material.compra-purchase) < 1e-9, id+' compra '+i);
      assert.equal(material.embalagens, packages, id+' embalagens '+i);
    });
    if (id === 'produtividade') assert.equal(result.metricas.find(m => m.label === 'Dias de equipe').value, 3.125);
    if (id === 'residuos') assert.equal(result.metricas.find(m => m.label === 'Viagens / caçambas').value, 3);
  }
});

test('compra distingue altura de rodapé, formato de manta e dimensões de peças', () => {
  for (const [tool, first, second] of [
    ['rodape', {...example('rodape'), produto:'Produto fictício', alturaCm:10}, {...example('rodape'), produto:'Produto fictício', alturaCm:15}],
    ['impermeabilizacao', {...example('impermeabilizacao'), produto:'Produto fictício', modo:'rolo', roloLargura:1, roloComprimento:10, sobreposicao:0}, {...example('impermeabilizacao'), produto:'Produto fictício', modo:'rolo', roloLargura:2, roloComprimento:5, sobreposicao:0}],
    ['pecas', {pecas:[{nome:'Vidro', material:'Material fictício', largura:2, altura:.6, quantidade:1}], perdaPct:0}, {pecas:[{nome:'Vidro', material:'Material fictício', largura:1.2, altura:1, quantidade:1}], perdaPct:0}]
  ]) {
    let state = record(undefined, tool+'-1', tool, first);
    state = record(state, tool+'-2', tool, second);
    assert.equal(A.consolidar(state).length, 2, tool);
    const same = record(record(undefined, tool+'-3', tool, first), tool+'-4', tool, first);
    assert.equal(A.consolidar(same).length, 1, tool+' mesma especificação');
  }
});

test('referências diferentes separam produtos e ausência de identidade conserva origens', () => {
  for (const tool of ['reboco','gesso','concreto','malhas','terra','pisos','rodape','cobertura','impermeabilizacao','pintura','formas']) {
    const first = {...example(tool), produto:'Referência fictícia A', ...(tool==='concreto'?{fck:25}:{})};
    const second = {...first, produto:'Referência fictícia B'};
    const distinct = record(record(undefined, 'a', tool, first), 'b', tool, second);
    assert.equal(A.consolidar(distinct).length, 2, tool+' produtos distintos');
    const same = record(record(undefined, 'a', tool, first), 'b', tool, first);
    assert.equal(A.consolidar(same).length, 1, tool+' produto identificado');
    const incomplete = {...first, produto:''};
    const pending = record(record(undefined, 'a', tool, incomplete), 'b', tool, incomplete);
    const materials = A.consolidar(pending);
    assert.equal(materials.length, 2, tool+' sem identidade');
    assert.ok(materials.every(m => m.identidadeCompraPendente && m.origemSimulacao), tool);
    assert.match(M.calcular(tool, incomplete).avisos.join(' '), /Referência de compra pendente/, tool);
  }
});

test('classes de aço diferentes conservam planos de corte separados', () => {
  const result = M.calcular('barras', {barra:12, perdaPct:0, pecas:[
    {comprimento:3, quantidade:1, diametro:10, material:'Classe fictícia A'},
    {comprimento:3, quantidade:1, diametro:10, material:'Classe fictícia B'}
  ]});
  assert.equal(result.materiais.length, 2);
  assert.ok(result.materiais.every(m => m.embalagens===1 && !m.identidadeCompraPendente));
});

test('cabos multipolares distinguem vias e mantêm metragem física', () => {
  const result = M.calcular('eletrica', {produto:'Eletroduto fictício', perdaPct:0, trechos:[
    {id:'T1', comprimento:10, condutores:4, secao:1.5, papel:'Cabo fictício', modo:'multipolar'},
    {id:'T1', comprimento:10, condutores:5, secao:1.5, papel:'Cabo fictício', modo:'multipolar'}
  ]});
  assert.equal(result.materiais.length, 3);
  assert.equal(result.materiais[0].liquido, 10);
  const cables = result.materiais.filter(m => m.nome==='Cabo');
  assert.deepEqual(cables.map(m => m.liquido), [10,10]);
  assert.match(cables[0].spec, /4 vias/);
  assert.match(cables[1].spec, /5 vias/);
});

test('descrições numéricas da tela rejeitam zero e valores inválidos', () => {
  for (const key of ['espacamento','diametro']) for (const value of [0,-1,'abc']) {
    assert.throws(() => M.calcular('malhas', {...example('malhas'), [key]:value}), /Espaçamento|Diâmetro/);
  }
});

test('parede totalmente descontada mantém compra zero sem criar superfície fictícia', () => {
  const result = M.calcular('alvenaria', {...example('alvenaria'), largura:2, altura:2, temAberturas:'sim', aberturas:[{tipo:'porta', largura:2, altura:2, quantidade:1}]});
  assert.equal(result.metricas[0].value, 0);
  assert.equal(result.materiais[0].compra, 0);
  assert.equal(result.scene.elements.length, 0);
  assert.equal(result.scene.noGeometry, true);
  assert.match(result.scene.caption, /zero/);
});

test('preset de piso fornece apenas formato e preserva a referência digitada', () => {
  const library = globalThis.FortemaisMateriais;
  const preset = library.catalogo.find(m => m.id==='piso-60-60');
  assert.equal(Object.hasOwn(preset.values, 'produto'), false);
  const blank = library.aplicar(preset.id, example('pisos')); blank.caixaArea=2.16;
  assert.equal(blank.produto, undefined);
  assert.equal(M.calcular('pisos', blank).materiais[0].identidadeCompraPendente, true);
  const known = library.aplicar(preset.id, {...example('pisos'), produto:'Produto fictício A'}); known.caixaArea=2.16;
  assert.equal(known.produto, 'Produto fictício A');
  assert.equal(M.calcular('pisos', known).materiais[0].identidadeCompraPendente, false);
});

test('descrição genérica herdada de formato não identifica produto nem muda o histórico', () => {
  const inputs = {...example('pisos'), produto:'Formato 60 × 60 cm', _modelo:'piso-60-60'};
  const before = JSON.stringify(inputs), result = M.calcular('pisos', inputs);
  assert.equal(result.materiais[0].identidadeCompraPendente, true);
  assert.equal(JSON.stringify(inputs), before);
  const state = record(record(undefined, 'formato-a', 'pisos', inputs), 'formato-b', 'pisos', inputs);
  const saved = JSON.stringify(state);
  assert.equal(A.consolidar(state).length, 2);
  assert.equal(JSON.stringify(state), saved);
  assert.equal(M.calcular('pisos', {...inputs, produto:'Produto fictício A 60 × 60 cm'}).materiais[0].identidadeCompraPendente, false);
});

test('embalagem de cimento é explícita e independente da embalagem do industrializado', () => {
  for (const tool of ['reboco','concreto']) {
    const field = M.catalogo.find(t => t.id===tool).campos.find(f => f.key==='embalagemCimentoKg');
    assert.ok(field);
    assert.equal(field.default, 50);
    assert.equal(field.unit, 'kg');
    assert.match(field.help, /50 kg.*referência inicial/);
    assert.match(field.help, /Confirme o peso/);
    const inputs = {...example(tool), modo:'composicao', cimento:300, areia:.5, perdaPct:0, embalagem:10, embalagemCimentoKg:25};
    const material = M.calcular(tool, inputs).materiais.find(m => /cimento/i.test(m.nome));
    assert.equal(material.embalagem, 25);
    assert.equal(material.embalagens, tool==='reboco'?12:8);
    for (const invalid of ['', null, 0, -1]) assert.throws(() => M.calcular(tool, {...inputs, embalagemCimentoKg:invalid}), /Embalagem de cimento/);
    const legacy = {...inputs}; delete legacy.embalagemCimentoKg;
    const previous = M.calcular(tool, legacy);
    assert.equal(previous.materiais.find(m => /cimento/i.test(m.nome)).embalagem, 50);
    assert.match(previous.avisos.join(' '), /50 kg.*compatibilidade|compatibilidade.*50 kg/);
  }
  assert.equal(M.catalogo.find(t => t.id==='gesso').campos.some(f => f.key==='embalagemCimentoKg'), false);
});
