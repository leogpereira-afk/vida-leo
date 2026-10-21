import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {setup as setupCentral} from './helpers/dom.mjs';

const source=readFileSync(new URL('../publico/inicio-google.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function setup({responder,conectado=()=>true}={}){
 const {document}=parseHTML('<html><body><main></main></body></html>');
 const chamadas=[],destinos=[];
 const ctx=vm.createContext({document,URL,URLSearchParams,Date,Intl,console});
 vm.runInContext(source,ctx);
 const api=vm.runInContext('InicioGoogle',ctx).criar({
  conectado,renovar:async()=>{},conexoes:()=>destinos.push('config'),abrirDrive:p=>destinos.push(p||'drive'),
  ler:async(s,p)=>{chamadas.push([s,p]);return responder?responder(s,p):s==='agenda'?{items:[]}:s==='drive'?{files:[]}:p.startsWith('profile')?{emailAddress:'demo@example.test'}:{messages:[]}}
 });
 const montar=()=>{const node=api.montar();document.querySelector('main').replaceChildren(node);return node};
 return{document,api,montar,chamadas,destinos};
}
const evento=(id,summary,start,end,extra={})=>({id,summary,start,end,...extra});

test('início sem autorização não consulta dados nem abre login automaticamente',async()=>{
 const x=setup({conectado:()=>false});x.montar();await tick();
 assert.equal(x.chamadas.length,0);assert.equal(x.document.querySelectorAll('.ig-card').length,3);
 assert.equal(x.document.querySelectorAll('[data-conectar]').length,3);
 x.document.querySelector('[data-conectar]').click();assert.deepEqual(x.destinos,['config']);
});
test('Agenda exclui cancelados, recusados e encerrados; conserva dia inteiro e ordena próximos',async()=>{
 const dia=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const fim=new Date(dia+'T12:00:00Z');fim.setUTCDate(fim.getUTCDate()+1);const amanha=fim.toISOString().slice(0,10);
 const x=setup({responder:async(s,p)=>s==='agenda'?{items:[
  evento('f','Futuro',{dateTime:'2099-03-02T13:00:00-03:00'},{dateTime:'2099-03-02T14:00:00-03:00'}),
  evento('c','Cancelado',{date:dia},{date:amanha},{status:'cancelled'}),
  evento('a','Dia inteiro',{date:dia},{date:amanha}),
  evento('v','Encerrado',{date:'2020-01-01'},{date:'2020-01-02'}),
  evento('r','Recusado',{date:dia},{date:amanha},{attendees:[{self:true,responseStatus:'declined'}]})
 ]}:s==='drive'?{files:[]}:{messages:[]}});x.montar();await tick();
 const texto=x.document.querySelector('[data-servico="agenda"]').textContent;
 assert.match(texto,/Dia inteiro/);assert.match(texto,/Futuro/);assert.doesNotMatch(texto,/Cancelado|Encerrado|Recusado/);
 assert.ok(texto.indexOf('Dia inteiro')<texto.indexOf('Futuro'));
 const url=new URL('https://example.test/'+x.chamadas.find(c=>c[0]==='agenda'&&c[1].startsWith('calendars/primary/events'))[1]);
 assert.equal(url.searchParams.get('singleEvents'),'true');assert.equal(url.searchParams.get('orderBy'),'startTime');assert.ok(url.searchParams.get('timeMin'));
});
test('Gmail usa somente metadados, escapa texto e abre a conta autorizada pelo ID da conversa',async()=>{
 const x=setup({responder:async(s,p)=>s==='agenda'?{items:[]}:s==='drive'?{files:[]}:p.startsWith('profile')?{emailAddress:'demo@example.test'}:p.startsWith('messages?')?{messages:[{id:'abc'}]}:{id:'abc',threadId:'thread-123',internalDate:String(Date.now()),labelIds:['UNREAD'],payload:{headers:[{name:'Subject',value:'<img src=x onerror=alert(1)>'},{name:'From',value:'Cliente <cliente@example.test>'}]}}});x.montar();await tick();
 const card=x.document.querySelector('[data-servico="gmail"]');assert.equal(card.querySelectorAll('img').length,0);assert.match(card.textContent,/<img/);assert.match(card.textContent,/Não lido/);
 const link=card.querySelector('.ig-item');assert.match(link.getAttribute('href'),/authuser=demo%40example.test#inbox\/thread-123/);
 assert.ok(x.chamadas.some(([,p])=>p.includes('format=metadata')));assert.ok(x.chamadas.every(([,p])=>!p.includes('format=full')));
});
test('atalhos do Drive mantêm ID e levam à pasta na Central',async()=>{
 const x=setup({responder:async(s)=>s==='drive'?{files:[{id:'id-1',name:'Pasta de trabalho'}]}:s==='agenda'?{items:[]}:{messages:[]}});x.montar();await tick();
 x.document.querySelector('[data-servico="drive"] .ig-item').click();assert.equal(x.destinos[0].id,'id-1');assert.equal(x.destinos[0].name,'Pasta de trabalho');
});
test('falha do Gmail não esconde Agenda e Drive; erro não vira caixa vazia',async()=>{
 const x=setup({responder:async(s)=>{if(s==='gmail')throw Error('Sem resposta do Google');return s==='drive'?{files:[{id:'1',name:'Pasta disponível'}]}:{items:[]}}});x.montar();await tick();
 assert.match(x.document.querySelector('[data-servico="gmail"]').textContent,/Sem resposta/);assert.doesNotMatch(x.document.querySelector('[data-servico="gmail"]').textContent,/Caixa de entrada vazia/);
 assert.match(x.document.querySelector('[data-servico="drive"]').textContent,/Pasta disponível/);
});
test('respostas parciais do Gmail são identificadas sem fingir consulta completa',async()=>{
 const x=setup({responder:async(s,p)=>{if(s==='agenda')return{items:[]};if(s==='drive')return{files:[]};if(p.startsWith('profile'))return{emailAddress:'demo@example.test'};if(p.startsWith('messages?'))return{messages:[{id:'ok'},{id:'erro'}]};if(p.startsWith('messages/erro'))throw Error('indisponível');return{id:'ok',payload:{headers:[{name:'Subject',value:'Mensagem disponível'}]}}}});x.montar();await tick();
 assert.match(x.document.querySelector('[data-servico="gmail"]').textContent,/Mensagem disponível/);assert.match(x.document.querySelector('[data-servico="gmail"]').textContent,/parcial/i);
});
test('remontagem reutiliza consulta em andamento e cache; atualizar força leitura',async()=>{
 const x=setup();x.montar();x.montar();await tick();const total=x.chamadas.length;x.montar();await tick();assert.equal(x.chamadas.length,total);
 x.document.querySelector('[data-servico="agenda"] [data-atualizar]').click();await tick();assert.equal(x.chamadas.length,total+2);
});
test('desconectar limpa dados e respostas antigas não reaparecem',async()=>{
 let liberar,conectado=true;const x=setup({conectado:()=>conectado,responder:async(s)=>s==='drive'?new Promise(r=>{liberar=r}):s==='agenda'?{items:[]}:{messages:[]}});
 x.montar();await tick();conectado=false;x.api.limpar();x.montar();liberar({files:[{id:'1',name:'Dado antigo'}]});await tick();
 assert.doesNotMatch(x.document.querySelector('main').textContent,/Dado antigo/);assert.equal(x.document.querySelectorAll('[data-conectar]').length,3);
});
test('resumo não segue links externos recebidos do conteúdo do calendário',async()=>{
 const x=setup({responder:async(s)=>s==='agenda'?{items:[evento('x','Compromisso',{date:'2099-01-01'},{date:'2099-01-02'},{htmlLink:'https://exemplo-malicioso.test/'})]}:s==='drive'?{files:[]}:{messages:[]}});x.montar();await tick();
 assert.equal(x.document.querySelector('[href="https://exemplo-malicioso.test/"]'),null);assert.match(x.document.querySelector('[data-servico="agenda"]').textContent,/Compromisso/);
});
test('Agenda ordena horários com fusos diferentes pela hora real',async()=>{
 const x=setup({responder:async(s)=>s==='agenda'?{items:[
  evento('a','Mais tarde',{dateTime:'2099-01-01T23:30:00-03:00'},{dateTime:'2099-01-02T00:00:00-03:00'}),
  evento('b','Primeiro',{dateTime:'2099-01-02T01:00:00Z'},{dateTime:'2099-01-02T01:30:00Z'})
 ]}:s==='drive'?{files:[]}:{messages:[]}});x.montar();await tick();
 const linhas=x.document.querySelectorAll('[data-servico="agenda"] .ig-item');assert.match(linhas[0].textContent,/Primeiro/);assert.match(linhas[0].textContent,/22:00/);
});
test('Drive continua uma página vazia que possui cursor, sem perder pastas',async()=>{
 const x=setup({responder:async(s,p)=>s==='drive'?(p.includes('pageToken=segunda')?{files:[{id:'p',name:'Pasta da segunda página'}]}:{files:[],nextPageToken:'segunda'}):s==='agenda'?{items:[]}:{messages:[]}});x.montar();await tick();
 assert.match(x.document.querySelector('[data-servico="drive"]').textContent,/Pasta da segunda página/);assert.equal(x.chamadas.filter(c=>c[0]==='drive').length,2);
});
test('permissões parciais só consultam o serviço liberado',async()=>{
 const x=setup({conectado:s=>s==='drive'});x.montar();await tick();assert.deepEqual(x.chamadas.map(c=>c[0]),['drive']);assert.equal(x.document.querySelectorAll('[data-conectar]').length,2);
});
test('links da Agenda apontam para a conta autorizada, sem assumir a primeira conta do navegador',async()=>{
 const x=setup({responder:async(s,p)=>s==='agenda'?(p.startsWith('calendars/primary?')?{id:'agenda@example.test'}:{items:[evento('a','Reunião',{date:'2099-01-01'},{date:'2099-01-02'},{htmlLink:'https://www.google.com/calendar/event?eid=demo'})]}):s==='drive'?{files:[]}:{messages:[]}});x.montar();await tick();
 // Linkedom reencoda % em a.href; o atributo preserva a URL entregue ao navegador.
 for(const a of x.document.querySelectorAll('[data-servico="agenda"] a'))assert.equal(new URL(a.getAttribute('href')).searchParams.get('authuser'),'agenda@example.test');
});
test('tela inicial integra três resumos sem importar eventos ou guardar mensagens',async()=>{
 const {run,document}=setupCentral();
 run("for(const s of ['drive','gmail','agenda'])googleSessao[s]={token:'demo',vence:Date.now()+3600000,origem:'servidor'};googleLer=async(s,p)=>s==='agenda'?{items:[]}:s==='drive'?{files:[{id:'pasta-id',name:'Pasta de teste'}]}:p.startsWith('profile')?{emailAddress:'demo@example.test'}:{messages:[]};window.__dadosAntes=JSON.stringify(E);atual='inicio';tela()");await tick();
 assert.equal(document.querySelectorAll('.inicio-google .ig-card').length,3);assert.equal(run('JSON.stringify(E)'),run('window.__dadosAntes'));
 run("vDrive=()=>{};googleConectado=()=>true");document.querySelector('[data-servico="drive"] .ig-item').click();
 assert.equal(run('atual'),'drive');assert.equal(run('filtro.drive.pasta'),'pasta-id');assert.equal(run('filtro.drive.trilha.at(-1).id'),'pasta-id');
});
