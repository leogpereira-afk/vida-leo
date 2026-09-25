import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {setup} from './helpers/dom.mjs';
function abrir(inicio=0,modo='apresentar'){
  const app=setup(),memoria=new Map();
  app.ctx.localStorage={getItem:k=>memoria.get(k)||null,setItem:(k,v)=>memoria.set(k,String(v)),removeItem:k=>memoria.delete(k)};
  app.ctx.CustomEvent=app.document.defaultView.CustomEvent;
  app.ctx.window.dispatchEvent=()=>{};
  app.run(`abrirVofApresentacao(${inicio},'${modo}')`);
  return {...app,modal:app.document.querySelector('.modal-vof'),memoria};
}
function tecla(app,alvo,key,extra={}){
  const ev=new app.document.defaultView.Event('keydown',{bubbles:true,cancelable:true});
  Object.assign(ev,{key,...extra});alvo.dispatchEvent(ev);return ev;
}
const titulo=app=>app.modal.querySelector('[data-titulo]').textContent;
test('V.O.F.: o HTML mantém o programa em um script próprio executável',()=>{
  const {document}=parseHTML(readFileSync(new URL('../publico/index.html',import.meta.url),'utf8'));
  const scripts=[...document.querySelectorAll('script')];
  assert.ok(scripts.some(s=>!s.hasAttribute('src')&&s.textContent.includes('function vMetodoVOF')));
  assert.ok(scripts.filter(s=>s.hasAttribute('src')).every(s=>!s.textContent.trim()));
});
test('V.O.F.: apresentação e prática têm visibilidade independente e preservam rascunho',()=>{
  const a=abrir(2),q=s=>a.modal.querySelector(s);
  assert.equal(q('.vof-slide').hidden,false);assert.equal(q('[data-vof-aplicacao]').hidden,true);
  q('[data-vof-modo="aplicar"]').click();assert.equal(q('.vof-slide').hidden,true);
  const area=q('textarea');area.value='Revisar a promessa com a equipe em sete dias';area.oninput();
  q('[data-vof-modo="apresentar"]').click();q('[data-vof-modo="aplicar"]').click();assert.equal(q('textarea').value,area.value);
  q('[data-proximo]').click();q('[data-anterior]').click();assert.equal(q('textarea').value,area.value);
});
test('V.O.F.: setas editam a resposta sem trocar o assunto',()=>{
  const a=abrir(2,'aplicar'),antes=titulo(a),area=a.modal.querySelector('textarea');
  for(const key of ['ArrowLeft','ArrowRight','Home','End']){const ev=tecla(a,area,key);assert.equal(titulo(a),antes);assert.equal(ev.defaultPrevented,false);}
  tecla(a,a.modal,'ArrowRight');assert.match(titulo(a),/Conscientizar/);
});
test('V.O.F.: atalhos respeitam seletor, modificadores e janelas sobrepostas',()=>{
  const a=abrir(2),antes=titulo(a);
  tecla(a,a.modal.querySelector('select'),'ArrowRight');assert.equal(titulo(a),antes);
  tecla(a,a.modal,'ArrowRight',{ctrlKey:true});assert.equal(titulo(a),antes);
  a.run("abrirModal('Outra janela','',c=>c.appendChild(el('<input aria-label=Teste>')))");
  tecla(a,a.document.querySelector('#modais .fundo:last-child .modal'),'ArrowRight');assert.equal(titulo(a),antes);
});
test('V.O.F.: início e final têm limites e conclusão explícita',()=>{
  const a=abrir();tecla(a,a.modal,'ArrowLeft');assert.match(titulo(a),/pirâmide/);
  tecla(a,a.modal,'End');assert.match(titulo(a),/Times, AP/);assert.equal(a.modal.querySelector('[data-proximo]').hidden,true);assert.equal(a.modal.querySelector('[data-finalizar]').hidden,false);
  tecla(a,a.modal,'ArrowRight');assert.match(titulo(a),/Times, AP/);
  tecla(a,a.modal,'Home');assert.match(titulo(a),/pirâmide/);assert.equal(a.modal.querySelector('[data-anterior]').disabled,true);
});
test('V.O.F.: a missão pontua uma vez e mantém a evidência ao mudar de slide',()=>{
  const a=abrir(2,'aplicar'),q=s=>a.modal.querySelector(s);
  q('.vof-challenge-option').click();q('textarea').value='Validar escopo com a operação até sexta-feira';q('textarea').oninput();
  assert.equal(q('[data-vof-salvar]').disabled,false);q('[data-vof-salvar]').click();q('[data-vof-salvar]').click();
  assert.equal(a.run('vofJornadaEstado().xp'),30);
  q('[data-proximo]').click();q('[data-anterior]').click();assert.match(q('textarea').value,/Validar escopo/);assert.match(q('[data-vof-salvar]').textContent,/Atualizar resposta/);
});
test('V.O.F.: todas as 20 etapas oferecem conteúdo, pergunta e fonte',()=>{
  const a=abrir();
  assert.equal(a.modal.querySelectorAll('select option').length,20);
  for(let i=0;i<20;i++){
    assert.ok(titulo(a));assert.ok(a.modal.querySelector('[data-pergunta-principal]').textContent);assert.match(a.modal.querySelector('[data-fonte]').textContent,/Caderno completo/);
    assert.ok(a.modal.querySelector('[data-vof-visual]').children.length);a.modal.querySelector('[data-proximo]').click();
  }
  assert.match(titulo(a),/Times, AP/);
});
test('V.O.F.: as abas têm navegação por teclado e incluem as cinco dimensões',()=>{
  const a=setup();a.run("atual='metodo-vof';tela()");
  const tabs=a.document.querySelectorAll('[role=tab]');assert.equal(tabs[0].getAttribute('tabindex'),'0');
  tecla(a,tabs[0],'ArrowRight');assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(tabs[0].getAttribute('tabindex'),'-1');
  assert.deepEqual([...a.document.querySelectorAll('.vof-architecture b')].map(x=>x.textContent),['Venda','Operação','Finanças','Pessoas','Gestores']);
});
test('V.O.F.: continuar missão abre diretamente no modo Aplicar',()=>{
  const a=setup();a.run("atual='metodo-vof';tela()");a.document.querySelector('[data-vof-continuar]').click();
  assert.equal(a.document.querySelector('.vof-presenter').dataset.modo,'aplicar');assert.equal(a.document.querySelector('[data-vof-aplicacao]').hidden,false);
});
