import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {setup} from './helpers/dom.mjs';
import {lerMarketing,resumirMarketing} from '../supabase/functions/leo-sync/marketing.mjs';

const agora=Date.parse('2026-06-17T12:00:00Z');
function retrato(){return [
 {chave:'mkt_fonte_google',valor:{partes:{ga4:{estado:'ok',coletado_em:new Date(agora).toISOString()},perfil:{estado:'aguardando_aprovacao'}},dados:{periodo:{inicio:'2026-06-01',fim:'2026-06-14'},ga4:{propriedade:{fluxo:{site:'https://www.impresilk.com.br'}},semanas:[{semana:'2026-06-01',usuarios:10,sessoes:12,visualizacoes:30,eventos_chave:0},{semana:'2026-06-08',usuarios:20,sessoes:22,visualizacoes:45,eventos_chave:null}],canais:[{semana:'2026-06-08',canal:'Direct',sessoes:12}],paginas:[{caminho:'/exemplo',visualizacoes:30}],refresh_token:'SEGREDO_NAO_PODE_SAIR'}}}},
 {chave:'mkt_fonte_meta',valor:{partes:{instagram:{estado:'ok',coletado_em:new Date(agora).toISOString()}},dados:{instagram:{usuario:'impresilk',por_semana:[{semana:'2026-06-01',madura:true,alcance:300,visualizacoes:600},{semana:'2026-06-08',madura:false,alcance:900,visualizacoes:1200}],bio:'privado',access_token:'SEGREDO_NAO_PODE_SAIR'}}}}
];}
function browser(){const {document,HTMLElement}=parseHTML('<main></main>');HTMLElement.prototype.focus=function(){};const ctx=vm.createContext({document,console,Date,URL});vm.runInContext(readFileSync(new URL('../publico/marketing.js',import.meta.url),'utf8'),ctx);return {document,m:ctx.LeoMarketing};}
const flush=()=>new Promise(r=>setImmediate(r));

