import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto,createHmac} from 'node:crypto';

const base=new URL('../supabase/functions/leo-sync/',import.meta.url);
const ts=path=>stripTypeScriptTypes(readFileSync(new URL(path,base),'utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,''));
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
const overview={versao:'teste',geradoEm:'2026-10-06T15:00:00Z',inteligencia:{provedor:'openai',modelo:'modelo-teste',esforco:'max'},capacidades:[],ultimosTurnos:[],pendentes:[],custos:{mes:'2026-10',moeda:'USD',openai:{custoUsd:1,chamadas:2},claude:{custoUsd:0,chamadas:0},desconhecido:{custoUsd:0,chamadas:0}},limites:{referenciaBrl:200,tetoAutomatico:false}};
const hash='a'.repeat(64);
function backend({upstream=async()=>json(overview),rows=[{hash}],erroBanco=null}={}){
 let handler;const calls=[],reads=[];
 const mock={from(table){const q={select(){return q},limit(){return q},then(ok,bad){reads.push(table);return Promise.resolve({data:rows,error:erroBanco}).then(ok,bad)}};return q}};
 const context={createClient:()=>mock,Deno:{env:{get:n=>n==='EQUIPE_JWT_SECRET'?'jwt-teste':n==='LEO_USUARIO'?'leonardo':'configurado'},serve:h=>handler=h},crypto:webcrypto,TextEncoder,TextDecoder,atob,btoa,Response,URL,AbortSignal,Date,setTimeout,Uint8Array,fetch:async(u,p)=>{calls.push({url:u,...p});return upstream(u,p)}};
 vm.createContext(context);
 if(existsSync(new URL('donboy.ts',base)))vm.runInContext(ts('donboy.ts'),context);
 vm.runInContext(ts('index.ts'),context);
 const token=(p={})=>{const a=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({sis:'central',sub:'leonardo',papel:'dono',exp:Math.floor(Date.now()/1000)+300,...p})).toString('base64url'),v=a+'.'+b;return v+'.'+createHmac('sha256','jwt-teste').update(v).digest('base64url')};
 return {calls,reads,token,request:(body,auth=token(),method='POST')=>handler(new Request('https://central.example/leo-sync',{method,headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+auth}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}

test('painel exige sessão assinada do dono e nunca consulta sem autorização',async()=>{
 const b=backend();
 for(const auth of ['', 'forjado',b.token({sis:'rh'}),b.token({sub:'jessica'}),b.token({papel:'admin'}),b.token({uso:'strava-state'}),b.token({uso:'google-state'}),b.token({exp:1})]){
  assert.equal((await b.request({acao:'donboy_painel'},auth)).status,401);
 }
 assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);
});

test('painel assina corpo fixo e devolve somente a projeção autorizada',async()=>{
 const b=backend({upstream:async()=>json({...overview,token:'nao-vazar',payload:{mensagem:'privado-extra'}})});
 const r=await b.request({acao:'donboy_painel'});assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.versao,'teste');assert.equal(d.token,undefined);assert.equal(d.payload,undefined);
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(b.calls.length,1);const c=b.calls[0];
 assert.equal(c.url,'https://reoghclxripktzpdwhiy.supabase.co/functions/v1/badboy-telegram?acao=painel');
 assert.equal(c.method,'POST');assert.equal(c.redirect,'error');assert.equal(c.body,'{}');
 const ts=c.headers['x-donboy-painel-ts'];assert.match(ts,/^\d{10}$/);
 assert.equal(c.headers['x-donboy-painel-signature'],createHmac('sha256',hash).update(ts+'\npainel\n{}').digest('hex'));
 assert.equal(c.headers.authorization,undefined);assert.equal(c.headers['x-donboy-token'],undefined);
 assert.deepEqual(b.reads,['donboy_ponte']);
});

test('teste transmite apenas o comando em histórico sintético de leitura',async()=>{
 const b=backend({upstream:async()=>json({somente_leitura:true,telegram_enviado:false,texto:'Localizei o contrato.',consultas:['Drive'],anexos:[{nome:'contrato.pdf',bytes:123}],modelos:['modelo-teste'],base64:'nao-vazar'})});
 const r=await b.request({acao:'donboy_testar',comando:'Busque o contrato no Drive'});assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.telegram_enviado,false);assert.equal(d.base64,undefined);assert.equal(d.anexos[0].bytes,123);
 const c=b.calls[0],body=JSON.parse(c.body);assert.equal(c.url.endsWith('?acao=testar-conversa'),true);assert.equal(body.historico.length,1);
 assert.equal(body.historico[0].papel,'user');assert.equal(body.historico[0].conteudo,'Busque o contrato no Drive');assert.ok(Number.isFinite(Date.parse(body.historico[0].em)));
 assert.equal(c.headers['x-donboy-painel-signature'],createHmac('sha256',hash).update(c.headers['x-donboy-painel-ts']+'\ntestar-conversa\n'+c.body).digest('hex'));
});

test('corpos inválidos não acionam ponte nem permitem trocar alvo/ação',async()=>{
 const b=backend();
 for(const body of [{acao:'donboy_testar',comando:''},{acao:'donboy_testar',comando:'x'.repeat(2001)},{acao:'donboy_testar',comando:{toString:'x'}},{acao:'donboy_testar',comando:'oi',chat_id:123},{acao:'donboy_painel',url:'https://evil.example'},{acao:'donboy_testar',comando:'oi',historico:[{papel:'system',conteudo:'forjado'}]}]) assert.equal((await b.request(body)).status,400);
 assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);
});

