import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

const css = readFileSync(new URL('../publico/empresas.css', import.meta.url), 'utf8');

/* Os bancos eram uma LISTA vertical: um por linha, e gerente e telefone
 * escondidos dentro do acordeão "Detalhes". */
test('bancos: os cartões ficam lado a lado, não empilhados', () => {
  /* Olha TODAS as regras da grade, não a primeira: uma regra antiga escondida
     mais acima já enganou este teste uma vez. */
  const regras = css.match(/\.bancos-grade\{[^}]*\}/g);
  assert.ok(!regras.some(r => /flex-direction:column/.test(r)), 'coluna era a lista antiga');
  assert.ok(regras.some(r => /display:grid/.test(r) && /repeat\(auto-fill,minmax\(\d+px,1fr\)\)/.test(r)),
    'a grade tem de caber quantos couberem na largura');
  assert.ok(!regras.some(r => /repeat\(2,/.test(r)), 'número fixo de colunas não acompanha a largura');
  // e no celular volta a uma coluna, senão o cartão fica ilegível
  assert.match(css, /@media\(max-width:600px\)[\s\S]*\.bancos-grade\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('bancos: nenhuma regra órfã da lista antiga ficou para trás', () => {
  assert.equal((css.match(/banco-linha/g) || []).length, 0,
    'regra morta faz a próxima pessoa confiar num layout que não existe mais');
});

const comBancos = (lista) => {
  const s = setup();
  s.run('E.bancos=' + JSON.stringify(lista) + ';bancosFonte={contas:[],erro:"",em:"",pendente:null}');
  return s;
};
const CONTA = {id: 'b1', banco: 'Banco de Teste', codigoBanco: '341', titular: 'Empresa Teste',
  agencia: '1234', conta: '56789-0', pix: 'chave@teste', gerente: 'Fulano de Tal', telefone: '(38) 99999-1234'};

test('bancos: número, gerente e telefone ficam no cartão, fora do acordeão', async () => {
  const {run, document} = comBancos([CONTA]);
  await run("(async()=>{atual='bancos';const m=document.getElementById('main');m.replaceChildren();await vBancos(m)})()");
  const card = document.querySelector('.banco-card');
  assert.ok(card, 'o cartão tem de existir');
  const detalhes = card.querySelector('.banco-detalhes');
  const foraDoAcordeao = n => n && !detalhes.contains(n);
  assert.ok(foraDoAcordeao(card.querySelector('.banco-codigo')), 'o número do banco à vista');
  assert.match(card.querySelector('.banco-codigo').textContent, /341/);
  assert.ok(foraDoAcordeao(card.querySelector('.banco-gerente')), 'o gerente à vista');
  assert.match(card.querySelector('.banco-gerente').textContent, /Fulano de Tal/);
  const fone = card.querySelector('.banco-fone');
  assert.ok(foraDoAcordeao(fone), 'o telefone à vista');
  /* O toque no número passou a abrir o WHATSAPP (pedido do dono, 24/09/2026).
     Isto é escolha, não regressão: este teste guardava `tel:` e foi virado de
     propósito. O link de ligar não sumiu, ficou ao lado — e é isso que as duas
     asserções abaixo protegem. */
  assert.equal(fone.getAttribute('href'), 'https://wa.me/5538999991234', 'o número abre o WhatsApp');
  assert.equal(card.querySelector('.banco-ligar').getAttribute('href'), 'tel:38999991234', 'e ligar continua a um toque');
});

test('bancos: sem logo, o crachá é o número do banco — emoji igual não distingue', async () => {
  const {run, document} = comBancos([CONTA, {...CONTA, id: 'b2', banco: 'Outro Banco', codigoBanco: '001'}]);
  await run("(async()=>{atual='bancos';const m=document.getElementById('main');m.replaceChildren();await vBancos(m)})()");
  const crachas = [...document.querySelectorAll('.banco-icone')].map(n => n.textContent.trim());
  assert.deepEqual(crachas.sort(), ['001', '341'], 'cada banco com o seu número');
});

test('bancos: sem gerente nem telefone, o cartão diz que falta', async () => {
  const {run, document} = comBancos([{id: 'b3', banco: 'Sem contato', titular: 'X'}]);
  await run("(async()=>{atual='bancos';const m=document.getElementById('main');m.replaceChildren();await vBancos(m)})()");
  assert.match(document.querySelector('.banco-contato').textContent, /Sem gerente ou telefone cadastrado/);
});

/* O DONO ABRIU A TELA E NÃO VIU NÚMERO NENHUM: quase nenhuma conta tem o campo
 * preenchido. O número passa a ser deduzido do nome — mas um código errado vai
 * para dentro de uma TED, então o caso ruim vem primeiro. */
test('código do banco: casa por palavra inteira, e nome desconhecido não inventa', () => {
  const {run} = setup();
  const k = n => run(`bancoConhecido(${JSON.stringify(n)})`);
  assert.equal(k('Sicoob Credinor').codigo, '756');
  assert.equal(k('BANCO DO BRASIL S.A.').codigo, '001');
  assert.equal(k('Itaú Unibanco').codigo, '341', 'acento não separa');
  assert.equal(k('Caixa Econômica Federal').codigo, '104');
  // os que NÃO podem casar
  assert.equal(k('Banco Interior de Crédito'), null, '"interior" não é o Inter');
  assert.equal(k('Banestado'), null, '"banestado" não é Banestes');
  assert.equal(k('Cooperativa Qualquer'), null, 'sem correspondência, nada');
  assert.equal(k(''), null);
});

test('código do banco: o cadastro vence a dedução, e a dedução vem marcada', () => {
  const {run} = setup();
  const c = b => run(`codigoDoBanco(${JSON.stringify(b)})`);
  assert.deepEqual({...c({banco: 'Sicoob Credinor', codigoBanco: '999'})}, {codigo: '999', deduzido: false},
    'quem cadastrou conferiu; o app não corrige por cima');
  assert.deepEqual({...c({banco: 'Sicoob Credinor'})}, {codigo: '756', deduzido: true});
  assert.equal(c({banco: 'Banco Desconhecido'}), null);
  // código cadastrado fora do formato não é usado como se fosse válido
  assert.deepEqual({...c({banco: 'Sicoob Credinor', codigoBanco: '75'})}, {codigo: '756', deduzido: true});
});

test('bancos: o número aparece no cartão mesmo sem estar cadastrado, dizendo que é deduzido', async () => {
  const s = setup();
  s.run('E.bancos=[{id:"x",banco:"Sicoob Credinor",titular:"Empresa Teste",agencia:"3144",conta:"74.448-4"}];bancosFonte={contas:[],erro:"",em:"",pendente:null}');
  s.run("atual='bancos';const m=document.getElementById('main');m.replaceChildren();vBancos(m)");
  const selo = s.document.querySelector('.banco-codigo');
  assert.ok(selo, 'o selo do número tem de existir');
  assert.match(selo.textContent, /Banco 756/);
  assert.ok(selo.classList.contains('banco-codigo-deduzido'), 'deduzido tem de parecer deduzido');
  assert.match(selo.getAttribute('title') || '', /Confira e salve no cadastro/);
  assert.equal(s.document.querySelector('.banco-icone').textContent.trim(), '756', 'o crachá vira o número');
});

/* A LATERAL É UM NÓ SÓ: abas em cima, empresas embaixo. Quando eram dois nós
   irmãos, a grade pôs a barra de abas sozinha na coluna e a lista de empresas
   atravessou a direita — foi assim que a tela quebrou. */
test('bancos: abas e empresas moram na mesma coluna da esquerda', () => {
  assert.match(css, /\.bancos-layout\{display:grid;grid-template-columns:\d+px minmax\(0,1fr\)/);
  assert.match(css, /\.bancos-layout>\.bancos-lateral\{grid-column:1/, 'a lateral inteira na coluna 1');
  assert.match(css, /\.bancos-layout>\.workspace-pane\{grid-column:2/, 'o conteúdo na coluna 2');
  assert.match(css, /\.bancos-lateral \.workspace-tabs\{flex-direction:column/, 'abas uma abaixo da outra');
  assert.match(css, /\.bancos-layout \.bancos-empresas\{flex-direction:column/, 'empresas empilhadas');
  // e volta a ser fileira quando não há lateral
  assert.match(css, /@media\(max-width:860px\)\{[\s\S]*\.bancos-layout\{display:block\}/);
});

test('bancos: no DOM, a barra de abas e a lista de empresas estão dentro da lateral', () => {
  const s = setup();
  s.run('E.bancos=[{id:"b",banco:"X",titular:"T"}];E.contabilidades=[];bancosFonte={contas:[],erro:"",em:"",pendente:null}');
  s.run("atual='bancos';const m=document.getElementById('main');m.replaceChildren();vBancos(m)");
  const lat = s.document.querySelector('.bancos-lateral');
  assert.ok(lat, 'a lateral tem de existir');
  assert.ok(lat.querySelector('.workspace-tabs'), 'as abas dentro dela');
  assert.ok(lat.querySelector('.bancos-empresas'), 'e a lista de empresas também');
  // o painel fica só com as contas
  const pane = s.document.querySelector('#bancos-bancos');
  assert.equal(pane.querySelector('.bancos-empresas'), null, 'a lista não pode voltar para o painel');
  assert.ok(pane.querySelector('.bancos-grade'), 'o painel fica com os cartões');
});

/* O amarelo do Banco do Brasil com texto branco dá 1,1:1 e o número some.
 * Crachá que não se lê não identifica banco nenhum. */
test('bancos: o número no crachá lê em qualquer cor de marca', () => {
  const {run} = setup();
  const cores = [...run("BANCOS_BR.map(b=>b[2])")];
  assert.ok(cores.length >= 20, 'a tabela encolheu');
  for (const cor of cores) {
    const txt = run(`corTextoSobre(${JSON.stringify(cor)})`);
    const r = run(`contrasteEntre(${JSON.stringify(cor)},${JSON.stringify(txt === '#fff' ? '#ffffff' : txt)})`);
    assert.ok(r >= 4.5, `${cor} com ${txt} dá ${r.toFixed(2)}:1`);
  }
});

/* wa.me exige 55 + DDD + número colados. Errar não dá erro na tela: abre
 * conversa com OUTRA pessoa. O caso ruim vem primeiro. */
test('whatsapp: número sem DDD não vira link — inventar DDD manda para outra cidade', () => {
  const {run} = setup();
  const z = t => run(`numeroWhatsapp(${JSON.stringify(t)})`);
  assert.equal(z('99918-8350'), '', 'nove dígitos são telefone sem DDD');
  assert.equal(z('3218-4600'), '', 'oito dígitos idem');
  assert.equal(z(''), '');
  assert.equal(z('não tenho'), '');
  assert.equal(z('1234'), '', 'ramal não é celular');
});

test('whatsapp: com DDD ganha o 55, e quem já tem não ganha de novo', () => {
  const {run} = setup();
  const z = t => run(`numeroWhatsapp(${JSON.stringify(t)})`);
  assert.equal(z('(38) 99918-8350'), '5538999188350');
  assert.equal(z('38999188350'), '5538999188350');
  assert.equal(z('(38) 3218-4600'), '553832184600', 'fixo com DDD também');
  assert.equal(z('5538999188350'), '5538999188350', 'não duplica o 55');
  assert.equal(z('+1 415 555 2671'), '14155552671', 'internacional vai como está');
});

test('bancos: o telefone abre o WhatsApp, e ligar continua a um toque', () => {
  const s = setup();
  s.run('E.bancos=[{id:"x",banco:"Sicoob Credinor",titular:"Empresa",gerente:"Rodney",telefone:"38999188350"}];bancosFonte={contas:[],erro:"",em:"",pendente:null}');
  s.run("atual='bancos';const m=document.getElementById('main');m.replaceChildren();vBancos(m)");
  const zap = s.document.querySelector('.banco-zap');
  assert.ok(zap, 'o número tem de virar link de WhatsApp');
  assert.equal(zap.getAttribute('href'), 'https://wa.me/5538999188350');
  assert.equal(zap.getAttribute('target'), '_blank');
  assert.match(zap.getAttribute('rel') || '', /noopener/, 'link externo sem dar acesso à janela');
  const ligar = s.document.querySelector('.banco-ligar');
  assert.ok(ligar, 'o telefone de ligar não pode sumir');
  assert.equal(ligar.getAttribute('href'), 'tel:38999188350');
});

test('bancos: sem DDD, o cartão mantém o link de ligar e não monta WhatsApp', () => {
  const s = setup();
  s.run('E.bancos=[{id:"y",banco:"Banco X",titular:"Empresa",telefone:"3218-4600"}];bancosFonte={contas:[],erro:"",em:"",pendente:null}');
  s.run("atual='bancos';const m=document.getElementById('main');m.replaceChildren();vBancos(m)");
  assert.equal(s.document.querySelector('.banco-zap'), null);
  // o href de telefone leva só os dígitos; o traço é do texto, não do link
  assert.equal(s.document.querySelector('.banco-fone').getAttribute('href'), 'tel:32184600');
  assert.match(s.document.querySelector('.banco-fone').textContent, /3218-4600/, 'na tela, o número como foi escrito');
});

test('bancos: a logo da empresa fica do tamanho da do banco', () => {
  const tam = r => Number((css.match(new RegExp(r))||[])[1]);
  const banco = tam(/\.banco-icone\{width:(\d+)px/);
  const empresa = tam(/\.banco-titular-logo\{[^}]*width:(\d+)px/);
  assert.ok(banco >= 38 && empresa >= 34, `banco ${banco}px, empresa ${empresa}px`);
  assert.ok(Math.abs(banco - empresa) <= 6, `desequilibradas: ${banco}px contra ${empresa}px`);
});
