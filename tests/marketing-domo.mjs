import {test} from 'node:test';
import assert from 'node:assert/strict';
import {criarDireto,bancoDireto,CALLBACK} from '../supabase/functions/leo-sync/marketing-direto.mjs';
import {descobrirAtivos,validarAtivo,coletarFonte} from '../supabase/functions/leo-sync/marketing-direto-fontes.mjs';
import {resumirMarketing,lerMarketing} from '../supabase/functions/leo-sync/marketing.mjs';
const tempo=Date.parse('2026-06-17T12:00:00Z');
test('Domo: descoberta e validação aceitam somente o domínio e perfil próprios',async()=>{
 const api=async()=>({siteEntry:[{siteUrl:'https://fortemais.net/'},{siteUrl:'https://www.domoconstrutora.com.br/'},{siteUrl:'sc-domain:domoconstrutora.com.br'},{siteUrl:'https://domoconstrutora.com.br.evil.test/'}]});
 assert.deepEqual((await descobrirAtivos('search',api,{empresa:'domo'})).ativos.map(x=>x.id),['https://www.domoconstrutora.com.br/','sc-domain:domoconstrutora.com.br']);
 await validarAtivo('ga4',{id:'properties/123'},async()=>({dataStreams:[{webStreamData:{defaultUri:'https://www.domoconstrutora.com.br'}}]}),'domo');
 await assert.rejects(validarAtivo('search',{id:'https://fortemais.net/'},api,'domo'),/vinculo/);
 await assert.rejects(validarAtivo('instagram',{id:'123'},async()=>({username:'fortemais'}),'domo'),/vinculo/);
 await validarAtivo('instagram',{id:'123'},async()=>({username:'domoconstrutora'}),'domo');
});
test('Domo: GA4 consulta host próprio e nunca produz a identidade da Fortemais',async()=>{
 const bodies=[];const r=await coletarFonte('ga4',{id:'properties/123'},async(u,b)=>{bodies.push(b);return {rows:[{metricValues:b.metrics.map(()=>({value:'2'})),dimensionValues:[{value:'20260601'}]}]}},tempo,'domo');
 assert.equal(r.empresa,'domo');assert.equal(r.identidade.site,'https://www.domoconstrutora.com.br');
 assert.ok(bodies.every(b=>b.dimensionFilter.filter.inListFilter.values.every(h=>h.endsWith('domoconstrutora.com.br'))));
});
test('Domo: cofre e cache separados por empresa; empresa desconhecida não usa fallback',()=>{
 const chaves=[];const sb={from:t=>({select:()=>({eq:(k,v)=>({maybeSingle:async()=>{chaves.push([t,v]);return {data:null}}})}),upsert:async x=>{chaves.push([t,x.chave]);return {}}})};
 const d=bancoDireto(sb,'domo');return Promise.all([d.ler('token_google'),d.salvarFonte('ga4',{})]).then(()=>{assert.deepEqual(chaves,[['leo_config','marketing_domo_direto_token_google'],['painel_cache','leo_marketing_domo_direto_ga4']]);assert.throws(()=>bancoDireto(sb,'outra'),/invalido/)});
});
test('Domo: OAuth opaco vinculado à empresa, prova e dono; callback cruzado não consome pedido',async()=>{
 const dados=new Map(),banco={ler:async k=>dados.get(k),gravar:async(k,v)=>dados.set(k,v),consumir:async k=>{const v=dados.get(k);dados.delete(k);return v}};
 const opts={banco,env:()=> 'EXEMPLO',agora:()=>tempo,fetcher:async()=>new Response(JSON.stringify({access_token:'PRIVADO',refresh_token:'PRIVADO',expires_in:3600}))};
 const d=criarDireto({...opts,empresa:'domo'}),f=criarDireto(opts),prova='a'.repeat(64),u=new URL((await d.inicio('google',prova,'dono')).url),state=u.searchParams.get('state');
 assert.match(state,/^dm\.[a-f0-9]{64}$/);await assert.rejects(f.callback(new URL(CALLBACK+'?state='+state+'&code=X')),/state/);
 const ret=await d.callback(new URL(CALLBACK+'?state='+state+'&code=X'));assert.match(ret,/mkt=domo/);assert.equal(dados.has('token_google'),false);await d.confirmar(state.slice(3),prova,'dono');assert.equal(dados.get('token_google').access_token,'PRIVADO');
});
test('Domo: painel projeta apenas seu cache e mantém as métricas ausentes diferentes de zero',async()=>{
 const linhas=[{chave:'leo_marketing_fortemais_direto_ga4',valor:{empresa:'fortemais',identidade:{site:'https://fortemais.net'}}},{chave:'leo_marketing_domo_direto_ga4',valor:{empresa:'domo',estado:'ok',coletadoEm:new Date(tempo).toISOString(),identidade:{site:'https://www.domoconstrutora.com.br'},periodos:[{inicio:'2026-06-01',fim:'2026-06-14',completo:true,metricas:{usuarios:0},tabelas:{},serie:[]}]}}];
 const r=resumirMarketing('domo',linhas,tempo);assert.equal(r.detalhe.fontes.find(x=>x.id==='ga4').identidade,'domoconstrutora.com.br');assert.equal(r.detalhe.fontes[0].periodos[0].metricas.usuarios,0);assert.equal(r.detalhe.fontes[0].periodos[0].metricas.sessoes,null);
 const chaves=[];await lerMarketing({from:()=>({select:()=>({in:async(k,v)=>{chaves.push(...v);return {data:linhas}}})})},'domo',tempo);assert.ok(chaves.length>=6&&chaves.every(k=>k.startsWith('leo_marketing_domo')));
});
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
test('Domo UI: nomes, Instagram e pedidos administrativos ficam na empresa selecionada',async()=>{
 const {document}=parseHTML('<main></main>'),calls=[],ctx=vm.createContext({document,console,Date,URLSearchParams,location:{search:''}});
 vm.runInContext(readFileSync(new URL('../publico/marketing-fortemais.js',import.meta.url),'utf8'),ctx);
 const fontes=['ga4','search','perfil','instagram','google_ads','meta_ads'];
 ctx.LeoFortemaisMarketing.montar(document.querySelector('main'),{empresa:'domo',detalhe:resumirMarketing('domo',[],tempo).detalhe,api:async(m,b)=>{calls.push(b);return {ok:true,administracao:{fontes:Object.fromEntries(fontes.map(f=>[f,{situacao:'localizado'}]))}}}});
 assert.match(document.querySelector('main').textContent,/DOMO/);assert.doesNotMatch(document.querySelector('main').textContent,/Fortemais|FORTEMAIS/);
 document.querySelector('[data-aba="instagram"]').click();assert.equal(document.querySelector('a').getAttribute('href'),'https://www.instagram.com/domoconstrutora/');
 document.querySelector('[data-aba="admin"]').click();document.querySelector('[data-editar="ga4"]').click();await document.querySelector('form').onsubmit({preventDefault(){}});assert.equal(calls[0].empresa,'domo');
});
test('Domo UI: conexão envia empresa correta e o retorno restaura a empresa antes de ler',async()=>{
 const {document}=parseHTML('<main></main>'),calls=[],ctx=vm.createContext({document,console,Date,URL,URLSearchParams,location:{search:'?mkt=domo',pathname:'/'}});
 vm.runInContext(readFileSync(new URL('../publico/marketing-direto.js',import.meta.url),'utf8'),ctx);
 ctx.LeoMarketingDireto.montar(document.querySelector('main'),{empresa:'domo',api:async(m,b)=>{calls.push(b);return {ok:true,provedores:{google:{},google_ads:{},meta:{}},fontes:{}}}});await new Promise(r=>setImmediate(r));assert.equal(calls[0].empresa,'domo');
 vm.runInContext(readFileSync(new URL('../publico/marketing.js',import.meta.url),'utf8'),ctx);
 ctx.LeoMarketing.montar(document.querySelector('main'),{empresa:'fortemais',api:async(m,b)=>{calls.push(b);return resumirMarketing(b.empresa,[],tempo)}});await new Promise(r=>setImmediate(r));assert.equal(calls.at(-1).empresa,'domo');
});
