import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {criarDireto,digest,CALLBACK,diagnosticoProvedor} from '../supabase/functions/leo-sync/marketing-direto.mjs';
import {validarAtivo,coletarFonte,janela,descobrirAtivos} from '../supabase/functions/leo-sync/marketing-direto-fontes.mjs';
const tempo=Date.parse('2026-06-17T12:00:00Z');
function setup(fetcher=async()=>new Response(JSON.stringify({access_token:'PRIVADO',refresh_token:'RENOVAR',expires_in:3600,scope:'teste'}))){let now=tempo;const dados=new Map(),cache=new Map(),banco={ler:async k=>dados.get(k)||null,gravar:async(k,v)=>dados.set(k,v),consumir:async(k,p)=>{const v=dados.get(k);if(p&&v?.prova!==p)return null;dados.delete(k);return v||null},salvarFonte:async(k,v)=>cache.set(k,v)};return {d:criarDireto({banco,fetcher,env:n=>n.endsWith('_ID')?'APP':'SEGREDO',agora:()=>now}),dados,cache,avancar:()=>now+=700000}}
const prova='a'.repeat(64);
async function start(x,p='google'){const r=await x.d.inicio(p,prova,'dono');return new URL(r.url).searchParams.get('state')}
test('OAuth direto: scopes de marketing, PKCE, state opaco e nenhuma chave no navegador',async()=>{const x=setup(),r=await x.d.inicio('google',prova,'dono'),u=new URL(r.url);assert.equal(u.searchParams.get('redirect_uri'),CALLBACK);assert.match(u.searchParams.get('scope'),/analytics.readonly/);assert.doesNotMatch(u.href,/gmail|calendar|SEGREDO|PRIVADO/);assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.match(u.searchParams.get('state'),/^fm\.[a-f0-9]{64}$/);});
test('OAuth direto: callback é uso único e não instala token antes da confirmação do navegador e dono',async()=>{const x=setup(),state=await start(x),nonce=state.slice(3);const retorno=await x.d.callback(new URL(CALLBACK+'?state='+state+'&code=EXEMPLO'));assert.match(retorno,/#marketing$/);assert.equal(x.dados.has('token_google'),false);await assert.rejects(x.d.callback(new URL(CALLBACK+'?state='+state+'&code=EXEMPLO')),/state/);await assert.rejects(x.d.confirmar(nonce,prova,'outro'),/state/);await assert.rejects(x.d.confirmar(nonce,'b'.repeat(64),'dono'),/state/);await x.d.confirmar(nonce,prova,'dono');assert.equal(x.dados.get('token_google').access_token,'PRIVADO');await assert.rejects(x.d.confirmar(nonce,prova,'dono'),/state/);assert.doesNotMatch(JSON.stringify(await x.d.status()),/PRIVADO|RENOVAR|SEGREDO/)});
test('OAuth direto: vencimento, cancelamento e erros não guardam token nem expõem retorno do provedor',async()=>{const x=setup(),s=await start(x);x.avancar();await assert.rejects(x.d.callback(new URL(CALLBACK+'?state='+s+'&code=X')),/state/);const y=setup(),t=await start(y);assert.match(await y.d.callback(new URL(CALLBACK+'?state='+t+'&error=access_denied')),/resultado=negado/);assert.equal(y.dados.has('token_google'),false);const z=setup(async()=>new Response(JSON.stringify({error:'secret PRIVADO'}),{status:400}));const q=await start(z);const ret=await z.d.callback(new URL(CALLBACK+'?state='+q+'&code=X'));assert.match(ret,/resultado=troca/);assert.doesNotMatch(ret,/PRIVADO/)});
test('OAuth direto: Meta usa ads_read, troca token longo e respeita configuração separada',async()=>{let chamadas=[];const x=setup(async(u,o)=>{chamadas.push([u,String(o.body)]);return new Response(JSON.stringify({access_token:'PRIVADO',expires_in:5000000}))});const s=await start(x,'meta');await x.d.callback(new URL(CALLBACK+'?state='+s+'&code=X'));assert.match(chamadas[1][1],/fb_exchange_token/);const d=criarDireto({banco:{ler:async()=>null},env:()=>''});await assert.rejects(d.inicio('meta',prova,'dono'),/configuracao/)});
test('Fortemais direta: rejeita host parecido, Instagram de outra empresa e IDs injetados antes de coletar',async()=>{await assert.rejects(validarAtivo('search',{id:'https://fortemais.net.evil.test'},()=>{}),/vinculo/);await assert.rejects(validarAtivo('ga4',{id:'properties/1/evil'},()=>{}),/vinculo/);await assert.rejects(validarAtivo('instagram',{id:'123'},async()=>({username:'outra'})),/vinculo/);await assert.rejects(validarAtivo('ga4',{id:'properties/123'},async()=>({dataStreams:[{webStreamData:{defaultUri:'https://outro.test'}}]})),/vinculo/)});
test('GA4: dados filtrados pelo host, total de usuários vem do agregado, sem somar dias',async()=>{const chamadas=[];const r=await coletarFonte('ga4',{id:'properties/123'},async(u,b)=>{chamadas.push(b);return {rows:[{dimensionValues:[{value:'20260601'}],metricValues:b.metrics.map(()=>({value:'7'}))}]};},tempo);assert.equal(r.periodos[0].metricas.usuarios,7);assert.ok(chamadas.every(b=>b.dimensionFilter.filter.fieldName==='hostName'));assert.equal(r.periodos[0].metricas.tempo_engajamento,undefined)});
test('Busca sem linhas não inventa zero, falha opcional mantém parcial e período consolidado exclui 3 dias recentes',async()=>{const r=await coletarFonte('search',{id:'https://fortemais.net/'},async(u,b)=>{if(b.dimensions?.[0]==='query')throw Error('x');return {}},tempo);assert.deepEqual(r.periodos[0].metricas,{});assert.equal(r.estado,'parcial');assert.deepEqual(janela(tempo),{inicio:'2026-05-18',fim:'2026-06-14'})});
test('Coleta falha preserva cache anterior; configurações e tokens só usam banco privado da marca',async()=>{const x=setup(async()=>new Response('{}',{status:403}));x.dados.set('token_google',{access_token:'PRIVADO',exp:tempo+999999});x.dados.set('ativo_search',{id:'https://fortemais.net/'});x.cache.set('search',{antes:true});await assert.rejects(x.d.coletar('search'),/permissao/);assert.deepEqual(x.cache.get('search'),{antes:true});assert.equal(x.dados.get('ultima_search').codigo,'permissao')});
test('Portas diretas exigem dono, empresa e sessão normal; callback separado do OAuth pessoal',async()=>{const src=readFileSync(new URL('../supabase/functions/leo-sync/index.ts',import.meta.url),'utf8');const trecho=src.slice(src.indexOf('    if (["marketingDiretoStatus"'),src.indexOf('    if (acao === "marketingAdministracao")'));assert.match(trecho,/p\.uso !== ""/);assert.match(trecho,/p\.papel !== "dono"/);assert.match(trecho,/corpo\.empresa !== "fortemais"/);assert.ok(src.indexOf('startsWith("fm.")')<src.indexOf('if (req.method === "GET" && req.url.includes("googleCallback"))'));});
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
test('UI direta: configuração ausente bloqueia conexão; vincular e coletar exigem a fonte selecionada',async()=>{const {document}=parseHTML('<main></main>');const calls=[];let ativo=null;const api=async(m,b)=>{calls.push(b);if(b.acao==='marketingDiretoStatus')return {ok:true,provedores:{google:{configurado:true,autorizado:true},meta:{configurado:false,autorizado:false}},fontes:Object.fromEntries(['ga4','search','perfil','instagram','meta_ads'].map(f=>[f,{ativo:f==='ga4'?ativo:null}]))};if(b.acao==='marketingDiretoListar')return {ok:true,ativos:[{id:'properties/123',nome:'Site de teste'}]};if(b.acao==='marketingDiretoVincular'){ativo={id:b.ativo,nome:'Site de teste'};return {ok:true}}if(b.acao==='marketingDiretoColetar')return {ok:true,estado:'parcial'};throw Error('inesperado')};const ctx=vm.createContext({document,console,Date});vm.runInContext(readFileSync(new URL('../publico/marketing-direto.js',import.meta.url),'utf8'),ctx);ctx.LeoMarketingDireto.montar(document.querySelector('main'),{api});const flush=()=>new Promise(r=>setImmediate(r));await flush();assert.ok(document.querySelector('[data-conectar="meta"]').hasAttribute('disabled'));document.querySelector('[data-listar="ga4"]').click();await flush();const form=document.querySelector('form');form.querySelector('select').querySelector('option').setAttribute('selected','');form.onsubmit({preventDefault(){}});await flush();assert.equal(calls.find(x=>x.acao==='marketingDiretoVincular').ativo,'properties/123');document.querySelector('[data-coletar="ga4"]').click();await flush();assert.match(document.querySelector('main').textContent,/Coleta parcial recebida/);assert.ok(calls.every(x=>x.empresa==='fortemais'))});
test('UI OAuth: remontagem aguarda a mesma confirmação antes de consultar status',async()=>{
 const {document}=parseHTML('<main id="a"></main><main id="b"></main>');
 let liberar,confirmado=false;const calls=[];
 const location={search:'?fm='+('a'.repeat(64))+'&resultado=ok',href:'https://teste.test/?fm='+('a'.repeat(64))+'&resultado=ok',pathname:'/'};
 const ctx=vm.createContext({document,console,Date,URL,URLSearchParams,location,history:{replaceState(){location.search=''}},sessionStorage:{getItem:()=>prova,removeItem(){}}});
 vm.runInContext(readFileSync(new URL('../publico/marketing-direto.js',import.meta.url),'utf8'),ctx);
 const api=async(m,b)=>{calls.push(b.acao);if(b.acao==='marketingDiretoConfirmar'){await new Promise(r=>liberar=r);confirmado=true;return {ok:true}}
 assert.equal(confirmado,true,'não consultar estado antes da confirmação');
 return {ok:true,provedores:{google:{configurado:true,autorizado:true},meta:{}},fontes:Object.fromEntries(['ga4','search','perfil','instagram','meta_ads'].map(f=>[f,{}]))};};
 ctx.LeoMarketingDireto.montar(document.querySelector('#a'),{api});
 ctx.LeoMarketingDireto.montar(document.querySelector('#b'),{api});
 assert.deepEqual(calls,['marketingDiretoConfirmar']);liberar();await new Promise(r=>setImmediate(r));
 assert.equal(calls.filter(c=>c==='marketingDiretoConfirmar').length,1);
 assert.equal(calls.filter(c=>c==='marketingDiretoStatus').length,2);
 assert.match(document.querySelector('#b').textContent,/Autorização direta concluída/);
});
test('Diagnóstico Google distingue serviço desativado de escopo e não revela texto remoto',async()=>{
 for(const [reason,codigo] of [['SERVICE_DISABLED','api_desativada'],['ACCESS_TOKEN_SCOPE_INSUFFICIENT','escopo'],['DESCONHECIDO','permissao']]){
 const x=setup(async()=>new Response(JSON.stringify({error:{message:'DADO_PRIVADO',details:[{reason}]}}),{status:403}));
 x.dados.set('token_google',{access_token:'PRIVADO',exp:tempo+999999});
 await assert.rejects(x.d.listar('ga4'),e=>e.codigo===codigo&&!e.message.includes('DADO_PRIVADO'));
 }
});
test('UI OAuth: retorno recusado mantém botão para reconectar',async()=>{
 const {document}=parseHTML('<main></main>');
 const ctx=vm.createContext({document,console,Date,URLSearchParams,location:{search:'?fm=nonce&resultado=negado',pathname:'/'},history:{replaceState(){}},sessionStorage:{getItem:()=>prova}});
 vm.runInContext(readFileSync(new URL('../publico/marketing-direto.js',import.meta.url),'utf8'),ctx);
 const api=async()=>({ok:true,provedores:{google:{configurado:true,autorizado:false},meta:{}},fontes:Object.fromEntries(['ga4','search','perfil','instagram','meta_ads'].map(f=>[f,{}]))});
 ctx.LeoMarketingDireto.montar(document.querySelector('main'),{api});await new Promise(r=>setImmediate(r));
 assert.match(document.querySelector('main').textContent,/não concluiu a autorização/);assert.equal(document.querySelector('[data-conectar="google"]').hasAttribute('disabled'),false);
});
import {descobrirAds,metricasAds,pesquisarAds} from '../supabase/functions/leo-sync/marketing-direto-google-ads.mjs';
test('Google Ads: autorização isolada, PKCE, refresh e confirmação não substituem Analytics',async()=>{
 const x=setup();x.dados.set('token_google',{access_token:'ANALYTICS'});
 const u=new URL((await x.d.inicio('google_ads',prova,'dono')).url);assert.equal(u.searchParams.get('scope'),'https://www.googleapis.com/auth/adwords');assert.equal(u.searchParams.get('code_challenge_method'),'S256');
 const state=u.searchParams.get('state');assert.match(await x.d.callback(new URL(CALLBACK+'?state='+state+'&code=X')),/resultado=ok/);await x.d.confirmar(state.slice(3),prova,'dono');assert.equal(x.dados.get('token_google').access_token,'ANALYTICS');assert.equal(x.dados.get('token_google_ads').access_token,'PRIVADO');
});
test('Google Ads: contas gerenciadoras não viram contas de campanha e IDs estranhos são recusados',async()=>{
 const r=await descobrirAds(async(u,b)=>!b?{resourceNames:['customers/0000000001','customers/0000000002']}:{results:[{customer:{id:u.includes('0000000001')?'0000000001':'0000000002',manager:u.includes('0000000001'),descriptiveName:'Conta de teste'}}]});assert.equal(r.ativos.length,1);assert.equal(r.limitado,true);
 await assert.rejects(pesquisarAds(()=>assert.fail(), 'customers/1/../2','SELECT'),/vinculo/);
});
test('Google Ads: micros, moeda, conta e período preservados; total vem do agregado',async()=>{
 const calls=[];const r=await coletarFonte('google_ads',{id:'customers/0000000002'},async(u,b)=>{calls.push([u,b]);if(b.query.includes('customer.currency_code'))return {results:[{customer:{id:'0000000002',currencyCode:'USD',manager:false}}]};return {results:[{metrics:{costMicros:'2500000',clicks:'5',impressions:'100',conversions:2},segments:{date:'2026-06-01'},campaign:{name:'Teste'}}]};},tempo);
 assert.equal(r.moeda,'USD');assert.deepEqual(r.identidade,{conta:'0000000002',vinculo_confirmado:true});assert.equal(r.periodos[0].metricas.gasto,2.5);assert.equal(r.periodos[0].metricas.ctr,.05);assert.ok(calls.every(([u])=>u.endsWith('/googleAds:search')));assert.ok(calls.filter(([,b])=>!b.query.includes('customer.currency_code')).every(([,b])=>b.query.includes("'2026-05-18' AND '2026-06-14'")));assert.equal(metricasAds({}).gasto,null);
});
test('Google Ads: paginação sem fim falha e ausência de linhas não inventa zero',async()=>{
 await assert.rejects(pesquisarAds(async()=>({results:[],nextPageToken:'mais'}),'customers/0000000001','SELECT'),/coleta/);
 const r=await coletarFonte('google_ads',{id:'customers/0000000001'},async(u,b)=>b.query.includes('customer.currency_code')?{results:[{customer:{id:'0000000001',currencyCode:'BRL'}}]}:{},tempo);assert.deepEqual(r.periodos[0].metricas,{});
});

test('Diagnóstico do provedor não registra tokens, URL completa, mensagens ou identificadores',()=>{
 const d=diagnosticoProvedor('https://googleads.googleapis.com/v25/customers/123?access_token=SEGREDO',403,{error:{status:'PERMISSION_DENIED',message:'DADO_PRIVADO',details:[{reason:'SERVICE_DISABLED',metadata:{consumer:'projeto-privado'},errors:[{errorCode:{authenticationError:'DEVELOPER_TOKEN_HEADER_MISSING'},message:'TOKEN_PRIVADO',trigger:{stringValue:'SEGREDO'}}]}]}});
 assert.equal(d.servico,'googleads.googleapis.com');assert.deepEqual(d.codigos,['authenticationError:DEVELOPER_TOKEN_HEADER_MISSING']);assert.doesNotMatch(JSON.stringify(d),/SEGREDO|PRIVADO|123|projeto|access_token/);
 assert.equal(diagnosticoProvedor('https://outro.test',403,{error:{status:'token secreto'}}).status,'NAO_CLASSIFICADO');
});

test('Instagram sem ativo: diagnóstico distingue páginas ausentes e permissões sem expor dados',async()=>{
 const registros=[],original=console.warn;console.warn=(...x)=>registros.push(x.join(' '));
 try{
  const r=await descobrirAtivos('instagram',async u=>u.endsWith('/me/permissions')?{data:[{permission:'instagram_basic',status:'granted'},{permission:'campo_PRIVADO',status:'granted'}]}:{data:[{id:'id_PRIVADO',name:'nome_PRIVADO',instagram_business_account:{id:'ig_PRIVADO',username:'outra_marca'}}]});
  assert.deepEqual(r.ativos,[]);assert.equal(registros.length,1);assert.doesNotMatch(registros[0],/PRIVADO|outra_marca/);
  const d=JSON.parse(registros[0].slice(registros[0].indexOf('{')));assert.equal(d.paginas,1);assert.equal(d.comInstagram,1);assert.equal(d.permissoes.instagram_basic,true);assert.equal(d.permissoes.business_management,false);
  const vazio=await descobrirAtivos('instagram',async u=>{if(u.endsWith('/me/permissions'))throw Error('falha privada');return {data:[]}});assert.deepEqual(vazio.ativos,[]);assert.doesNotMatch(registros[1],/falha privada/);
 }finally{console.warn=original}
});

test('Instagram: página selecionada permite descoberta direta sem ampliar permissões',async()=>{
 const chamadas=[];const api=async u=>{chamadas.push(u);return u.includes('/me/accounts')?{data:[]}:{instagram_business_account:{id:'1234567',username:'fortemais'}}};
 const r=await descobrirAtivos('instagram',api,{paginaInstagram:'12345678'});
 assert.deepEqual(r.ativos,[{id:'1234567',nome:'@fortemais'}]);assert.equal(chamadas.length,2);assert.match(chamadas[1],/\/12345678\?fields=/);
 await assert.rejects(descobrirAtivos('instagram',api,{paginaInstagram:'../me'}),/vinculo/);
 const original=console.warn;console.warn=()=>{};
 try{const outra=await descobrirAtivos('instagram',async u=>u.includes('/me/')?{data:[]}:{instagram_business_account:{id:'1234567',username:'outra'}},{paginaInstagram:'12345678'});assert.deepEqual(outra.ativos,[])}finally{console.warn=original}
 const s=setup(async u=>new Response(JSON.stringify(u.includes('/me/accounts')?{data:[]}:{instagram_business_account:{id:'1234567',username:'fortemais'},username:'fortemais'})));
 s.dados.set('token_meta',{access_token:'PRIVADO',exp:tempo+999999});s.dados.set('pagina_instagram',{id:'12345678'});
 assert.equal((await s.d.listar('instagram')).ativos[0].nome,'@fortemais');assert.equal((await s.d.vincular('instagram','1234567')).ok,true);
});
