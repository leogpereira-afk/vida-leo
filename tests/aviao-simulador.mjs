import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {setup} from './helpers/dom.mjs';

const codigo=readFileSync(new URL('../publico/aviao-simulador.js',import.meta.url),'utf8');
const tarifas={horaCentavos:{manutencao:1200,reservaMotor:500,combustivel:4000,oleo:300},pousoCentavos:[1500,3300],hangaragemCentavos:[3000,7200]};
const base={hIda:1,mIda:15,hVolta:0,mVolta:15,pousos:2,pernoites:1,extras:500,unitPouso:null,unitHangar:null};

test('estimativa em centavos usa os dois trechos, faixas, cotação zero e extras uma vez',()=>{
  const ctx=vm.createContext({tarifas,base});
  vm.runInContext(codigo,ctx);
  const calc=patch=>JSON.parse(vm.runInContext('JSON.stringify(estimarVooAviao(tarifas,{...base,...'+JSON.stringify(patch)+'}))',ctx));
  assert.deepEqual(calc({}).total,[15500,23300]);
  assert.deepEqual(calc({unitPouso:0,unitHangar:1800}).total,[11300,11300]);
  assert.deepEqual(calc({hVolta:0,mVolta:0,pousos:0,pernoites:0,extras:0}).total,[7500,7500]);
  assert.equal(calc({mIda:60}),null);
  assert.equal(calc({pousos:-1}),null);
  assert.equal(calc({hIda:0,mIda:0,hVolta:0,mVolta:0}),null);
});

test('aba do avião calcula ao digitar e preserva a simulação sem gravar no financeiro',()=>{
  const {ctx,run,document}=setup();
  vm.runInContext(codigo,ctx);ctx.amostra=tarifas;
  run("E.aviao.tarifasVoo=amostra;E.aviao.matricula='PS-ABC';location.search='?aba=simular';vAviao(document.getElementById('main'))");
  let painel=document.querySelector('.aviao-simulador');
  assert.ok(painel);
  assert.match(painel.textContent,/60,00 por hora/);
  function mudar(chave,valor){
    const inp=painel.querySelector('input[name="'+chave+'"]');
    inp.value=valor;inp.dispatchEvent(new document.defaultView.Event('input',{bubbles:true}));
  }
  const estado=run('JSON.stringify(E)');
  mudar('hIda','2');mudar('unitPouso','10.00');
  assert.match(painel.querySelector('strong').textContent,/130,00/);
  run("document.getElementById('main').replaceChildren();vAviao(document.getElementById('main'))");
  painel=document.querySelector('.aviao-simulador');
  assert.equal(painel.querySelector('input[name=hIda]').value,'2');
  assert.equal(run('JSON.stringify(E)'),estado);
});
