import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const esperar=()=>new Promise(resolve=>setTimeout(resolve,5));
const boaBase="E.empresasPJ=[{id:'pj-sintetica',nome:'Empresa de teste'}]; E.holdingImoveis=[{id:'imovel-sintetico',nome:'Imóvel de teste',totalCentavos:50000,pagamentos:[{id:'p',data:'2030-04-03',valorCentavos:5000}]}];";
function app(){
  const a=setup();a.run(boaBase+" const imovelOriginal=JSON.stringify(E.holdingImoveis);let atualizadosTeste=0;");
  a.mes=mes=>{a.ctx.mesEscolhido=mes;a.run("var localTeste=document.getElementById('main');localTeste.classList.add('holding-area');localTeste.replaceChildren();holdingRenderCarteira(localTeste,{mes:mesEscolhido,aoAtualizar(){atualizadosTeste++;}})");};
  a.mes('2030-04');return a;
}
function grupo(a,tipo){const d=a.document.querySelector(`[data-carteira-grupo=${tipo}]`);d.open=true;return d;}
function botao(raiz,texto){const b=[...raiz.querySelectorAll('button')].find(e=>e.textContent===texto);assert.ok(b,'botão '+texto);return b;}
function campo(a,nome,texto){
  const el=a.document.querySelector(`.hcar-editor [name=${nome}]`);assert.ok(el,nome);
  el.value=texto;el.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));return el;
}
function submeter(a){const form=a.document.querySelector('.hcar-editor');form.dispatchEvent(new a.document.defaultView.Event('submit',{bubbles:true,cancelable:true}));return form;}
async function salvar(a){submeter(a);await esperar();}

test('imóvel mostra valor a informar, preserva a aquisição e guarda aluguel por competência inclusive zero',async()=>{
  const a=app();let d=grupo(a,'imoveis');
  assert.equal(a.run('E.holdingFinanceiro'),undefined);assert.match(d.textContent,/A informar/);
  botao(d,'Editar patrimônio').click();campo(a,'patrimonio','1.000,25');await salvar(a);
  assert.equal(a.run("holdingApiCarteira().lerValorImovel('imovel-sintetico').valorAtualCentavos"),100025);
  d=grupo(a,'imoveis');botao(d,'Lançar aluguel').click();campo(a,'aluguel','0');await salvar(a);
  assert.equal(a.run("holdingApiCarteira().lerMensal('imovel','imovel-sintetico','2030-04').aluguelCentavos"),0);
  d=grupo(a,'imoveis');assert.match(d.textContent.replace(/\u00a0/g,' '),/Aluguel recebidoR\$ 0,00/);
  botao(d,'Editar aluguel').click();campo(a,'aluguel','120,50');await salvar(a);
  assert.equal(a.run("holdingApiCarteira().listarMensais().length"),1);
  assert.equal(a.run("holdingApiCarteira().lerMensal('imovel','imovel-sintetico','2030-04').historico[0].antes.aluguelCentavos"),0);
  a.mes('2030-05');d=grupo(a,'imoveis');assert.match(d.textContent,/Aluguel recebidoA informar/);
  assert.match(d.querySelector('.hcar-historico').textContent,/abril de 2030/);
  assert.equal(a.run('JSON.stringify(E.holdingImoveis)===imovelOriginal'),true);assert.equal(a.run('atualizadosTeste'),3);
});

test('cadastrar uma participação vinculada à PJ, informar faturamento e repasse sem replicar lançamentos',async()=>{
  const a=app();let d=grupo(a,'empresas');botao(d,'+ Cadastrar empresa').click();
  const seletor=a.document.querySelector('.hcar-editor select');
  for(const opt of seletor.querySelectorAll('option'))opt.selected=opt.value==='pj-sintetica';
  seletor.dispatchEvent(new a.document.defaultView.Event('change',{bubbles:true}));
  const nome=a.document.querySelector('.hcar-editor [name=nome]');assert.equal(nome.value,'Empresa de teste');assert.equal(nome.readOnly,true);
  campo(a,'participacao','25,5');campo(a,'patrimonio','700');
  submeter(a);submeter(a);await esperar();
  assert.equal(a.run("holdingApiCarteira().listarEmpresas().length"),1);
  const empresa=a.run("holdingApiCarteira().listarEmpresas()[0]");
  assert.equal(empresa.empresaId,'pj-sintetica');assert.equal(empresa.participacaoPct,25.5);assert.equal(empresa.valorParticipacaoCentavos,70000);
  assert.equal(a.run('E.empresasPJ.length'),1);
  d=grupo(a,'empresas');botao(d,'Lançar mês').click();campo(a,'faturamento','2.500');campo(a,'repasse','0');await salvar(a);
  a.ctx.idEmpTeste=empresa.id;
  assert.equal(a.run("holdingApiCarteira().lerMensal('empresa',idEmpTeste,'2030-04').faturamentoCentavos"),250000);
  assert.equal(a.run("holdingApiCarteira().lerMensal('empresa',idEmpTeste,'2030-04').repasseCentavos"),0);
  d=grupo(a,'empresas');botao(d,'Editar mês').click();campo(a,'repasse','125,07');await salvar(a);
  assert.equal(a.run("holdingApiCarteira().listarMensais().length"),1);
  assert.equal(a.run("holdingApiCarteira().lerMensal('empresa',idEmpTeste,'2030-04').repasseCentavos"),12507);
  assert.equal(a.run("holdingApiCarteira().lerMensal('empresa',idEmpTeste,'2030-04').faturamentoCentavos"),250000);
});

test('edição concorrente mantém o rascunho e a informação remota; cancelar recarrega os valores',async()=>{
  const a=app();let d=grupo(a,'imoveis');botao(d,'Lançar aluguel').click();
  const inp=campo(a,'aluguel','180,00');const form=inp.closest('form');assert.ok(form.hasAttribute('data-holding-rascunho'));
  botao(d,'Editar patrimônio').click();assert.equal(a.document.querySelector('.hcar-editor'),form);assert.equal(inp.value,'180,00');
  await a.run("holdingApiCarteira().gravarMensal({tipo:'imovel',origemId:'imovel-sintetico',competencia:'2030-04',aluguelCentavos:11000},null)");
  await salvar(a);assert.equal(a.document.querySelector('.hcar-editor'),form);assert.equal(inp.value,'180,00');
  assert.match(form.querySelector('[role=alert]').textContent,/mudou/);
  assert.equal(a.run("holdingApiCarteira().lerMensal('imovel','imovel-sintetico','2030-04').aluguelCentavos"),11000);
  botao(form,'Cancelar').click();
  assert.equal(a.document.querySelector('.hcar-editor'),null);assert.match(grupo(a,'imoveis').textContent,/110,00/);
});
