import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const IDS=['inicio','rendimentos','gastos','patrimonio','caixavgv','viagens','agenda','demandas','saude','estrategia','fortemais','oportunidades','documentos','guia','config'];
function dados(run){run("E.perfil={nascimento:'1986-01-01'};E.rendimentos=[{id:'r',data:'2026-09-01',empresa:'Teste',tipo:'Outro',valor:1000}];E.gastos=[{id:'g',mes:'2026-09',classe:'Casa',oque:'Teste',valor:100}];E.documentos=[{id:'doc',nome:'Teste',dono:'Léo',validade:'2026-01-01'}];E.demandas=[{id:'dem',titulo:'Teste',status:'Aberta',prazo:'2026-09-01'}];E.patrimonio=[{id:'bem',nome:'Teste',valor:1000,falta:100}];E.empresasPJ=[{id:'pj',nome:'Teste',status:'Ativa'}];E.agenda=[{id:'ag',titulo:'Teste',data:'2026-09-01'}];E.peso=[{id:'peso',data:'2026-09-01',peso:80}];E.exames=[{id:'ex',exame:'Teste',data:'2026-09-01',valor:'10'}];E.obras=[{id:'obra',nome:'Obra teste',vendaValor:1000,status:'Vendida'}];E.contas=[{id:'conta',nome:'Conta teste',tipo:'Dinheiro',valor:100}];E.empreend=[{id:'emp',nome:'Empreendimento teste',vgv:1000,aporteTotal:100,aporteResidual:50,previsao:200}];E.reservas=[{id:'res',nome:'Reserva teste',valor:100}];E.oportunidades=[{id:'op',titulo:'Oportunidade teste',estagio:'Analisando',tipo:'Outro',proximoPasso:'Revisar'}];E.pessoas=[{id:'p',nome:'Pessoa teste'}];E.viagens=[{id:'viagem',evento:'Teste',ida:'2026-09-01',volta:'2026-09-05',status:'Confirmado',hoteis:[],passagens:[],tickets:[]}];");}
async function render(id,populated=true){
 const app=setup(),{run,document}=app;
 if(populated)dados(run);
 run(`atual='${id}';document.getElementById('main').replaceChildren();`);
 await run(`MODS.find(x=>x.id==='${id}').render(document.getElementById('main'))`);
 run(`if(['gastos','rendimentos'].includes(atual))organizarFinanceiro(document.getElementById('main'),atual);else if(atual==='saude')organizarSaude(document.getElementById('main'));else indiceDaTela(document.getElementById('main'));prepararTabelas(document.getElementById('main'))`);
 return {...app,main:document.getElementById('main')};
}
for(const populated of [false,true])for(const id of IDS)test(`${id}: monta ${populated?'com registros':'vazia'} e cartões respondem`,async()=>{
 const {main}=await render(id,populated);
 assert.ok(main.querySelector('h1'));
 const ids=[...main.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,'IDs devem ser únicos');
 for(const card of [...main.querySelectorAll('[data-kpi]')])assert.doesNotThrow(()=>card.onclick?.(),card.textContent);
 assert.equal(main.querySelector('[role="alert"]'),null);
});
test('saúde: cartões de exames pertencem somente à Saúde',async()=>{const saude=await render('saude');assert.equal(saude.main.querySelectorAll('.saude-exames-mobile button').length,1);const viagens=await render('viagens');assert.equal(viagens.main.querySelector('.saude-exames-mobile'),null)});
test('saúde: aba Medidas mostra seus quadros e oculta resumo',async()=>{const {main}=await render('saude');main.querySelector('[data-area="medidas"]').click();assert.equal(main.querySelector('#saude-medidas').hidden,false);assert.equal(main.querySelector('#saude-resumo').hidden,true);assert.ok(main.querySelector('#saude-medidas [data-bid="sa-peso"]'))});
test('gastos: aba Recorrentes inclui casa e seguros',async()=>{const {main}=await render('gastos');main.querySelector('[data-aba="recorrentes"]').click();assert.equal(main.querySelector('#finance-recorrentes').hidden,false);assert.ok(main.querySelector('#finance-recorrentes [data-bid="gt-seg"]'));assert.ok(main.querySelector('#finance-recorrentes [data-bid="gt-casa"]'))});

