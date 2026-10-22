import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const resposta=(dados,status=200)=>({status,ok:status>=200&&status<300,json:async()=>structuredClone(dados)});
const pendente=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
function app(){
 const a=setup(),itens=new Map([['cl_token','sessao-sintetica']]);
 const storage={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,String(v)),removeItem:k=>itens.delete(k)};
 a.ctx.localStorage=storage;a.ctx.sessionStorage=storage;a.alertas=[];a.ctx.alert=t=>a.alertas.push(t);
 a.run("window.__testeSync=true;E=carregar();E.gastos=[];E.demandas=[{id:'demanda-ficticia',titulo:'Demanda sintética',obs:'Versão do cache'}];E._mt=100;guardarEstadoLocal(E);atual='gastos';tela()");
 a.cache=JSON.parse(a.run('JSON.stringify(E)'));return a;
}
function salvarGasto(a){
 a.run("modalLancamentoGasto({id:'qa-gasto-local',mes:'2026-10',classe:'Casa',oque:'',valor:0,pago:''},true)");
 const f=a.document.querySelector('.ff-form');f.querySelector('[name=oque]').value='QA-GASTO-PRIMEIRA-LEITURA';f.querySelector('[name=valor]').value='0,01';f.onsubmit({preventDefault(){}});
 assert.equal(a.run('E.gastos.length'),1);assert.equal(a.document.querySelector('#modais .fundo'),null);
}

for(const direcao of [-1,1])for(const concorrente of [false,true])test(`Primeiro gasto: relógio ${direcao}, envio concorrente ${concorrente}`,async()=>{
 const a=app(),get=pendente(),puts=[];let gets=0,servidor;
 a.ctx.fetch=async(_,op)=>{if(op.method==='GET'){gets++;return get.promise}const p=JSON.parse(op.body);puts.push(p);servidor=p.dados;return resposta({mt:3000})};
 const inicial=a.run('puxarNuvem()');salvarGasto(a);
 const remoto={mt:2000,dados:structuredClone(a.cache)};remoto.dados._mt=a.run('E._mt')+direcao;
 remoto.dados.demandas[0].obs='Mudança legítima no servidor';
 const envio=concorrente?a.run('enviarNuvem()'):null;
 get.resolve(resposta(remoto));await Promise.all([inicial,envio]);
 assert.equal(gets,1,'Leitura inicial compartilhada com o envio');
 assert.equal(a.alertas.length,0);assert.equal(puts.length,1);
 assert.equal(servidor.gastos[0].oque,'QA-GASTO-PRIMEIRA-LEITURA');
 assert.equal(servidor.demandas[0].obs,'Mudança legítima no servidor');
 assert.equal(puts[0].base,2000);assert.equal(a.run('E.gastos.length'),1);
 assert.equal(a.run("JSON.parse(localStorage.getItem('cl_descartado')).dados.demandas[0].obs"),'Versão do cache','Cache anterior também fica recuperável');
});
test('Primeiro gasto: formulário aberto mantém campos quando chega a base remota',async()=>{
 const a=app(),get=pendente();a.ctx.fetch=async()=>get.promise;
 const inicial=a.run('puxarNuvem()');
 a.run("modalLancamentoGasto({id:'novo',mes:'2026-10',classe:'Casa',oque:'',valor:0,pago:''},true)");
 const form=a.document.querySelector('.ff-form');form.querySelector('[name=oque]').value='Texto digitado';
 const remoto={mt:2000,dados:structuredClone(a.cache)};remoto.dados._mt=2000;remoto.dados.demandas[0].obs='Mudança remota';
 get.resolve(resposta(remoto));await inicial;
 assert.ok(a.document.querySelector('.ff-form')===form,'Formulário continua aberto');assert.equal(form.querySelector('[name=oque]').value,'Texto digitado');
 assert.equal(a.alertas.length,0);assert.equal(a.run('E.demandas[0].obs'),'Mudança remota');
});
test('Primeiro gasto: edição concorrente do mesmo ID continua conflito real',async()=>{
 const a=app(),get=pendente();let puts=0;a.ctx.fetch=async(_,op)=>{if(op.method==='PUT')puts++;return get.promise};
 const inicial=a.run('puxarNuvem()');salvarGasto(a);
 const remoto={mt:2000,dados:structuredClone(a.cache)};remoto.dados._mt=2000;remoto.dados.gastos=[{id:'qa-gasto-local',oque:'Outra gravação',valor:12}];
 get.resolve(resposta(remoto));await inicial;
 assert.equal(puts,0);assert.equal(a.alertas.length,1);assert.equal(a.run('E.gastos[0].oque'),'Outra gravação');
 assert.equal(a.run("JSON.parse(localStorage.getItem('cl_descartado')).dados.gastos[0].oque"),'QA-GASTO-PRIMEIRA-LEITURA');
});

