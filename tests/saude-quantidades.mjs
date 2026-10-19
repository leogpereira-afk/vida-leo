import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
function app(extra=''){
  const a=setup();a.run(`tela=()=>{};atual='saude';var t={id:'quantidade-ficticia',oque:'Item fictício',tipo:'Medicamento',status:'Em andamento',unidade:'unidade',estoqueInicial:'10.0000',consumoPorCiclo:'1.0000',usos:[{id:'uso-ficticio',data:'2020-01-01',hora:'08:00',quantidade:'0.0001'}]};E.tratamentos=[t];${extra}`);return a;
}
test('linha preserva fração pequena e usa und sem mudar o cadastro',()=>{
  const a=app(),antes=a.run('JSON.stringify(E)');a.run('document.body.append(quadroItensTratamento([t],{}))');
  assert.match(a.document.querySelector('.trat-usos-tabela strong').textContent,/^0,0001 und$/);
  assert.equal(a.document.querySelector('[name=quantidade]').value,'1');assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('formatação remove somente zeros decimais sobrando e preserva precisão e inteiros',()=>{
  const a=app();for(const [valor,esperado] of [['1.0000','1'],['0.5000','0,5'],['0.0001','0,0001'],['1.23456789','1,23456789'],[1000,'1.000'],[0,'0']])assert.equal(a.run(`SaudeTratamentos.formatarNumero(${JSON.stringify(valor)})`),esperado);
  for(const valor of [null,'',undefined])assert.equal(a.run(`SaudeTratamentos.formatarNumero(${JSON.stringify(valor)??'undefined'})`),'Não informado');
});
test('unidades específicas e ausentes não são convertidas em und',()=>{
  const a=app();for(const u of ['mg','mL','cápsula','ampola',''])assert.equal(a.run(`SaudeTratamentos.unidadeExibida(${JSON.stringify(u)})`),u);
  for(const u of ['unidade','unidades','und','und.','un','UN.'])assert.equal(a.run(`SaudeTratamentos.unidadeExibida(${JSON.stringify(u)})`),'und');
});
test('alertas, check e histórico usam números limpos e und, sem reescrever prescrição',()=>{
  const a=app("t.usoDiario=true;t.alertaEstoque='20.0000';t.frequencia='Orientação original: 1.0000 conforme documento';t.compras=[{id:'compra-ficticia',data:'2020-01-01',marca:'Exemplo',quantidade:'2.5000'}]");a.run('document.body.append(quadroItensTratamento([t],{}))');
  assert.match(a.document.querySelector('[data-alerta-reposicao]').textContent,/20 und/);assert.doesNotMatch(a.document.querySelector('.trat-diario').textContent,/1\.0000/);
  assert.match(a.document.querySelector('.trat-info:last-child').textContent,/2,5 und/);assert.match(a.document.querySelector('.trat-texto').textContent,/1\.0000/);
});
test('salvar edição sem mudança conserva unidade e estoque legados com movimentos',()=>{
  const a=app();a.run('editarTratamento(t)');a.document.querySelector('.rotina-form').onsubmit({preventDefault(){}});
  assert.equal(a.run('t.estoqueInicial'),'10.0000');assert.equal(a.run('t.unidade'),'unidade');assert.equal(a.run('t.usos.length'),1);
});
test('registro pela tela Hoje usa und e valor inicial sem zeros sobrando',()=>{
  const a=app();a.run(readFileSync('publico/saude-painel.js','utf8'));a.run("saudeOcorrencia({registroId:t.id,data:'2020-01-02',hora:'dia',id:'ocorrencia-ficticia'})");
  const q=a.document.querySelector('[name=quantidade]');assert.equal(q.value,'1');assert.match(q.closest('label').textContent,/und/);assert.equal(a.run('t.consumoPorCiclo'),'1.0000');
});
test('sair do campo remove zeros sobrando, mantém frações e não grava o uso',()=>{
  const a=app(),antes=a.run('JSON.stringify(E)');a.run('document.body.append(quadroItensTratamento([t],{}))');const q=a.document.querySelector('[name=quantidade]');
  for(const [valor,esperado] of [['2.0000','2'],['0.5000','0.5'],['0.0001','0.0001'],['','']]){q.value=valor;q.onblur();assert.equal(q.value,esperado)}
  assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('seta pode começar em um sem liberar quantidades abaixo do mínimo anterior',()=>{
  const a=app(),antes=a.run('JSON.stringify(E)');assert.throws(()=>a.run("registrarUsoTratamento(t,{data:'2020-01-02',hora:'08:00',quantidade:0.00001})"),/mínima/);assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('reposição de Hoje também exibe fração com vírgula e und',()=>{
  const a=app("t.estoqueInicial='0.5000';t.usos=[];E.consultas=[];E.vitais=[];E.peso=[];E.exames=[]");a.run(readFileSync('publico/saude-modelo.js','utf8'));a.run(readFileSync('publico/saude-painel.js','utf8'));a.run('document.body.append(saudeHoje())');
  assert.match(a.document.querySelector('.sui-prioridade p').textContent,/0,5 und/);assert.equal(a.run('t.estoqueInicial'),'0.5000');
});
