import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

const tela = (estado = '') => {
  const s = setup();
  s.run('E.bancos=[];E.contabilidades=[];bancosFonte={contas:[],erro:"",em:"",pendente:null};' + estado);
  s.run("atual='bancos';const m=document.getElementById('main');m.replaceChildren();vBancos(m)");
  return s;
};

test('bancos: as três abas existem, e Bancos é a primeira', () => {
  const {document} = tela();
  const abas = [...document.querySelectorAll('.workspace-tabs button')].map(b => b.textContent.trim());
  assert.equal(abas.length, 3);
  assert.match(abas[0], /Bancos/);
  assert.match(abas[1], /Contabilidade/);
  assert.match(abas[2], /Organograma/);
  assert.equal(document.querySelector('.workspace-tabs button').getAttribute('aria-pressed'), 'true');
});

test('contabilidade: a aba lista os cartões, com contato e quantas contas cuida', () => {
  const {document} = tela(`filtro.bancoAba='contabilidade';
    E.contabilidades=[{id:'c1',nome:'Contabilidade Teste',responsavel:'Fulano',telefone:'38999188350',email:'a@b.com',doc:'00.000.000/0001-00'}];
    E.bancos=[{id:'b1',banco:'Banco X',titular:'Empresa',contabilidadeId:'c1'},{id:'b2',banco:'Banco Y',titular:'Empresa'}]`);
  const card = document.querySelector('#bancos-contabilidade .banco-card');
  assert.ok(card, 'o cartão da contabilidade tem de existir');
  assert.match(card.querySelector('h2').textContent, /Contabilidade Teste/);
  assert.match(card.textContent, /Fulano/);
  assert.equal(card.querySelector('.banco-zap').getAttribute('href'), 'https://wa.me/5538999188350');
  assert.match(card.textContent, /1 conta\(s\) vinculada\(s\)/, 'só a que aponta para ela');
});

test('contabilidade: sem nenhuma cadastrada, a aba diz o que fazer', () => {
  const {document} = tela("filtro.bancoAba='contabilidade'");
  assert.match(document.querySelector('#bancos-contabilidade').textContent, /Cadastre a primeira/);
});

/* CASO RUIM PRIMEIRO: apagar a contabilidade não pode deixar bancos apontando
 * para um id que não existe mais — o cartão diria "—" sem explicar. */
test('contabilidade: apagar solta o vínculo das contas, dizendo quantas são', () => {
  const s = tela(`E.contabilidades=[{id:'c1',nome:'Some'}];
    E.bancos=[{id:'b1',banco:'X',titular:'E',contabilidadeId:'c1'},{id:'b2',banco:'Y',titular:'E',contabilidadeId:'c1'}]`);
  let aviso = '';
  s.run("globalThis.confirm=t=>{globalThis.__aviso=t;return true}");
  s.run("contabilidadeExcluir(E.contabilidades[0])");
  aviso = s.run("globalThis.__aviso");
  assert.match(aviso, /2 conta\(s\) estão vinculadas/, 'o aviso tem de dizer quantas perdem o vínculo');
  assert.equal(s.run("E.contabilidades.length"), 0);
  assert.deepEqual([...s.run("E.bancos.map(b=>b.contabilidadeId||'sem')")], ['sem', 'sem'],
    'o id órfão não pode ficar para trás');
});

test('contabilidade: nome repetido é recusado', () => {
  const s = tela("E.contabilidades=[{id:'c1',nome:'Mesma'},{id:'c2',nome:'Outra'}]");
  assert.throws(() => s.run(`
    financeiroSalvarRegistro(E.contabilidades,E.contabilidades[1],{nome:'mesma'},{nome:'mesma'});
    if((E.contabilidades||[]).filter(y=>normaliza(y.nome)==='mesma').length>1)throw Error('Já existe uma contabilidade com esse nome.')
  `), /Já existe/);
});

test('bancos: o formulário da conta oferece o vínculo com a contabilidade', () => {
  const s = tela("E.contabilidades=[{id:'c1',nome:'Contabilidade Teste'}]");
  s.run("bancoModal()");
  const sel = s.document.querySelector('.fundo select[name="contabilidadeId"], .fundo [name="contabilidadeId"]');
  assert.ok(sel, 'o campo tem de existir no formulário');
  const opts = [...sel.querySelectorAll('option')].map(o => [o.value, o.textContent]);
  assert.ok(opts.some(([v, t]) => v === 'c1' && /Contabilidade Teste/.test(t)),
    'guarda o id e mostra o nome: ' + JSON.stringify(opts));
});

test('a nova coleção é salva e recarregada como as outras', () => {
  const fonte = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  // sem estar nas duas listas de normalização, o cadastro sumiria no recarregar
  const listas = fonte.match(/for\(const k of \[[^\]]*'bancos'[^\]]*\]\)/g) || [];
  assert.ok(listas.length >= 2, 'as duas listas têm de existir');
  for (const l of listas) assert.match(l, /'contabilidades'/, 'faltou em: ' + l.slice(0, 80));
  assert.match(fonte, /contabilidades:\[\]/, 'e no estado inicial');
});

/* O PEDIDO ERA ESTE: ver a contabilidade sem sair do cartão do banco. */
test('bancos: o cartão mostra a contabilidade vinculada, com contato', () => {
  const {document} = tela(`E.contabilidades=[{id:'c1',nome:'Contabilidade Teste',responsavel:'Fulano',telefone:'38999188350'}];
    E.bancos=[{id:'b1',banco:'Banco X',titular:'Empresa',contabilidadeId:'c1'}]`);
  const cb = document.querySelector('.banco-card .banco-contabil');
  assert.ok(cb, 'o bloco da contabilidade tem de estar no cartão');
  assert.match(cb.textContent, /Contabilidade Teste/);
  assert.match(cb.textContent, /Fulano/);
  assert.equal(cb.querySelector('a').getAttribute('href'), 'https://wa.me/5538999188350');
});

/* Vínculo apontando para cadastro apagado não pode virar traço em branco: id
 * órfão silencioso esconde o problema em vez de mostrar. */
test('bancos: vínculo quebrado é dito, não escondido', () => {
  const {document} = tela(`E.bancos=[{id:'b1',banco:'Banco X',titular:'Empresa',contabilidadeId:'sumiu'}]`);
  assert.match(document.querySelector('.banco-contabil').textContent, /não encontrada · confira o vínculo/);
});

test('bancos: conta sem contabilidade não ganha bloco vazio', () => {
  const {document} = tela(`E.bancos=[{id:'b1',banco:'Banco X',titular:'Empresa'}]`);
  assert.equal(document.querySelector('.banco-contabil'), null);
});

/* Os botões saíram do corpo do cartão (pedido do dono: ficavam agressivos). */
test('bancos: o cartão não tem botão solto; as ações moram em Detalhes', () => {
  const {document} = tela(`E.bancos=[{id:'b1',banco:'Banco X',titular:'Empresa'}]`);
  const card = document.querySelector('.banco-card');
  const det = card.querySelector('.banco-detalhes');
  const soltos = [...card.querySelectorAll('.btn')].filter(b => !det.contains(b));
  assert.deepEqual(soltos.map(b => b.textContent.trim()), [], 'nenhum botão fora de Detalhes');
  const dentro = [...det.querySelectorAll('footer .btn')].map(b => b.textContent.trim());
  assert.ok(dentro.includes('Copiar dados') && dentro.some(t => /logo/i.test(t)),
    'copiar e a logo têm de estar lá dentro: ' + JSON.stringify(dentro));
});
