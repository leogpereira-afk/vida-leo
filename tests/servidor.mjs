import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import {webcrypto,createHmac} from 'node:crypto';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/leo-sync/index.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,''));
function backend({query=()=>({data:null,error:null}),remove=async()=>({error:null}),now=1000}={}){
 let handler;const calls=[];const modulos=[];
 // os `import` são removidos do fonte: as portas dos módulos entram como dublê
 const stravaAcao=async(acao,corpo)=>{modulos.push({modulo:'strava',acao,corpo});return new Response('{}',{status:200})};
 const googleAcao=async(acao,corpo)=>{modulos.push({modulo:'google',acao,corpo});return new Response('{}',{status:200})};
 const mock={from(table){const q={table,op:'select',args:{}};for(const m of ['select','eq','order','range','in','limit','maybeSingle','update','insert','upsert','delete'])q[m]=(...a)=>{q.args[m]=a;if(['update','insert','upsert','delete'].includes(m))q.op=m;return q};q.then=(ok,err)=>{calls.push(q);return Promise.resolve(query(q)).then(ok,err)};return q},storage:{from:()=>({remove})}};
 const NativeDate=Date;class Clock extends NativeDate{static now(){return now}}
 vm.runInNewContext(source,{createClient:()=>mock,Deno:{env:{get:n=>n==='EQUIPE_JWT_SECRET'?'teste':'configurado'},serve:h=>handler=h},crypto:webcrypto,TextEncoder,TextDecoder,atob,Response,URL,Date:Clock,setTimeout,stravaAcao,googleAcao});
 const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({sis:'central',exp:9999999999})).toString('base64url');const unsigned=head+'.'+body;const token=unsigned+'.'+createHmac('sha256','teste').update(unsigned).digest('base64url');
 const pedir=(method,payload,cabecalhos)=>handler(new Request('https://teste.example/leo-sync',{method,headers:{'content-type':'application/json',...cabecalhos},body:payload?JSON.stringify(payload):undefined}));
 return {calls,modulos,pedir,
   request:(method,payload,auth=true)=>pedir(method,payload,auth?{authorization:'Bearer '+token}:{})};
}
/* A PORTA DA TAREFA AGENDADA. O pg_cron não tem o crachá do dono (que abre
   estado, obras, anexos e a administração) nem deve usar a chave service_role
   (que é do projeto inteiro). Tem um segredo só dele, para UMA ação. */
const SEGREDO='c'.repeat(64);
const comToken=(token=SEGREDO)=>q=>q.args.eq&&q.args.eq[1]==='cron_token'?{data:{valor:{token}},error:null}:{data:null,error:null};
test('Cron: segredo certo abre a rodada agendada, sem crachá nenhum',async()=>{
  const b=backend({query:comToken()});
  const r=await b.pedir('POST',{acao:'stravaSincronizarCron'},{'x-leo-cron':SEGREDO});
  assert.equal(r.status,200);
  assert.equal(b.modulos.length,1);
  assert.equal(b.modulos[0].modulo,'strava');
  assert.equal(b.modulos[0].acao,'stravaSincronizarCron');
  assert.equal(Object.keys(b.modulos[0].corpo).length,0);
});
test('Cron: o corpo é ignorado — `forcar` não atravessa a porta',async()=>{
  const b=backend({query:comToken()});
  await b.pedir('POST',{acao:'stravaSincronizarCron',forcar:true},{'x-leo-cron':SEGREDO});
  assert.equal(b.modulos[0].corpo.forcar,undefined);
  assert.equal(Object.keys(b.modulos[0].corpo).length,0);
});
test('Cron: o segredo só vale para a ação dele',async()=>{
  const b=backend({query:comToken()});
  for(const acao of ['stravaLer','stravaSincronizar','obraCustos','googleToken']){
    assert.equal((await b.pedir('POST',{acao},{'x-leo-cron':SEGREDO})).status,401,acao);
  }
  assert.equal(b.modulos.length,0);
});
test('Cron: sem segredo gravado, nem o cabeçalho certo entra (recusa por omissão)',async()=>{
  const b=backend();
  assert.equal((await b.pedir('POST',{acao:'stravaSincronizarCron'},{'x-leo-cron':SEGREDO})).status,401);
  const curto=backend({query:comToken('curto')});
  assert.equal((await curto.pedir('POST',{acao:'stravaSincronizarCron'},{'x-leo-cron':SEGREDO})).status,401);
  assert.equal(b.modulos.length,0);
});
test('Cron: segredo errado do mesmo tamanho não passa',async()=>{
  const b=backend({query:comToken()});
  assert.equal((await b.pedir('POST',{acao:'stravaSincronizarCron'},{'x-leo-cron':'d'.repeat(64)})).status,401);
  assert.equal(b.modulos.length,0);
});
test('Cron: cabeçalho curto nem chega a bater no banco',async()=>{
  const b=backend({query:comToken()});
  assert.equal((await b.pedir('POST',{acao:'stravaSincronizarCron'},{'x-leo-cron':'abc'})).status,401);
  assert.equal(b.calls.length,0);
});
test('Cron: sem cabeçalho e sem crachá continua 401',async()=>{
  const b=backend({query:comToken()});
  assert.equal((await b.request('POST',{acao:'stravaSincronizarCron'},false)).status,401);
  assert.equal(b.modulos.length,0);
});
test('Servidor: sem sessão não consulta dados',async()=>{const b=backend();assert.equal((await b.request('GET',null,false)).status,401);assert.equal(b.calls.length,0)});
test('Servidor: rejeita estado malformado antes de gravar',async()=>{const b=backend();assert.equal((await b.request('PUT',{dados:[],base:0})).status,400);assert.equal(b.calls.length,0)});
test('Servidor: versão avança mesmo quando relógio fica atrás da base',async()=>{const b=backend({query:q=>q.op==='update'?{data:[{mt:q.args.update[0].mt}],error:null}:{data:{mt:2000},error:null}});const r=await b.request('PUT',{dados:{viagens:[]},base:2000});assert.equal(r.status,200);assert.ok((await r.json()).mt>2000)});
test('Servidor: falha ao remover arquivo preserva seu índice',async()=>{const b=backend({query:q=>({data:{caminho:'teste/arquivo'},error:null}),remove:async()=>({error:{message:'offline'}})});assert.equal((await b.request('POST',{acao:'arqApagar',id:'teste'})).status,500);assert.equal(b.calls.filter(q=>q.op==='delete').length,0)});
test('Servidor: índice de anexos ultrapassa mil linhas sem truncar',async()=>{const b=backend({query:q=>({data:Array.from({length:q.args.range?.[0]===1000?1:1000},(_,i)=>({id:String((q.args.range?.[0]||0)+i)})),error:null})});const r=await b.request('POST',{acao:'arqListar'});assert.equal((await r.json()).arquivos.length,1001)});
