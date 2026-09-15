/* As cinco melhorias da Saúde. O que cada teste guarda é a coisa que volta:
   número calculado e jogado fora, coluna que ninguém consulta, lista que não
   ordena por urgência, preferência salva e ignorada, e vínculo que aponta para
   um nome em vez de um id. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const tela = (estado = '') => {
  const {run, document} = setup();
  run("E.perfil=Object.assign({},E.perfil,{nascimento:'1980-01-01'});E.queixas=[];E.consultas=[];E.fisio=[];E.exames=[];E.vacinas=[];E.tratamentos=[];E.peso=[];E.vitais=[];"
      + estado + ";vSaude(document.getElementById('main'))");
  return {run, document};
};
const cartao = (document, titulo) => [...document.querySelectorAll('.kpi')]
  .find(k => k.textContent.includes(titulo));

test('1. IMC e cintura/altura aparecem em vez de serem calculados e jogados fora', () => {
  const {document} = tela("E.peso=[{id:'p',data:'2026-01-10',peso:84,altura:1.78,cintura:91}]");
  const imc = cartao(document, 'IMC');
  assert.ok(imc, 'não há cartão de IMC');
  assert.match(imc.textContent, /26,5/);                 // 84 / 1,78² = 26,51
  assert.match(imc.textContent, /sobrepeso/);
  const cint = cartao(document, 'Cintura');
  assert.ok(cint, 'não há cartão de cintura/altura');
  assert.match(cint.textContent, /0,51/);                // 91 / 178
});

test('1b. sem altura, o cartão diz o que falta em vez de mostrar número errado', () => {
  const {document} = tela("E.peso=[{id:'p',data:'2026-01-10',peso:84}]");
  assert.match(cartao(document, 'IMC').textContent, /Informe altura/);
});

test('2. fim de tratamento entra em Datas para acompanhar', () => {
  const {document} = tela("E.tratamentos=[{id:'t',oque:'Fisioterapia ombro',fim:'2030-04-01',status:'Em andamento'},{id:'t2',oque:'Antigo',fim:'2030-05-01',status:'Encerrado'}]");
  const lista = document.querySelector('.saude-lembretes').textContent;
  assert.match(lista, /Fisioterapia ombro/);
  assert.match(lista, /Fim de tratamento/);
  assert.ok(!/Antigo/.test(lista), 'tratamento encerrado não pode cobrar data');
});

test('3. o rastreio mais urgente fica em cima', () => {
  const {run} = tela();
  const ordem = JSON.parse(run("JSON.stringify(rastreiosPendentes(true).slice().sort((a,b)=>(a.venceEm??-9999)-(b.venceEm??-9999)).map(x=>x.venceEm))"));
  const semNulos = ordem.filter(v => v != null);
  assert.deepEqual(semNulos, [...semNulos].sort((a, b) => a - b), 'a lista não está em ordem de urgência');
  if (ordem.includes(null)) assert.equal(ordem[0], null, 'nunca feito tem de vir antes do atrasado');
});

test('4. recolher um quadro gruda: a tela não força mais tudo aberto', () => {
  const {run, document} = setup();
  run("E.colapso['sa-trat']=true;E.perfil=Object.assign({},E.perfil,{nascimento:'1980-01-01'});vSaude(document.getElementById('main'));organizarSaude(document.getElementById('main'))");
  const b = document.querySelector('[data-bid="sa-trat"]');
  assert.ok(b, 'quadro sumiu');
  assert.ok(b.classList.contains('fechado'), 'a escolha de recolher foi ignorada de novo');
});

test('5. a ligação guarda o ID da queixa, não o nome', () => {
  const {run, document} = tela("E.queixas=[{id:'q1',data:'2026-09-01',oque:'dor no ombro',situacao:'Ativa'}];E.consultas=[{id:'c1',data:'2026-09-05',especialidade:'Ortopedia',queixaId:'q1'}];E.fisio=[{id:'f1',data:'2026-09-10',oque:'ombro',queixaId:'q1'}]");
  const sel = [...document.querySelectorAll('[data-bid="sa-cons"] select')].find(s => s.value === 'q1');
  assert.ok(sel, 'a consulta não está apontando para o id da queixa');
  const op = [...sel.querySelectorAll('option')].find(o => o.value === 'q1');
  assert.match(op.textContent, /dor no ombro/, 'o rótulo tem de mostrar o texto da queixa');
  /* renomear a queixa NÃO pode soltar o vínculo — é para isso que se guarda o id */
  run("E.queixas[0].oque='dor no ombro direito';vSaude(document.getElementById('main'))");
  assert.equal(run("E.consultas[0].queixaId"), 'q1');
});

test('5b. a queixa mostra o que está amarrado nela', () => {
  const {document} = tela("E.queixas=[{id:'q1',data:'2026-09-01',oque:'dor no ombro'}];E.consultas=[{id:'c1',data:'2026-09-05',queixaId:'q1'}];E.fisio=[{id:'f1',data:'2026-09-10',queixaId:'q1'},{id:'f2',data:'2026-09-12',queixaId:'q1'}]");
  const linha = document.querySelector('[data-bid="sa-quei"] tbody tr').textContent;
  assert.match(linha, /1 consulta/);
  assert.match(linha, /2 sess/);
});

test('5c. vínculo apontando para queixa apagada não some calado', () => {
  const {document} = tela("E.queixas=[];E.consultas=[{id:'c1',data:'2026-09-05',queixaId:'sumiu'}]");
  const sel = [...document.querySelectorAll('[data-bid="sa-cons"] select')].find(s => s.value === 'sumiu');
  assert.ok(sel, 'o valor órfão foi descartado em silêncio');
});

/* A mesma armadilha existia em Gastos e Rendimentos — telas de análise, onde a
   regra do Léo é antiga: quadro recolhível, com a escolha guardada. A escolha
   era gravada pelo bloco() e desfeita no organizador, a cada render. */
test('Gastos: recolher um quadro gruda, como na Saúde', () => {
  const {run, document} = setup();
  run("E.colapso={};E.gastos=[{id:'g',data:hoje(),valor:10,categoria:'Casa',descricao:'x'}]");
  const bid = run(`(()=>{const m=document.getElementById('main');m.replaceChildren();vGastos(m);
    const b=[...m.querySelectorAll('.bloco')].map(x=>x.dataset.bid).filter(Boolean)[0];return b||''})()`);
  assert.ok(bid, 'não achei quadro na tela de gastos');
  run(`E.colapso[${JSON.stringify(bid)}]=true;
       const m=document.getElementById('main');m.replaceChildren();vGastos(m);organizarFinanceiro(m,'gastos')`);
  const b = document.querySelector('[data-bid="' + bid + '"]');
  assert.ok(b, 'o quadro sumiu');
  assert.ok(b.classList.contains('fechado'), 'a escolha de recolher foi ignorada de novo');
});