test('patrimônio: tabela móvel mantém rótulos e acesso por teclado',async()=>{const {main}=await render('patrimonio');const tr=main.querySelector('tbody tr');assert.equal(tr.getAttribute('role'),'button');assert.ok(main.querySelector('.tabela-adaptavel td[data-label="Bem"]'))});
test('documentos: sem validade não recebe selo Em dia',async()=>{const {run,main}=await render('documentos',false);run("E.documentos=[{id:'d',nome:'Teste',dono:'Léo',validade:''}];document.getElementById('main').replaceChildren();vDocumentos(document.getElementById('main'))");assert.match(main.textContent,/Validade não informada/)});

test('cadastro: edição na tabela altera o registro correto',async()=>{const {main,run,document}=await render('agenda');const campo=main.querySelector('[data-bid="ag-lista"] input[data-k="titulo"]');campo.value='Compromisso atualizado';campo.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));assert.equal(run('E.agenda[0].titulo'),'Compromisso atualizado')});

test('Gmail: consulta anexo sem gravar e importa somente após seleção',async()=>{
 const {run,ctx,document}=setup();
 const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:teste-gmail\r\nDTSTART:20990908T150000Z\r\nSUMMARY:Reunião teste\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const calls=[];ctx.gmailMock=async path=>{calls.push(path);if(path.startsWith('messages?'))return {messages:[{id:'m1'}]};if(path==='messages/m1?format=full')return {id:'m1',internalDate:'100',payload:{parts:[{mimeType:'text/calendar',body:{attachmentId:'a1'}}]}};if(path==='messages/m1/attachments/a1')return {data:Buffer.from(ics).toString('base64url')};throw Error(path)};
 run('gmailApi=gmailMock');const result=await run('consultarConvitesGmail()');
 assert.equal(result.plano.length,1);assert.equal(run('E.agenda.length'),0);assert.equal(calls.length,3);
 ctx.resultadoTeste=result;run('revisarConvitesGmail(resultadoTeste)');
 const input=document.querySelector('.google-evento input');const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Importar selecionados');
 assert.equal(button.disabled,true);assert.equal(run('E.agenda.length'),0);
 input.checked=true;input.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));assert.equal(button.disabled,false);button.click();
 assert.equal(run('E.agenda.length'),1);assert.equal(run('E.agenda[0].hora'),'12:00');
 const second=await run('consultarConvitesGmail()');assert.equal(second.plano[0].acao,'existente');assert.equal(run('E.agenda.length'),1);
});

