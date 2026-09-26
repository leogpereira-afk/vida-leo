import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';

/* O MÉTODO V.O.F. VIROU SISTEMA PRÓPRIO em 25/09/2026
   (https://leogpereira-afk.github.io/metodo-vof/). Na Central fica só o atalho:
   o mesmo item de menu, com o mesmo id, levando ao endereço novo. Os testes da
   apresentação, da jornada e das abas foram junto com a tela para o repositório
   leogpereira-afk/metodo-vof. */
const ENDERECO='https://leogpereira-afk.github.io/metodo-vof/';
const CHAVE_JORNADA='cl_vof_jornada_v1';

test('V.O.F.: o item de menu continua, com o mesmo id e tela própria',()=>{
  const a=setup();a.run('menu()');
  assert.match(a.document.querySelector('#nav').textContent,/Método V.O.F./);
  assert.equal(a.run("MODS.filter(m=>m.id==='metodo-vof'&&!m.url&&typeof m.render==='function').length"),1);
});

test('V.O.F.: a tela é um atalho para o sistema próprio',()=>{
  const a=setup();a.run("atual='metodo-vof';tela()");
  const cartao=a.document.querySelector('[data-vof-atalho]');
  assert.ok(cartao,'o cartão do atalho não apareceu');
  assert.match(cartao.textContent,/agora é um sistema próprio/);
  const link=cartao.querySelector('a');
  assert.equal(link.getAttribute('href'),ENDERECO);
  assert.equal(link.getAttribute('target'),'_blank');
  assert.match(link.getAttribute('rel'),/noopener/);
  // tela() escreve um aviso role=alert quando o render estoura
  assert.equal(a.document.querySelector('#main [role=alert]'),null);
});

test('V.O.F.: abrir o atalho não apaga a jornada guardada no navegador',()=>{
  const a=setup(),memoria=new Map([[CHAVE_JORNADA,'{"xp":30,"respostas":{}}']]);
  a.ctx.localStorage={getItem:k=>memoria.has(k)?memoria.get(k):null,setItem:(k,v)=>memoria.set(k,String(v)),removeItem:k=>memoria.delete(k)};
  a.run("atual='metodo-vof';tela()");
  assert.equal(memoria.get(CHAVE_JORNADA),'{"xp":30,"respostas":{}}');
});

test('V.O.F.: nada da tela antiga ficou para trás na Central',()=>{
  const html=readFileSync(new URL('../publico/index.html',import.meta.url),'utf8');
  for(const resto of ['VOF_MODULOS','VOF_ETAPAS','VOF_IMAGENS','VOF_REFERENCIAS','VOF_APRESENTACAO',
    'abrirVofApresentacao','abrirVofCaderno','vofJornada','metodo-vof.css','assets/vof/','modal-vof','vof-presenter',
    'Metodo_VOF_Caderno']){
    assert.ok(!html.includes(resto),`sobrou "${resto}" no publico/index.html`);
  }
  assert.equal(existsSync(new URL('../publico/metodo-vof.css',import.meta.url)),false,'publico/metodo-vof.css ficou órfão');
  assert.equal(existsSync(new URL('../publico/assets/vof',import.meta.url)),false,'publico/assets/vof ficou órfão');
});