test('Primeiro gasto: queda na primeira leitura mantém lançamento para nova tentativa',async()=>{
 const a=app(),get=pendente();let puts=0;
 a.ctx.fetch=async()=>get.promise;
 const inicial=a.run('puxarNuvem()');salvarGasto(a);get.resolve({ok:false,status:503});await inicial;
 assert.equal(a.run('E.gastos.length'),1);assert.equal(a.run('_tabBase'),0);assert.equal(a.alertas.length,0);
 const remoto={mt:2000,dados:structuredClone(a.cache)};remoto.dados.demandas[0].obs='Servidor após reconexão';
 a.ctx.fetch=async(_,op)=>{if(op.method==='GET')return resposta(remoto);puts++;const enviado=JSON.parse(op.body);assert.equal(enviado.dados.gastos.length,1);assert.equal(enviado.dados.demandas[0].obs,'Servidor após reconexão');return resposta({mt:2001})};
 assert.equal(await a.run('enviarNuvem()'),true);assert.equal(puts,1);assert.equal(a.alertas.length,0);
});

test('Primeiro gasto: campos completos chegam ao servidor e sobrevivem à recarga',async()=>{
 const a=app(),get=pendente();let servidor;
 a.ctx.fetch=async(_,op)=>{if(op.method==='GET')return get.promise;servidor=JSON.parse(op.body).dados;return resposta({mt:2001})};
 const inicial=a.run('puxarNuvem()');salvarGasto(a);
 a.run("Object.assign(E.gastos[0],{obs:'Linha 1: ação e informação.\\nLinha 2: fim.',data:'2026-10-21',vencimento:'2026-11-02',situacao:'Pendente',pago:'Outro',pagoEm:'',empresaId:'',natureza:'Despesa pessoal'});guardarEstadoLocal(E)");
 const esperado=JSON.parse(a.run('JSON.stringify(E.gastos[0])'));
 const remoto={mt:2000,dados:structuredClone(a.cache)};remoto.dados.demandas[0].obs='Mudança remota';get.resolve(resposta(remoto));await inicial;
 assert.deepEqual(servidor.gastos[0],esperado);
 const outra=app();outra.ctx.fetch=async()=>resposta({mt:2001,dados:servidor});await outra.run('puxarNuvem()');
 assert.deepEqual(JSON.parse(outra.run('JSON.stringify(E.gastos[0])')),esperado);assert.equal(outra.alertas.length,0);
});

for(const tipo of ['editar','remover'])test('Primeiro gasto: não mistura inclusão com '+tipo+' em dados existentes',async()=>{
 const a=app(),get=pendente();let puts=0;a.ctx.fetch=async(_,op)=>{if(op.method==='PUT')puts++;return get.promise};
 const inicial=a.run('puxarNuvem()');salvarGasto(a);
 a.run(tipo==='editar'?"E.demandas[0].obs='Edição local real';guardarEstadoLocal(E)":"E.demandas=[];guardarEstadoLocal(E)");
 const remoto={mt:2000,dados:structuredClone(a.cache)};remoto.dados.demandas[0].obs='Edição remota real';get.resolve(resposta(remoto));await inicial;
 assert.equal(puts,0);assert.equal(a.alertas.length,1);assert.equal(a.run('E.demandas[0].obs'),'Edição remota real');
 assert.equal(a.run("JSON.parse(localStorage.getItem('cl_descartado')).dados.gastos.length"),1);
});