test('Gmail manual: data incompleta exige preenchimento e seleção',async()=>{
 const {run,ctx,document}=setup();const body=Buffer.from('Vencimento: 10/09').toString('base64url');
 ctx.gmailMock=async path=>path.startsWith('messages?')?{messages:[{id:'m2'}]}:{id:'m2',internalDate:'100',payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Boleto teste'}],body:{data:body}}};run('gmailApi=gmailMock');ctx.result=await run('consultarConvitesGmail()');assert.equal(ctx.result.plano.length,1);run('revisarConvitesGmail(result)');
 const box=document.querySelector('.google-evento input[type=checkbox]'),date=document.querySelector('.google-evento input[type=date]');assert.equal(box.disabled,true);assert.equal(run('E.agenda.length'),0);
 date.value='2099-09-10';date.dispatchEvent(new document.defaultView.Event('change'));assert.equal(box.disabled,false);box.checked=true;box.dispatchEvent(new document.defaultView.Event('change'));
 [...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Importar 1')).click();assert.equal(run('E.agenda[0].data'),'2099-09-10');
});
test('Google manual: reenvio atualiza o mesmo evento sem convidados',async()=>{
 const {run,ctx}=setup();let ids=[],posts=0,patches=0;ctx.googleMock=async(path,method='GET',body)=>{
 if(path==='calendars')return {id:'cal-test'};
 if(method==='POST'){ids.push(body.id);posts++;assert.equal(body.attendees,undefined);assert.equal(body.reminders.overrides.length,2);return posts===1?{htmlLink:'https://calendar.google.com/test'}:{conflict:true}}
 if(method==='GET')return {extendedProperties:{private:{leoSource:ids[0]}}};if(method==='PATCH'){patches++;assert.equal(body.id,undefined);return {htmlLink:'https://calendar.google.com/test'}};throw Error(path)
 };run("googleAgendaGravar=googleMock;E.agenda=[{id:'local',gid:'mail:1',gmailId:'1',data:'2099-09-10',ate:'2099-09-10',titulo:'Vencimento teste'}]");await run('enviarLembreteGoogle(E.agenda[0])');await run('enviarLembreteGoogle(E.agenda[0])');assert.equal(ids[0],ids[1]);assert.equal(patches,1);assert.equal(run('E.googleAgendaDestino'),'cal-test');
});

test('Gmail: fila de aprovação preserva pendentes sem criar compromissos',async()=>{
 const {run,document}=setup();run("var loteTeste={plano:[{gid:'teste-pendente',seq:0,emailEm:1,reg:{gid:'teste-pendente',gmailId:'m',gmailRevisar:true,data:'2099-09-10',ate:'2099-09-10',titulo:'Data para aprovar'}}],avisos:[],mensagens:1};guardarAprovacoesGmail(loteTeste);guardarAprovacoesGmail(loteTeste)");
 assert.equal(run('E.gmailPendentes.length'),1);assert.equal(run('E.agenda.length'),0);run('revisarConvitesGmail({plano:E.gmailPendentes,avisos:[],mensagens:0})');
 const box=document.querySelector('.google-evento input[type=checkbox]');assert.ok(!box.checked);box.checked=true;box.dispatchEvent(new document.defaultView.Event('change'));[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Importar 1')).click();assert.equal(run('E.agenda.length'),1);assert.equal(run('E.gmailPendentes.length'),0);
});
test('Gmail: busca pagina e examina texto de e-mail com convite',async()=>{
 const {run,ctx}=setup();const paths=[];ctx.gmailMock=async p=>{paths.push(p);return p.startsWith('messages?')?{messages:[{id:'antigo'}],nextPageToken:'pagina2'}:{id:'antigo',internalDate:'1',payload:{parts:[{mimeType:'text/plain',body:{data:Buffer.from('Entrega especial 10/09/2099').toString('base64url')}},{mimeType:'text/calendar',body:{}}]}}};run('gmailApi=gmailMock');const r=await run("consultarConvitesGmail('pagina1')");assert.equal(r.proximaPagina,'pagina2');assert.equal(r.plano.length,1);assert.match(paths[0],/pageToken=pagina1/);assert.doesNotMatch(decodeURIComponent(paths[0]),/after:|before:|newer_than:/);assert.equal(run('E.agenda.length'),0);
});
test('Gmail: descartar não reaparece ao repetir o mesmo lote',()=>{
 const {run,document}=setup();run("var lote={plano:[{gid:'dispensar',seq:0,emailEm:1,reg:{gid:'dispensar',data:'2099-10-01',titulo:'Teste'}}],avisos:[],mensagens:1};revisarConvitesGmail(guardarAprovacoesGmail(lote))");[...document.querySelectorAll('button')].find(b=>b.textContent==='Descartar').click();run('guardarAprovacoesGmail(lote)');assert.equal(run('E.gmailPendentes.length'),0);assert.equal(run('E.agenda.length'),0);
});
