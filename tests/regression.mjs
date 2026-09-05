import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const html=readFileSync(new URL('../publico/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).replace(/if\(temSessao\(\)\)\{menu\(\);tela\(\);puxarNuvem[\s\S]*$/,'');
function app(date='2026-09-05T12:00:00-03:00'){
 const NativeDate=Date; class Clock extends NativeDate {constructor(...args){super(...(args.length?args:[date]))} static now(){return new NativeDate(date).getTime()}}
 const data=new Map();const ctx=vm.createContext({Date:Clock,structuredClone,console,setTimeout,clearTimeout,URL,Blob,TextEncoder,TextDecoder,location:{hostname:'localhost',hash:''},document:{addEventListener(){},getElementById(){return null}},window:{addEventListener(){}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},sessionStorage:{getItem:()=>null}});
 vm.runInContext(source,ctx);return code=>vm.runInContext(code,ctx);
}
test('hoje respeita o dia local após 21h',()=>assert.equal(app('2026-09-05T23:30:00-03:00')('hoje()'),'2026-09-05'));
test('calendário produz seis meses consecutivos no dia 31',()=>{const run=app('2026-08-31T12:00:00-03:00'); const body=source.match(/const ms=\[\];for\(let i=5;[^\n]+/)[0];assert.equal(run(`(()=>{${body};return ms.join(',')})()`),'2026-03,2026-04,2026-05,2026-06,2026-07,2026-08')});
test('contas bancárias têm lista própria',()=>assert.equal(app()("CFG('tiposContaBanco').includes('Conta corrente PF')"),true));
test('datas invertidas não contam um dia de viagem',()=>assert.equal(app()("diasEntre('2026-09-07','2026-09-05')"),0));
test('falha de envio retorna falha ao chamador',async()=>{const run=app();assert.equal(await run("window.__testeSync=true;_tabBase=1;apiPut=async()=>{throw Error('offline')};enviarNuvem()"),false)});
test('backup malformado é rejeitado antes de substituir dados',()=>assert.throws(()=>app()("validarBackup({viagens:[],gastos:'inválido'})"),/gastos/));

test('backup aceita exclusões de centro de custo',()=>assert.doesNotThrow(()=>app()("validarBackup({...structuredClone(SEED),obraM2Fora:['Terreno']})")));
test('URL executável não é oferecida como link',()=>assert.equal(app()("urlSegura('javascript:alert(1)')"),'#'));
test('moeda brasileira e negativa preserva centavos',()=>{const run=app();assert.equal(run("moedaNum('R$ 1.234,56')"),1234.56);assert.equal(run("moedaNum('-234,56')"),-234.56)});
test('envios simultâneos são serializados',async()=>{const run=app();await run("window.__testeSync=true;_tabBase=1;var ativosTeste=0,maxTeste=0;apiPut=async()=>{ativosTeste++;maxTeste=Math.max(maxTeste,ativosTeste);await new Promise(r=>setTimeout(r,5));ativosTeste--;return {status:200,j:{mt:2}}};Promise.all([enviarNuvem(),enviarNuvem(),enviarNuvem()])");assert.equal(run('maxTeste'),1)});
test('conflito não retorna sucesso',async()=>{const run=app();assert.equal(await run("window.__testeSync=true;_tabBase=1;apiPut=async()=>({status:409});apiSync=async()=>({dados:{},mt:2});adotaNuvem=()=>{};enviarNuvem()"),false)});
test('envio confirmado retorna sucesso',async()=>{const run=app();assert.equal(await run("window.__testeSync=true;_tabBase=1;apiPut=async()=>({status:200,j:{mt:2}});enviarNuvem()"),true)});
test('evento de dia inteiro termina no dia seguinte',async()=>{const run=app();const ics=await run("E.agenda=[{id:'1',data:'2026-09-05',titulo:'Evento'}];var arquivo;baixar=b=>arquivo=b;exportarIcs();arquivo.text()");assert.match(ics,/DTEND;VALUE=DATE:20260906/)});
test('evento às 23h30 termina no próximo dia',async()=>{const run=app();const ics=await run("E.agenda=[{id:'1',data:'2026-09-05',hora:'23:30',titulo:'Evento'}];var arquivo;baixar=b=>arquivo=b;exportarIcs();arquivo.text()");assert.match(ics,/DTEND:20260906T003000/)});