test('marketing: vínculo de empresa impede reutilizar dados de Impresilk em Fortemais',()=>{
 const r=resumirMarketing('fortemais',retrato(),agora);assert.ok(r.fontes.every(f=>f.estado==='falta_conectar'&&f.semanas.length===0));
 assert.throws(()=>resumirMarketing('outra',retrato()),/Empresa inválida/);
});
test('marketing: aceita somente domínio e perfil exatamente vinculados',()=>{
 for(const site of ['https://impresilk.com.br.evil.test','https://outra.example']){const x=retrato();x[0].valor.dados.ga4.propriedade.fluxo.site=site;assert.equal(resumirMarketing('impresilk',x,agora).fontes[0].estado,'vinculo_divergente')}
 const x=retrato();x[1].valor.dados.instagram.usuario='outra';const r=resumirMarketing('impresilk',x,agora);assert.equal(r.fontes[2].semanas.length,0);
});
test('marketing: ausência, zero, únicos e semana imatura permanecem distintos',()=>{
 const r=resumirMarketing('impresilk',retrato(),agora);
 assert.equal(r.fontes[0].semanas[0].eventos_chave,0);assert.equal(r.fontes[0].semanas[1].eventos_chave,null);
 assert.equal(r.fontes[0].semanas[1].usuarios,20);assert.equal(r.fontes[2].semanas[1].alcance,null);
 assert.equal(r.fontes[1].estado,'aguardando_aprovacao');assert.equal(r.fontes[1].coletadoEm,null);
 assert.doesNotMatch(JSON.stringify(r),/SEGREDO|refresh_token|access_token|privado/);
});
test('marketing: não usa data geral para dar aparência atual a parte antiga',()=>{
 const x=retrato();x[0].valor.coletado_em=new Date(agora).toISOString();x[0].valor.partes.ga4.coletado_em='2026-06-01T12:00:00Z';
 const r=resumirMarketing('impresilk',x,agora);assert.equal(r.fontes[0].atrasado,true);
 delete x[0].valor.partes.ga4.coletado_em;assert.equal(resumirMarketing('impresilk',x,agora).fontes[0].semanas.length,0);
});
test('marketing: datas inválidas são descartadas e duplicidade falha sem inflar números',()=>{
 const x=retrato();x[0].valor.dados.ga4.semanas.push({semana:'2026-99-99'});assert.equal(resumirMarketing('impresilk',x,agora).fontes[0].semanas.length,2);
 x[0].valor.dados.ga4.semanas.push({semana:'2026-06-08'});assert.throws(()=>resumirMarketing('impresilk',x,agora),/duplicada/);
});
test('marketing: leitura consulta apenas cache permitido; erro não vira fonte vazia',async()=>{
 let consulta;const sb={from:t=>{assert.equal(t,'painel_cache');return {select:campos=>{assert.equal(campos,'chave,valor');return {in:async(k,v)=>{consulta=v;return {data:retrato(),error:null}}}}}}};
 await lerMarketing(sb,'fortemais');assert.equal(consulta,undefined);
 await lerMarketing(sb,'impresilk',agora);assert.deepEqual(consulta,['mkt_fonte_google','mkt_fonte_meta']);
 const falha={from:()=>({select:()=>({in:async()=>({error:{message:'token-privado'}})})})};
 await assert.rejects(lerMarketing(falha,'impresilk'),/Não foi possível consultar/);
});
test('marketing: a rota recusa terceiros e crachá OAuth antes de ler o banco',async()=>{
 const src=readFileSync(new URL('../supabase/functions/leo-sync/index.ts',import.meta.url),'utf8');
 const trecho=src.slice(src.indexOf('    if (acao === "marketingPainel")'),src.indexOf('    if (acao === "bancosGestao")'));
 const executar=new Function('req','crachaPayload','DONO','json','lerMarketing','sb','corpo','acao',`return (async()=>{${trecho}})()`);
 let chamadas=0;const ler=async()=>{chamadas++;return {ok:true}};
 const json=(x,status=200)=>new Response(JSON.stringify(x),{status});
 for(const p of [null,{uso:'oauth',sub:'dono',papel:'dono'},{uso:'',sub:'outro',papel:'dono'},{uso:'',sub:'dono',papel:'equipe'}]){
   const r=await executar(new Request('https://example.test'),async()=>p,'dono',json,ler,{}, {empresa:'impresilk'},'marketingPainel');assert.equal(r.status,401);
 }assert.equal(chamadas,0);
 const r=await executar(new Request('https://example.test'),async()=>({uso:'',sub:'dono',papel:'dono'}),'dono',json,ler,{}, {empresa:'impresilk'},'marketingPainel');assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(chamadas,1);
});
test('marketing UI: números reais do contrato, variações e rótulos sem soma de alcance',async()=>{
 const {document,m}=browser();m.montar(document.querySelector('main'),{empresa:'impresilk',api:async()=>resumirMarketing('impresilk',retrato(),agora)});await flush();
 assert.match(document.body?.textContent||document.documentElement.textContent,/Visitantes ativos/);
 assert.match(document.querySelector('.mkt-numeros').textContent,/20/);assert.match(document.querySelector('.mkt-numeros').textContent,/\+100%/);
 assert.match(document.querySelector('.mkt-grade').textContent,/Contas alcançadas/);assert.match(document.querySelector('.mkt-grade').textContent,/Sem dado confirmado/);
 document.querySelector('[data-resumo]').click();assert.match(document.querySelector('textarea').value,/Marketing · Impresilk/);
 assert.equal(m.variacao(0,0),null);assert.equal(m.variacao(0,10),-100);
});
test('marketing UI: troca rápida de empresa descarta resposta anterior',async()=>{
 const {document,m}=browser();let primeira;const api=(_,b)=>b.empresa==='impresilk'?new Promise(r=>primeira=r):Promise.resolve(resumirMarketing(b.empresa,[],agora));
 m.montar(document.querySelector('main'),{empresa:'impresilk',api});
 document.querySelector('[data-empresa]').onchange({target:{value:'fortemais'}});await flush();
 primeira(resumirMarketing('impresilk',retrato(),agora));await flush();
 assert.equal(document.querySelector('[data-empresa]').value,'fortemais');assert.match(document.querySelector('.mkt-grade').textContent,/@fortemais/);assert.doesNotMatch(document.querySelector('.mkt-grade').textContent,/@impresilk/);
});
test('marketing UI: resposta de outra empresa e falha não viram métricas zeradas',async()=>{
 for(const api of [async()=>{throw Error('senha-privada')},async()=>resumirMarketing('impresilk',retrato(),agora)]){
 const {document,m}=browser();m.montar(document.querySelector('main'),{empresa:'fortemais',api});await flush();assert.match(document.querySelector('[role=alert]').textContent,/Não foi possível consultar/);assert.equal(document.querySelector('.mkt-numeros'),null);assert.doesNotMatch(document.documentElement.textContent,/senha-privada/);
 }});
test('marketing UI: valores externos não se transformam em HTML',async()=>{
 const x=retrato();x[0].valor.dados.ga4.canais[0].canal='<img src=x onerror=alert(1)>';
 const {document,m}=browser();m.montar(document.querySelector('main'),{empresa:'impresilk',api:async()=>resumirMarketing('impresilk',x,agora)});await flush();assert.equal(document.querySelector('img'),null);assert.match(document.querySelector('[data-tabelas]').textContent,/<img/);
});
test('marketing: navegação lateral e atalho Fortemais abrem a área integrada',async()=>{
 const {run,document,ctx}=setup();ctx.resposta=resumirMarketing('fortemais',[],agora);
 run('E=structuredClone(SEED);apiSync=async()=>resposta;atual="fortemais";vFortemais(document.getElementById("main"))');await flush();
 document.querySelector('.fm-marketing-atalho button').click();await flush();
 assert.equal(run('atual'),'marketing');assert.ok(document.querySelector('.mkt-painel'));assert.equal(document.querySelector('[data-empresa]').value,'fortemais');
});