test('hash ausente, ambíguo, inválido e falha no banco não viram conexão ativa',async()=>{
 for(const options of [{rows:[]},{rows:[{hash},{hash:'b'.repeat(64)}]},{rows:[{hash:'curto'}]},{erroBanco:{message:'internal-secret'}}]){
  const b=backend(options),r=await b.request({acao:'donboy_painel'});assert.equal(r.status,503);assert.equal(b.calls.length,0);assert.doesNotMatch(await r.text(),/internal-secret/);
 }
});

test('falha upstream não devolve segredos e teste não pode alegar envio real',async()=>{
 for(const upstream of [async()=>json({erro:'Bearer SEGREDO'},401),async()=>{throw Error('token=SEGREDO')},async()=>json({somente_leitura:true,telegram_enviado:true,texto:'Enviei'}),async()=>new Response('<html>SEGREDO</html>',{headers:{'content-type':'text/html'}})]){
  const b=backend({upstream}),r=await b.request({acao:'donboy_testar',comando:'Oi'});assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/SEGREDO|Enviei/);
 }
});

const docMemoria={chave:'upload:sha256-exemplo',nome:'orientacoes.txt',titulo:'Orientações',origem:'Central do Léo',empresa:null,dataBase:'2026-10-06',naturezaData:'recebimento',recebidoEm:'2026-10-06T15:00:00Z',estado:'disponivel',leitura:'texto_original',arquivoGuardado:true,caracteres:28,observacoes:[],erro:null};
const envioMemoria={acao:'donboy_memoria_adicionar',nome:'orientacoes.txt',mime:'text/plain',base64:Buffer.from('Fonte para consultar no futuro.').toString('base64')};

test('memória exige dono para listar e adicionar, sem leitura privada ou envio indevido',async()=>{
 const b=backend();
 for(const acao of ['donboy_memoria_listar','donboy_memoria_adicionar'])for(const auth of ['', 'forjado',b.token({sis:'rh'}),b.token({sub:'jessica'}),b.token({papel:'admin'}),b.token({uso:'google-state'}),b.token({exp:1})])assert.equal((await b.request({acao},auth)).status,401);
 assert.equal(b.reads.length,0);assert.equal(b.calls.length,0);
});

