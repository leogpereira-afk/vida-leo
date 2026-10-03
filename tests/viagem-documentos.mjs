import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const viagem={id:'viagem-teste',evento:'Férias',cidade:'Paris',ida:'2030-06-01',volta:'2030-06-15',viajantes:['Léo','Pedro Henrique']};
function abrir(documentos=[]){
  const a=setup();
  a.ctx.docsIniciais=documentos;
  a.ctx.viagemTeste=viagem;
  a.run('E.documentos=structuredClone(docsIniciais);E.viagens=[structuredClone(viagemTeste)];modalViagem(E.viagens[0])');
  return a;
}
function botao(document,rotulo){
  const b=document.querySelector(`[aria-label="${rotulo}"]`);
  assert.ok(b,rotulo);
  return b;
}

test('Passaporte ausente abre Documentos com pessoa e tipo preenchidos, sem criar antes de confirmar',()=>{
  const {run,document}=abrir([{id:'leo',nome:'Passaporte',dono:'Léo',validade:'2033-01-01'}]);
  botao(document,'Cadastrar Passaporte de Pedro Henrique').click();
  assert.equal(run('atual'),'documentos');
  assert.equal(document.querySelectorAll('#modais .fundo').length,1);
  assert.equal(document.querySelector('[name="dono"]').value,'Pedro Henrique');
  assert.equal(document.querySelector('[name="nome"]').value,'Passaporte');
  assert.equal(run('E.documentos.length'),1);
  assert.equal(run('filtro.docPessoa'),'Pedro Henrique');
  assert.equal(document.querySelector('[aria-label="Pessoa do documento"]').value,'Pedro Henrique');
  document.querySelector('[name="validade"]').value='2035-01-01';
  document.querySelector('.dev-form').onsubmit({preventDefault(){}});
  assert.equal(run('E.documentos.length'),2);
  assert.equal(run('E.documentos[1].dono'),'Pedro Henrique');
  assert.equal(run('E.documentos[1].nome'),'Passaporte');
});

test('Passaporte vencido abre o registro existente daquela pessoa para corrigir',()=>{
  const {run,document}=abrir([
    {id:'leo',nome:'Passaporte',dono:'Léo',validade:'2033-01-01'},
    {id:'pedro',nome:'Passaporte',dono:'Pedro Henrique',validade:'2028-01-01'},
  ]);
  botao(document,'Abrir Passaporte de Pedro Henrique').click();
  assert.equal(run('atual'),'documentos');
  assert.equal(document.querySelectorAll('#modais .fundo').length,1);
  assert.match(document.querySelector('[role="dialog"]').textContent,/Pedro Henrique/);
  assert.equal(document.querySelector('[role="dialog"] input[type="date"]').value,'2028-01-01');
  assert.equal(run('E.documentos.length'),2);
  assert.equal(run('E.documentos[1].id'),'pedro');
});

test('Atalho encontra pelo ID o documento atualizado enquanto a viagem estava aberta',()=>{
  const {run,document}=abrir([{id:'pedro',nome:'Passaporte',dono:'Pedro Henrique',validade:'2028-01-01'}]);
  run("E=structuredClone(E);E.documentos[0].validade='2027-01-01'");
  botao(document,'Abrir Passaporte de Pedro Henrique').click();
  assert.equal(document.querySelector('[role="dialog"] input[type="date"]').value,'2027-01-01');
  assert.equal(run('E.documentos.length'),1);
});

test('Visto não cadastrado pode ser conferido sem tratar ausência como exigência confirmada',()=>{
  const {run,document}=abrir([{id:'leo',nome:'Passaporte',dono:'Léo',validade:'2033-01-01'}]);
  assert.match(document.querySelector('.docs').textContent,/confira se o destino exige/);
  botao(document,'Conferir Visto de Pedro Henrique').click();
  assert.equal(run('atual'),'documentos');
  assert.equal(document.querySelector('[name="dono"]').value,'Pedro Henrique');
  assert.equal(document.querySelector('[name="nome"]').value,'Visto');
  assert.equal(run('E.documentos.length'),1);
});

test('Reforço de vacina leva aos cuidados de Saúde, sem abrir cadastro de documento',()=>{
  const {run,document}=abrir([{id:'leo',nome:'Passaporte',dono:'Léo',validade:'2033-01-01'}]);
  run("E.vacinas=[{id:'v1',vacina:'Febre amarela',viagem:'Sim',proxima:'2029-01-01'}];document.querySelector('#modais .fundo .fechar').click();modalViagem(E.viagens[0])");
  botao(document,'Ver vacina Febre amarela de Léo').click();
  assert.equal(run('atual'),'saude');
  assert.equal(document.querySelectorAll('#modais .fundo').length,0);
  assert.ok(document.querySelector('[data-bid="sa-vac"]'));
});
