import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

test('o menu abre o resumo; imóveis e avião têm atalhos separados e mantêm a holding selecionada', () => {
  const {run,document}=setup();
  run("E.aviao.matricula='DEMO'; E.aviao.aportes=[{id:'existente',valor:250}]; const antesHolding=JSON.stringify(E); menu()");
  const nav=[...document.querySelectorAll('#nav button')];
  const daHolding=nav.filter(b=>b.querySelector('.tx').textContent==='Universo Holding');
  assert.equal(daHolding.length,1);
  assert.ok(!nav.some(b=>['Avião','Imóveis da holding'].includes(b.querySelector('.tx').textContent)));
  daHolding[0].click();
  assert.equal(run('atual'),'universo-holding');
  const botoes=()=>[...document.querySelectorAll('#main button')];
  assert.ok(!botoes().some(b=>/cadastrar imóvel/i.test(b.textContent)));
  const imoveis=botoes().filter(b=>/^abrir imóveis$/i.test(b.getAttribute('aria-label')||b.textContent.trim()));
  assert.equal(imoveis.length,1);imoveis[0].click();
  assert.equal(run('atual'),'universo-imoveis');
  assert.equal(document.querySelector('#nav [aria-current="page"] .tx').textContent,'Universo Holding');
  const voltarImoveis=botoes().find(b=>/Resumo do patrimônio/i.test(b.getAttribute('aria-label')||b.textContent));
  assert.ok(voltarImoveis);voltarImoveis.click();
  assert.equal(run('atual'),'universo-holding');
  const aviao=document.querySelectorAll('#main button[aria-label="Abrir avião"]');
  assert.equal(aviao.length,1);
  aviao[0].click();
  assert.equal(run('atual'),'aviao');
  assert.equal(document.querySelector('#nav [aria-current="page"] .tx').textContent,'Universo Holding');
  assert.equal(document.querySelector('#main h1').textContent,'Avião');
  const empresas=document.querySelector('#main button[aria-label="Abrir empresas"]');
  empresas.click();
  assert.equal(run('atual'),'universo-empresas');
  assert.equal(document.querySelector('#nav [aria-current="page"] .tx').textContent,'Universo Holding');
  assert.ok(document.querySelector('[data-carteira-grupo="empresas"]').open);
  assert.equal(document.querySelector('[data-carteira-grupo="imoveis"]'),null);
  const voltar=document.querySelector('#main .holding-marca');
  assert.ok(voltar);
  voltar.click();
  assert.equal(run('atual'),'universo-holding');
  assert.equal(run('JSON.stringify(E)===antesHolding'),true);
});

function navegador(comNavigationAPI){
  const a=setup(), entradas=[{hash:'#inicio',estado:null}];
  let indice=0;
  a.ctx.location.hash='#inicio';
  const ir=distancia=>{
    const alvo=indice+distancia;
    if(alvo<0||alvo>=entradas.length)return;
    indice=alvo;a.ctx.location.hash=entradas[indice].hash;
    a.run('navegarHistoricoCentral()');
  };
  a.ctx.history={
    get state(){return entradas[indice].estado},
    get length(){return entradas.length},
    pushState(estado,titulo,hash){entradas.splice(++indice,Infinity,{estado,hash});a.ctx.location.hash=hash},
    replaceState(estado){entradas[indice].estado=estado},
    go:ir
  };
  if(comNavigationAPI)a.ctx.window.navigation={get currentEntry(){return {index:indice}}};
  const avisos=[];a.ctx.alert=msg=>avisos.push(msg);
  a.run("atual='inicio';indiceTelaCentral=indiceHistoricoCentral();irTela('universo-holding');irTela('universo-imoveis');irTela('agenda')");
  ir(-1);
  return {...a,ir,avisos,entradas};
}

function camposEmEdicao(a,gravando=false){
  if(!gravando){
    a.document.querySelector('.holding-lista-cab button').click();
    const form=a.document.querySelector('.holding-dialog form'), nome=form.elements?.nome||form.querySelector('[name=nome]');
    nome.value='Texto do lançamento';
    nome.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));
    assert.equal(form.hasAttribute('data-holding-rascunho'),true);
    return form;
  }
  const area=a.document.createElement('section');area.className='holding-area';
  const form=a.document.createElement('form');form.innerHTML='<label>Descrição<input name="descricao"></label>';
  const campo=form.querySelector('input');campo.value='Texto do lançamento';
  form.setAttribute('aria-busy','true');
  area.append(form);a.document.querySelector('#main').append(area);
  return form;
}

for(const comAPI of [false,true])test(`Voltar e Avançar preservam edição e histórico da carteira · Navigation API ${comAPI}`,()=>{
  const a=navegador(comAPI), form=camposEmEdicao(a);
  for(const distancia of [-1,1]){
    a.ir(distancia);
    assert.equal(a.ctx.location.hash,'#universo-imoveis');
    assert.equal(a.run('atual'),'universo-imoveis');
    assert.equal(form.isConnected,true);assert.equal(form.querySelector('input').value,'Texto do lançamento');
    assert.equal(a.entradas.length,4,'bloquear a navegação mantém as entradas anteriores e posteriores');
  }
  a.run("irTela('aviao')");assert.equal(a.run('atual'),'universo-imoveis');
  assert.equal(a.avisos.length,3);assert.match(a.avisos.at(-1),/Salve ou cancele/);
  [...form.querySelectorAll('button')].find(b=>b.textContent==='Cancelar').click();
  a.ir(1);assert.equal(a.run('atual'),'agenda');
  a.ir(-1);a.ir(-1);assert.equal(a.run('atual'),'universo-holding');
});

test('durante a gravação a área permanece aberta; ao sair da página conserva os textos privados da sessão',()=>{
  const a=navegador(true),form=camposEmEdicao(a,true);
  a.ir(1);a.run("irTela('inicio')");assert.equal(a.run('atual'),'universo-imoveis');
  assert.match(a.avisos.at(-1),/Aguarde o salvamento/);
  a.ctx.saida={cancelado:false,preventDefault(){this.cancelado=true}};
  a.run('avisarSaidaHolding(saida)');assert.ok(a.ctx.saida.cancelado);
  form.setAttribute('data-holding-rascunho','');a.run('preservarSaidaHolding()');
  assert.match(a.run('JSON.stringify(lerRascunhoSync())'),/Texto do lançamento/);
  form.remove();a.run("irTela('agenda');limparRascunhoSync()");a.ctx.saida.cancelado=false;
  a.run('avisarSaidaHolding(saida);preservarSaidaHolding()');
  assert.equal(a.ctx.saida.cancelado,false);assert.equal(a.run('lerRascunhoSync()'),null);
});