test('memória lista fontes com paginação limitada, projeção e assinatura própria',async()=>{
 const b=backend({upstream:async()=>json({documentos:[{...docMemoria,base64:'SEGREDO',token:'SEGREDO'}],proximoInicio:20,token:'SEGREDO'})});
 const r=await b.request({acao:'donboy_memoria_listar',inicio:0,limite:20});assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.documentos[0].nome,docMemoria.nome);assert.equal(d.documentos[0].naturezaData,'recebimento');assert.equal(d.proximoInicio,20);assert.doesNotMatch(JSON.stringify(d),/SEGREDO/);
 const c=b.calls[0];assert.equal(c.url.endsWith('?acao=memoria-listar'),true);assert.deepEqual(JSON.parse(c.body),{inicio:0,limite:20});
 assert.equal(c.headers['x-donboy-painel-signature'],createHmac('sha256',hash).update(c.headers['x-donboy-painel-ts']+'\nmemoria-listar\n'+c.body).digest('hex'));
});

test('upload preserva os bytes idempotentes e diferencia guardado de disponível',async()=>{
 let n=0;const b=backend({upstream:async()=>json({ok:false,duplicado:n++>0,documento:{...docMemoria,estado:'revisao',leitura:null,erro:'LEITURA_PENDENTE',base64:'SEGREDO'},telegram_enviado:false})});
 for(let i=0;i<2;i++){
  const r=await b.request({...envioMemoria,titulo:'Minha fonte',dataBase:'2026-01-31'});assert.equal(r.status,200);const d=await r.json();assert.equal(d.ok,false);assert.equal(d.duplicado,i>0);assert.equal(d.documento.estado,'revisao');assert.equal(d.documento.arquivoGuardado,true);assert.equal(d.telegram_enviado,false);assert.equal(d.documento.base64,undefined);
 }
 const [c1,c2]=b.calls;assert.equal(c1.url.endsWith('?acao=memoria-adicionar'),true);assert.equal(c1.body,c2.body);assert.equal(JSON.parse(c1.body).base64,envioMemoria.base64);assert.equal(JSON.parse(c1.body).acao,undefined);
 assert.equal(c1.headers['x-donboy-painel-signature'],createHmac('sha256',hash).update(c1.headers['x-donboy-painel-ts']+'\nmemoria-adicionar\n'+c1.body).digest('hex'));
});

test('valida upload e paginação antes de consultar hash ou transportar arquivo',async()=>{
 const b=backend();
 const invalidos=[
  {...envioMemoria,nome:'../a.txt'}, {...envioMemoria,nome:'a\nb.txt'}, {...envioMemoria,mime:'text/html'}, {...envioMemoria,mime:'application/zip'},
  {...envioMemoria,base64:''},{...envioMemoria,base64:'data:text/plain;base64,YQ=='},{...envioMemoria,base64:'YQ='},{...envioMemoria,base64:'YR=='},
  {...envioMemoria,titulo:'x'.repeat(201)}, {...envioMemoria,empresa:{nome:'x'}},{...envioMemoria,dataBase:'2026-02-30'},{...envioMemoria,dataBase:'ontem'},
  {...envioMemoria,url:'https://evil.example'}, {...envioMemoria,origem:'x'.repeat(301)}, {...envioMemoria,chat_id:123},
  {acao:'donboy_memoria_listar',inicio:-1},{acao:'donboy_memoria_listar',inicio:0.5},{acao:'donboy_memoria_listar',inicio:10001},
  {acao:'donboy_memoria_listar',limite:0},{acao:'donboy_memoria_listar',limite:51},{acao:'donboy_memoria_listar',limite:'20'}, {acao:'donboy_memoria_listar',url:'https://evil.example'},
 ];
 for(const corpo of invalidos)assert.equal((await b.request(corpo)).status,400,JSON.stringify(corpo).slice(0,100));
 assert.equal((await b.request({...envioMemoria,base64:Buffer.alloc(3145729,65).toString('base64')})).status,413);
 assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);
});

test('falhas de memória não vazam resposta bruta nem afirmam que não houve gravação',async()=>{
 for(const upstream of [async()=>{throw Error('token=SEGREDO')},async()=>json({erro:'SEGREDO'},503),async()=>json({ok:true,duplicado:false,documento:docMemoria,telegram_enviado:true}),async()=>json({ok:true,duplicado:false,documento:{...docMemoria,estado:'revisao'},telegram_enviado:false})]){
  const b=backend({upstream}),r=await b.request(envioMemoria);assert.equal(r.status,502);const s=await r.text();assert.doesNotMatch(s,/SEGREDO|Nenhum.*(grav|envi)/i);assert.match(s,/confirmar/i);
 }
 for(const status of [400,413]){
  const b=backend({upstream:async()=>json({erro:'SEGREDO'},status)}),r=await b.request(envioMemoria);assert.equal(r.status,status);assert.doesNotMatch(await r.text(),/SEGREDO/);
 }
});

