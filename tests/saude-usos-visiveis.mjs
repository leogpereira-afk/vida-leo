import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
function app(extra=''){
  const a=setup();
  a.run(`tela=()=>{};atual='saude';var t={id:'item-ficticio',oque:'Medicamento fictício',tipo:'Medicamento',status:'Em andamento',unidade:'unidade',estoqueInicial:10,consumoPorCiclo:1};E.tratamentos=[t];${extra};document.body.append(quadroItensTratamento(E.tratamentos,{}))`);
  return a;
}
function enviar(a,hora='08:00',quantidade='1'){
  const f=a.document.querySelector('[data-uso-direto]');
  f.querySelector('[name=data]').value='2020-01-02';f.querySelector('[name=hora]').value=hora;f.querySelector('[name=quantidade]').value=quantidade;
  f.onsubmit({preventDefault(){}});return f;
}
const linhas=a=>[...a.document.querySelectorAll('.trat-usos-recentes [data-uso-id]')];
test('uso aparece em linha visível fora de details, com data, hora e quantidade, sem repetir estoque',()=>{
  const a=app();enviar(a,'08:00','2');assert.equal(linhas(a).length,1);
  assert.match(linhas(a)[0].textContent,/02\/01\/2020/);assert.match(linhas(a)[0].textContent,/08:00/);assert.match(linhas(a)[0].textContent,/2 und/);
  assert.equal(linhas(a)[0].closest('details'),null);assert.equal(a.run('SaudeTratamentos.saldo(t)'),8);
  assert.doesNotMatch(a.document.querySelector('.trat-resumo').textContent,/Estoque/);
});
test('usos do mesmo dia aparecem do mais recente para o antigo, sem reordenar o cadastro',()=>{
  const a=app();enviar(a,'08:00');enviar(a,'09:00','2');assert.match(linhas(a)[0].textContent,/09:00/);assert.match(linhas(a)[1].textContent,/08:00/);
  assert.equal(a.run('t.usos[0].hora'),'08:00');assert.equal(a.run('t.usos.length'),2);
  enviar(a,'09:00');assert.equal(linhas(a).length,2);assert.equal(a.run('SaudeTratamentos.saldo(t)'),7);
});
test('check diário também cria linha visível e impede repetição do mesmo dia',()=>{
  const a=app('t.usoDiario=true');const check=a.document.querySelector('[data-uso-diario]');check.checked=true;check.onchange();
  assert.equal(linhas(a).length,1);assert.equal(a.document.querySelector('[data-uso-diario]').disabled,true);assert.equal(a.run('SaudeTratamentos.saldo(t)'),9);
});
test('desfazer a linha preserva auditoria e devolve apenas sua quantidade ao estoque',()=>{
  const a=app();enviar(a,'08:00','2');enviar(a,'09:00');a.run('confirm=()=>true');
  linhas(a)[1].querySelector('button').click();assert.equal(linhas(a).length,1);assert.match(linhas(a)[0].textContent,/09:00/);
  assert.ok(a.run('t.usos[0].desfeitoEm'));assert.equal(a.run('t.usos.length'),2);assert.equal(a.run('SaudeTratamentos.saldo(t)'),9);
});
test('falha de gravação não cria linha nem confirma uso e falha no desfazer mantém a linha',()=>{
  const a=app();a.ctx.localStorage.setItem=()=>{throw Error('Sem espaço')};const f=enviar(a,'08:00','2');
  assert.equal(linhas(a).length,0);assert.equal(a.run('SaudeTratamentos.saldo(t)'),10);assert.equal(f.querySelector('[name=quantidade]').value,'2');assert.match(f.querySelector('[role=alert]').textContent,/Sem espaço/);
  a.ctx.localStorage.setItem=()=>{};enviar(a,'08:00','2');a.run('confirm=()=>true');a.ctx.localStorage.setItem=()=>{throw Error('Sem espaço')};linhas(a)[0].querySelector('button').click();assert.equal(linhas(a).length,1);assert.equal(a.run('SaudeTratamentos.saldo(t)'),8);assert.equal(a.run('t.usos[0].desfeitoEm'),undefined);
});
test('linhas ficam isoladas por medicamento e registros antigos continuam acessíveis',()=>{
  const a=app(`t.usos=Array.from({length:8},(_,i)=>({id:'uso-'+i,data:'2020-01-0'+(i+1),hora:'08:00',quantidade:1}));E.tratamentos.push({id:'outro-ficticio',oque:'Outro medicamento fictício',tipo:'Medicamento',status:'Em andamento',unidade:'unidade',estoqueInicial:3})`);
  assert.equal(linhas(a).filter(l=>!l.closest('details')).length,5);assert.equal(linhas(a).length,8);assert.equal(a.run('t.usos[0].id'),'uso-0');
  [...a.document.querySelectorAll('.trat-item')].find(b=>b.textContent.includes('Outro medicamento')).click();assert.equal(linhas(a).length,0);assert.equal(a.run('E.tratamentos[1].usos'),undefined);
});
test('reabrir a tela mantém os usos em linhas, sem conversão automática para cards',()=>{
  const a=app();enviar(a);a.run("var pagina=document.createElement('div');pagina.dataset.saudeWorkbench='1';pagina.append(document.querySelector('.tratamentos-itens'));document.body.append(pagina);prepararTabelas(pagina)");
  assert.equal(a.document.querySelector('.trat-usos-tabela').classList.contains('tabela-adaptavel'),false);
});
test('uso retroativo recém-salvo fica visível mesmo além dos cinco mais recentes',()=>{
  const a=app("t.usos=Array.from({length:6},(_,i)=>({id:'anterior-'+i,data:'2020-02-0'+(i+1),hora:'08:00',quantidade:1}))");enviar(a,'07:00');
  const nova=linhas(a).find(l=>l.dataset.usoId===a.run('t.usos.at(-1).id'));assert.ok(nova);assert.equal(nova.closest('details')?.open,true);assert.match(nova.textContent,/02\/01\/2020.*07:00/);
});
