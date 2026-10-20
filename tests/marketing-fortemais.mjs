import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {CATALOGO,CHAVE_FORTEMAIS,CHAVE_ADMIN,detalharFortemais,limparAdmin,salvarAdminFortemais} from '../supabase/functions/leo-sync/marketing-fortemais.mjs';
const agora=Date.parse('2026-06-17T12:00:00Z');
const data=new Date(agora).toISOString();
function linhas(){return [{chave:CHAVE_FORTEMAIS,valor:{empresa:'fortemais',fontes:{ga4:{empresa:'fortemais',estado:'ok',identidade:{site:'https://fortemais.net'},coletadoEm:data,periodos:[{inicio:'2026-06-01',fim:'2026-06-07',completo:true,metricas:{usuarios:10,eventos_chave:0,access_token:'SEGREDO'},tabelas:{paginas:[{nome:'/exemplo',visualizacoes:20,token:'SEGREDO'}]},serie:[{dia:'2026-06-01',usuarios:5},{dia:'2026-06-02',usuarios:7}]}]}}}},{chave:CHAVE_ADMIN,valor:{fontes:{ga4:{responsavel:'Pessoa de teste',conta:'teste@example.test',situacao:'localizado',token:'SEGREDO'}}}}]}
function ui(d=detalharFortemais(linhas(),agora),api=async()=>({ok:true,administracao:limparAdmin({})})){
 const {document,HTMLElement}=parseHTML('<main></main>');HTMLElement.prototype.focus=function(){};
 const ctx=vm.createContext({Date,document,console});vm.runInContext(readFileSync(new URL('../publico/marketing-fortemais.js',import.meta.url),'utf8'),ctx);
 const controle=ctx.LeoFortemaisMarketing.montar(document.querySelector('main'),{detalhe:d,api});return {document,m:ctx.LeoFortemaisMarketing,controle};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('Fortemais: seis fontes separadas; não herda métricas de outro cache ou empresa',()=>{
 const d=detalharFortemais([{chave:'mkt_fonte_google',valor:linhas()[0].valor}],agora);assert.equal(d.fontes.length,6);assert.ok(d.fontes.every(f=>f.estado==='pendente'&&!f.periodos.length));
 const x=linhas();x[0].valor.empresa='impresilk';assert.ok(detalharFortemais(x,agora).fontes.every(f=>f.estado==='pendente'));
});
test('Fortemais: host exato, perfil e conta de mídia validada; nome sozinho não vincula',()=>{
 const x=linhas(),fs=x[0].valor.fontes;fs.ga4.identidade.site='https://fortemais.net.evil.test';fs.instagram={...fs.ga4,identidade:{usuario:'outro'}};fs.meta_ads={...fs.ga4,identidade:{conta:'12345'}};
 const d=detalharFortemais(x,agora);for(const id of ['ga4','instagram','meta_ads'])assert.equal(d.fontes.find(f=>f.id===id).estado,'vinculo_divergente');
 fs.meta_ads.identidade.vinculo_confirmado=true;fs.meta_ads.moeda='USD';assert.equal(detalharFortemais(x,agora).fontes.find(f=>f.id==='meta_ads').moeda,'USD');
});
test('Fortemais: dados explicitamente projetados; totais distintos não somam dias; nulo difere de zero',()=>{
 const f=detalharFortemais(linhas(),agora).fontes[0];assert.equal(f.periodos[0].metricas.usuarios,10);assert.equal(f.periodos[0].metricas.eventos_chave,0);assert.equal(f.periodos[0].metricas.sessoes,null);assert.doesNotMatch(JSON.stringify(f),/SEGREDO|token/);
});
test('Fortemais: períodos inválidos, dias duplicados e dados sem data não ganham confirmação',()=>{
 const x=linhas(),f=x[0].valor.fontes.ga4,p=f.periodos[0];f.periodos.push({...p},{...p,inicio:'2026-02-31'},{...p,inicio:'2026-07-02',fim:'2026-07-01'});p.serie.push({dia:'2026-06-01',usuarios:500},{dia:'2026-06-08',usuarios:8});
 let r=detalharFortemais(x,agora).fontes[0];assert.equal(r.periodos.length,1);assert.equal(r.periodos[0].serie.length,2);
 delete f.coletadoEm;r=detalharFortemais(x,agora).fontes[0];assert.equal(r.estado,'erro');assert.equal(r.periodos.length,0);
 f.coletadoEm='2026-06-01T12:00:00Z';assert.equal(detalharFortemais(x,agora).fontes[0].atrasado,true);
 f.coletadoEm='2026-08-01T12:00:00Z';assert.equal(detalharFortemais(x,agora).fontes[0].estado,'erro');
});
test('Fortemais: falha e permissão insuficiente não aparecem como zero',()=>{
 for(const estado of ['sem_permissao','reconectar','erro']){const x=linhas();x[0].valor.fontes.ga4.estado=estado;const f=detalharFortemais(x,agora).fontes[0];assert.equal(f.estado,estado);assert.equal(f.periodos.length,0)}
});
test('Fortemais: administração salva somente campos permitidos e não altera métricas',async()=>{
 let salvo;const sb={from:t=>{assert.equal(t,'painel_cache');return {upsert:async x=>{salvo=x;return {error:null}}}}};
 const r=await salvarAdminFortemais(sb,{fontes:{ga4:{responsavel:'x'.repeat(500),situacao:'online',token:'SEGREDO',conta:'teste@example.test'}}});assert.equal(salvo.chave,CHAVE_ADMIN);assert.equal(r.administracao.fontes.ga4.responsavel.length,240);assert.equal(r.administracao.fontes.ga4.situacao,'nao_verificado');assert.doesNotMatch(JSON.stringify(salvo),/SEGREDO|token/);
 await assert.rejects(salvarAdminFortemais({from:()=>({upsert:async()=>({error:{}})})},{}),/Não foi possível salvar/);
});
test('Fortemais: rota de administração exige dono, uso e empresa exatos',async()=>{
 const src=readFileSync(new URL('../supabase/functions/leo-sync/index.ts',import.meta.url),'utf8');const parte=src.slice(src.indexOf('    if (acao === "marketingAdministracao")'),src.indexOf('    if (acao === "marketingPainel")'));
 const executar=new Function('req','crachaPayload','DONO','json','salvarAdminFortemais','sb','corpo','acao',`return (async()=>{${parte}})()`);const json=(x,status=200)=>new Response(JSON.stringify(x),{status});let salvos=0;
 const salvar=async()=>{salvos++;return {ok:true}};
 for(const p of [null,{uso:'oauth',sub:'dono',papel:'dono'},{uso:'',sub:'outro',papel:'dono'},{uso:'',sub:'dono',papel:'equipe'}])assert.equal((await executar(new Request('https://example.test'),async()=>p,'dono',json,salvar,{}, {empresa:'fortemais'},'marketingAdministracao')).status,401);
 const p={uso:'',sub:'dono',papel:'dono'};assert.equal((await executar(new Request('https://example.test'),async()=>p,'dono',json,salvar,{}, {empresa:'desconhecida'},'marketingAdministracao')).status,400);assert.equal(salvos,0);
 const r=await executar(new Request('https://example.test'),async()=>p,'dono',json,salvar,{}, {empresa:'fortemais'},'marketingAdministracao');assert.equal(r.status,200);assert.equal(salvos,1);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('Fortemais UI: sete áreas, período explícito, catálogo completo e resumo fiel',()=>{
 const {document,m}=ui();assert.equal(document.querySelectorAll('.fmkt-tabs button').length,7);
 for(const [id,def] of Object.entries(CATALOGO).filter(([id])=>!['facebook','pixel','linkedin','pinterest'].includes(id))){document.querySelector('.fmkt-tabs [data-aba="'+(id.endsWith('_ads')?'anuncios':id)+'"]').click();assert.match(document.querySelector('.fmkt-corpo').textContent,new RegExp(def.nome));}
 document.querySelector('.fmkt-tabs [data-aba="visao"]').click();document.querySelector('[data-fm-resumo]').click();assert.match(document.querySelector('textarea').value,/Visitantes ativos: 10/);assert.match(document.querySelector('textarea').value,/01\/06\/2026 a 07\/06\/2026/);assert.doesNotMatch(document.querySelector('textarea').value,/SEGREDO/);
 assert.match(m.valor(15,'moeda'),/moeda não informada/);assert.match(m.valor(15,'moeda','USD'),/US\$/);assert.equal(m.valor(null),'—');assert.equal(m.valor(0), '0');
});
test('Fortemais UI: editar preserva campos após falha e confirmação de cadastro não vira leitura',async()=>{
 let payload;let falhar=true;const {document,controle}=ui(undefined,async(_,b)=>{payload=b;if(falhar)throw Error('segredo');return {ok:true,administracao:limparAdmin(b.administracao)}});
 document.querySelector('.fmkt-tabs [data-aba=admin]').click();document.querySelector('[data-editar=instagram]').click();assert.equal(controle.podeAtualizar(),false);
 document.querySelector('[name=responsavel]').value='Responsável de teste';const form=document.querySelector('form');await form.onsubmit({preventDefault(){}});assert.equal(document.querySelector('[name=responsavel]').value,'Responsável de teste');assert.match(document.querySelector('[role=status]').textContent,/Não foi possível salvar/);
 falhar=false;await form.onsubmit({preventDefault(){}});assert.equal(payload.empresa,'fortemais');assert.equal(controle.podeAtualizar(),true);assert.match(document.querySelector('[role=status]').textContent,/Cadastro salvo/);assert.match(document.querySelector('.fmkt-admin-grid').textContent,/Sem coleta confirmada/);
});
test('Fortemais UI: strings externas não executam HTML, editar impede perda em navegação',()=>{
 const x=linhas();x[1].valor.fontes.ga4.responsavel='<img src=x onerror=alert(1)>';const {document}=ui(detalharFortemais(x,agora));document.querySelector('.fmkt-tabs [data-aba=admin]').click();assert.equal(document.querySelector('img[onerror],img[src="x"]'),null);
 document.querySelector('[data-editar=ga4]').click();document.querySelector('[name=conta]').value='nova@example.test';document.querySelector('.fmkt-tabs [data-aba=ga4]').click();assert.equal(document.querySelector('[name=conta]').value,'nova@example.test');assert.match(document.querySelector('[role=status]').textContent,/Salve ou cancele/);
});

// A conexão autorizada não comprova coleta, e um bloqueio deve continuar visível.
test('Fortemais UI: separa autorização bloqueada, autorizada e dados coletados',()=>{
 const x=linhas();delete x[0].valor.fontes.ga4;
 x[1].valor.fontes.ga4={situacao:'bloqueado',observacao:'Provedor recusou a autorização.'};
 x[1].valor.fontes.instagram={situacao:'autorizado'};
 const {document}=ui(detalharFortemais(x,agora));
 document.querySelector('.fmkt-tabs [data-aba=ga4]').click();
 assert.match(document.querySelector('.fmkt-corpo').textContent,/Autorização bloqueada pelo provedor/);
 assert.match(document.querySelector('.fmkt-corpo').textContent,/Sem coleta confirmada/);
 assert.doesNotMatch(document.querySelector('.fmkt-corpo').textContent,/Leitura confirmada/);
 document.querySelector('.fmkt-tabs [data-aba=instagram]').click();
 assert.match(document.querySelector('.fmkt-corpo').textContent,/Autorizado · falta validar coleta/);
 assert.match(document.querySelector('.fmkt-corpo').textContent,/Sem coleta confirmada/);
});

test('Marketing visual: comparação exige períodos adjacentes completos, mesma duração e base positiva',()=>{
 const {m}=ui();const atual={inicio:'2026-06-08',fim:'2026-06-14',completo:true,metricas:{usuarios:150}};
 const anterior={inicio:'2026-06-01',fim:'2026-06-07',completo:true,metricas:{usuarios:100}};
 const f={estado:'ok',atrasado:false,periodos:[atual,anterior]};
 assert.equal(m.compararPeriodo(f,atual,'usuarios').percentual,.5);
 for(const v of [0,null,undefined])assert.equal(m.compararPeriodo({...f,periodos:[atual,{...anterior,metricas:{usuarios:v}}]},atual,'usuarios'),null);
 for(const q of [{...anterior,completo:false},{...anterior,inicio:'2026-05-31'},{...anterior,fim:'2026-06-06'}])assert.equal(m.compararPeriodo({...f,periodos:[atual,q]},atual,'usuarios'),null);
 assert.equal(m.compararPeriodo(f,{...atual,completo:false},'usuarios'),null);
 assert.equal(m.compararPeriodo({...f,atrasado:true},atual,'usuarios'),null);
 assert.equal(m.compararPeriodo({...f,estado:'parcial'},atual,'usuarios'),null);
 assert.equal(m.compararPeriodo(f,{...atual,metricas:{usuarios:null}},'usuarios'),null);
});
test('Marketing visual: visão geral mostra seis canais sem somar métricas e preserva zero nos detalhes',()=>{
 const {document}=ui();assert.equal(document.querySelectorAll('[data-canal]').length,6);
 document.querySelector('.fmkt-tabs [data-aba=ga4]').click();
 const extras=document.querySelector('.fmkt-extra');assert.ok(extras);assert.match(extras.textContent,/Eventos principais0Período consolidado/);
 assert.ok(document.querySelectorAll('.fmkt-ausente').length>0);
 assert.equal(document.querySelectorAll('.fmkt-kpis')[0].children.length,4);
});
test('Marketing visual: destaque ordena até cinco registros recebidos, escapa texto e não muda a tabela',()=>{
 const x=linhas(),p=x[0].valor.fontes.ga4.periodos[0];p.tabelas.paginas=Array.from({length:7},(_,i)=>({nome:i===6?'<img src=x onerror=alert(1)>':'/pagina-'+i,visualizacoes:i*10}));
 const {document}=ui(detalharFortemais(x,agora));document.querySelector('.fmkt-tabs [data-aba=ga4]').click();
 assert.equal(document.querySelectorAll('.fmkt-ranking li').length,5);
 assert.equal(document.querySelector('.fmkt-ranking strong').textContent,'60');
 assert.match(document.querySelector('.fmkt-ranking').textContent,/<img/);
 assert.equal(document.querySelector('img[onerror]'),null);
 assert.equal(document.querySelector('.fmkt-table tbody').children.length,7);
});
