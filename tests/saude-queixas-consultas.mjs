/* As três listas que a Saúde não tinha: o que eu SINTO (queixa), a quem eu FUI
 * (consulta) e a fisioterapia sessão a sessão. O que estes testes guardam:
 *   - que os três quadros aparecem na tela e não caem no Resumo por engano;
 *   - que o retorno da consulta chega em "Datas para acompanhar";
 *   - que uma instalação antiga, sem essas chaves no backup, não quebra.
 *   node --test tests/saude-queixas-consultas.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const comSaude = (estado) => {
  const {run, document} = setup();
  run(estado + ";vSaude(document.getElementById('main'))");
  return document;
};

test('Saúde: os três quadros novos existem e ficam na aba Queixas e consultas', () => {
  const {run, document} = setup();
  run(`E.queixas=[{id:'q',data:'2026-09-01',oque:'dor no ombro',onde:'Ombro',intensidade:7,situacao:'Ativa'}];
       E.consultas=[{id:'c',data:'2026-09-05',especialidade:'Ortopedia',profissional:'Dra. Exemplo'}];
       E.fisio=[{id:'f',data:'2026-09-10',oque:'ombro direito',sessao:1,total:10,dorAntes:7,dorDepois:4}];
       vSaude(document.getElementById('main'))`);
  for (const id of ['sa-quei', 'sa-cons', 'sa-fisio'])
    assert.ok(document.querySelector('[data-bid="' + id + '"]'), 'falta o quadro ' + id);
  /* O valor de um <input> NÃO aparece em textContent — a linha é editável, os
     dados moram em .value. Conferir pelo texto do quadro dava falso negativo
     com a tela funcionando: o <select> aparecia (as <option> são texto) e o
     que a pessoa digitou, não. Confere-se o que está nos campos. */
  const preenchido = (id) => {
    const q = document.querySelector('[data-bid="' + id + '"]');
    assert.ok(q, 'falta o quadro ' + id);
    assert.equal(q.querySelectorAll('tbody tr').length, 1, id + ' não desenhou a linha do registro');
    return [...q.querySelectorAll('input,select,textarea')].map((c) => c.value).join(' | ');
  };
  assert.match(preenchido('sa-quei'), /dor no ombro/);
  assert.match(preenchido('sa-cons'), /Ortopedia/);
  assert.match(preenchido('sa-fisio'), /ombro direito/);
  /* O catch-all de abaDoBlocoSaude é 'resumo': quadro não nomeado NÃO some --
     cai no meio dos KPIs, e o defeito parece só desorganização. */
  for (const id of ['sa-quei', 'sa-cons', 'sa-fisio'])
    assert.equal(run(`abaDoBlocoSaude('${id}')`), 'queixas', id + ' caiu na aba errada');
});

test('Saúde: o retorno da consulta entra em Datas para acompanhar', () => {
  const d = comSaude(`E.consultas=[{id:'c',data:'2026-09-05',especialidade:'Ortopedia',retorno:'2026-12-01'}]`);
  const lembretes = d.querySelector('.saude-lembretes');
  assert.ok(lembretes);
  assert.match(lembretes.textContent, /Ortopedia/);
  assert.match(lembretes.textContent, /Retorno de consulta/);
});

/* Consulta SEM retorno não pode virar uma linha de lembrete vazia — a lista é
   "o que vem aí", e item sem data não vem aí nunca. */
test('Saúde: consulta sem retorno não vira lembrete', () => {
  const d = comSaude(`E.consultas=[{id:'c',data:'2026-09-05',especialidade:'Ortopedia',retorno:''}]`);
  assert.doesNotMatch(d.querySelector('.saude-lembretes').textContent, /Ortopedia/);
});

/* Data quebrada tem de cair fora do lembrete, e não ser ordenada como texto no
   meio das datas boas. */
test('Saúde: retorno com data inválida não entra na lista', () => {
  const d = comSaude(`E.consultas=[{id:'c',especialidade:'Ortopedia',retorno:'05/12/2026'},{id:'d',especialidade:'Cardio',retorno:'2026-13-45'}]`);
  const t = d.querySelector('.saude-lembretes').textContent;
  assert.doesNotMatch(t, /Ortopedia/);
  assert.doesNotMatch(t, /Cardio/);
});

/* O caso que mais quebra app pessoal: o backup de ontem não tem as chaves de
   hoje. Se `carregar()` não as recriasse, vSaude estouraria em E.queixas.filter
   e a tela de Saúde inteira sumiria — não só os quadros novos. */
test('Saúde: backup antigo, sem as chaves novas, não derruba a tela', () => {
  const {run, document} = setup();
  run(`localStorage.getItem=()=>JSON.stringify({viagens:[],peso:[],exames:[]});
       E=carregar();vSaude(document.getElementById('main'))`);
  assert.equal(run('JSON.stringify([Array.isArray(E.queixas),Array.isArray(E.consultas),Array.isArray(E.fisio)])'), '[true,true,true]');
  assert.ok(document.querySelector('[data-bid="sa-quei"]'), 'a tela não desenhou');
});

test('Saúde: registro sem id ganha um na carga (o anexo é ligado por ele)', () => {
  const {run} = setup();
  run(`localStorage.getItem=()=>JSON.stringify({viagens:[],queixas:[{oque:'dor'}],consultas:[{especialidade:'Ortopedia'}],fisio:[{oque:'ombro'}]});E=carregar()`);
  assert.equal(run('JSON.stringify([!!E.queixas[0].id,!!E.consultas[0].id,!!E.fisio[0].id])'), '[true,true,true]');
});

test('Saúde: o menu do topo oferece queixa, consulta e fisioterapia', () => {
  const {run, document} = setup();
  run(`vSaude(document.getElementById('main'))`);
  const t = document.querySelector('.painel').textContent;
  for (const r of [/Queixa/, /Consulta/, /fisio/i]) assert.match(t, r);
});