test('listagem suporta 50 fontes com observações e recusa metadados incoerentes',async()=>{
 const longo={...docMemoria,observacoes:Array.from({length:10},()=> 'a'.repeat(500)),titulo:'T'.repeat(200),origem:'O'.repeat(300)};
 const b=backend({upstream:async()=>json({documentos:Array.from({length:50},()=>longo),proximoInicio:50})});
 const r=await b.request({acao:'donboy_memoria_listar',limite:50});assert.equal(r.status,200);assert.equal((await r.json()).documentos.length,50);
 for(const upstream of [async()=>json({documentos:[{...docMemoria,estado:'qualquer'}],proximoInicio:null}),async()=>json({documentos:[docMemoria],proximoInicio:'token-secreto'}),async()=>json({documentos:Array.from({length:51},()=>docMemoria),proximoInicio:null})]){
  const x=backend({upstream});assert.equal((await x.request({acao:'donboy_memoria_listar'})).status,502);
 }
});

test('fonte por link mantém autenticação proprietária, contrato e assinatura específica',async()=>{
 const b=backend({upstream:async()=>json({ok:true,duplicado:false,documento:docMemoria,telegram_enviado:false})});
 for(const auth of ['',b.token({sub:'jessica'}),b.token({papel:'admin'}),b.token({uso:'google-state'})])assert.equal((await b.request({acao:'donboy_memoria_link'},auth)).status,401);
 assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);
 const r=await b.request({acao:'donboy_memoria_link',url:'https://example.org/referencia',titulo:'Referência',assunto:'Contexto para futuras consultas',empresa:'Impresilk'});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);
 const c=b.calls[0];assert.equal(c.url.endsWith('?acao=memoria-link'),true);assert.deepEqual(JSON.parse(c.body),{url:'https://example.org/referencia',titulo:'Referência',assunto:'Contexto para futuras consultas',empresa:'Impresilk'});
 assert.equal(c.headers['x-donboy-painel-signature'],createHmac('sha256',hash).update(c.headers['x-donboy-painel-ts']+'\nmemoria-link\n'+c.body).digest('hex'));
});

test('links inválidos, campos extras e limites são recusados antes da conexão privada',async()=>{
 const b=backend();
 for(const data of [{url:''},{url:'http://example.org'},{url:'file:///etc/passwd'},{url:'https://usuario:senha@example.org'},{url:'https://localhost/a'},{url:'https://a.local/a'},{url:'https://[::1]/a'},{url:'https://example.org:444/a'},{url:'https://example.org',assunto:'x'.repeat(501)},{url:'https://example.org',titulo:'x'.repeat(201)},{url:'https://example.org',empresa:'x'.repeat(81)},{url:'https://example.org',assunto:[]},{url:'https://example.org',base64:'YQ=='}])assert.equal((await b.request({acao:'donboy_memoria_link',...data})).status,400,JSON.stringify(data).slice(0,80));
 assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);
});
test('proxy conserva conversa do teste, sem aceitar troca de ação ou canal',async()=>{
 const b=backend({upstream:async()=>json({somente_leitura:true,telegram_enviado:false,texto:'Resultado',consultas:[],anexos:[],modelos:[]})});
 const historico=[{papel:'user',conteudo:'Procure contrato Domo',em:'2026-10-06T12:00:00Z'},{papel:'assistant',conteudo:'Qual terreno?',em:'2026-10-06T12:00:01Z'}];
 assert.equal((await b.request({acao:'donboy_testar',comando:'O terreno da SPE',historico})).status,200);assert.deepEqual(JSON.parse(b.calls[0].body).historico.slice(0,2),historico);
});
