import ICAL from 'ical.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const html=readFileSync(new URL('../publico/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).replace(/if\(temSessao\(\)\)\{menu\(\);tela\(\);puxarNuvem[\s\S]*$/,'');
function app(date='2026-09-05T12:00:00-03:00'){
 const NativeDate=Date; class Clock extends NativeDate {constructor(...args){super(...(args.length?args:[date]))} static now(){return new NativeDate(date).getTime()}}
 const data=new Map();const ctx=vm.createContext({ICAL,atob,btoa,Date:Clock,structuredClone,console,setTimeout,clearTimeout,URL,Blob,TextEncoder,TextDecoder,location:{hostname:'localhost',hash:''},document:{addEventListener(){},getElementById(){return null}},window:{addEventListener(){}},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},sessionStorage:{getItem:()=>null}});
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

test('Google: converte UTC para horário de Brasília',()=>{const run=app();assert.equal(run("normalizarEventoGoogle({id:'e1',start:{dateTime:'2026-09-06T01:00:00Z'}},'cal').data"),'2026-09-05');assert.equal(run("normalizarEventoGoogle({id:'e1',start:{dateTime:'2026-09-06T01:00:00Z'}},'cal').hora"),'22:00')});
test('Google: fim exclusivo de evento de vários dias é convertido',()=>assert.equal(app()("normalizarEventoGoogle({id:'e1',start:{date:'2026-09-05'},end:{date:'2026-09-08'}},'cal').ate"),'2026-09-07'));
test('Google: ignora eventos cancelados',()=>assert.equal(app()("normalizarEventoGoogle({id:'e1',status:'cancelled',start:{date:'2026-09-05'}},'cal')"),null));
test('Google: reimportação encontra a cópia existente sem duplicar',()=>assert.equal(app()("prepararAgendaGoogle([{id:'e1',start:{date:'2026-09-05'}}],'cal','America/Sao_Paulo',[{id:'local',googleId:'cal:e1'}])[0].acao"),'atualizar'));
test('Google: eventos recorrentes distintos mantêm identidade própria',()=>assert.equal(app()("prepararAgendaGoogle([{id:'e1_20260905',iCalUID:'serie',start:{date:'2026-09-05'}},{id:'e1_20260906',iCalUID:'serie',start:{date:'2026-09-06'}}],'cal','America/Sao_Paulo',[]).length"),2));
test('Google: não duplica item repetido na consulta',()=>assert.equal(app()("prepararAgendaGoogle([{id:'e1',start:{date:'2026-09-05'}},{id:'e1',start:{date:'2026-09-05'}}],'cal','America/Sao_Paulo',[]).length"),1));
test('Google: sessão vencida exige renovar',()=>assert.equal(app()("googleSessao.gmail={token:'ficticio',vence:Date.now()-1};googleConectado('gmail')"),false));
test('Viagens: hotel no cadastro atual evita falso alerta',()=>assert.equal(app()("temHotelViagem({hoteis:[{nome:'Hotel fictício'}]})"),true));

test('radar: hotel atual não gera aviso de hotel indefinido',()=>{const run=app();assert.equal(run("E.viagens=[{evento:'Teste',ida:'2026-09-10',hoteis:[{nome:'Reservado'}]}];radar().some(x=>x.ic==='🏨')"),false)});
test('radar: pendência sem data não é chamada de atrasada',()=>assert.equal(app()("rotuloRadar({g:0,quando:null})"),'Revisar'));
test('radar: compromisso de hoje tem rótulo Hoje',()=>assert.equal(app()("rotuloRadar({g:2,quando:0})"),'Hoje'));
test('radar: demanda mantém referência ao cadastro original',()=>assert.equal(app()("E.demandas=[{id:'d',prazo:'2026-09-01'}];radar().find(x=>x.col==='demandas').ref===E.demandas[0]"),true));
test('demandas: prazo, prioridade no empate e concluídas ao final',()=>assert.equal(app()("ordenarDemandas([{id:'fim',status:'Concluída',prazo:'2020-01-01'},{id:'baixa',prazo:'2026-09-05',prioridade:'Baixa'},{id:'sem',prioridade:'Alta'},{id:'alta',prazo:'2026-09-05',prioridade:'Alta'},{id:'antes',prazo:'2026-09-01'}]).map(x=>x.id).join(',')"),'antes,alta,baixa,sem,fim'));
test('busca: encontra exame pelo nome e tratamento pelo motivo atuais',()=>{const run=app();assert.equal(run("E.exames=[{exame:'Hemograma revisão',medico:'Exemplo'}];buscarEmTudo('hemograma revisão')[0].tit"),'Hemograma revisão');assert.equal(run("E.tratamentos=[{oque:'Fisioterapia',motivo:'Mobilidade teste'}];buscarEmTudo('mobilidade teste')[0].tit"),'Fisioterapia')});
test('busca: resultado abre o registro exato sem criar outro',()=>assert.equal(app()("var destinoTeste;irTela=()=>{};modalDemanda=(d,novo)=>destinoTeste=[d.id,novo];abrirRegistro('demandas','demandas',{id:'exato'});JSON.stringify(destinoTeste)"),'["exato",false]'));
test('busca: hotel encontrado aponta para o cadastro da viagem',()=>assert.equal(app()("E.viagens=[{id:'v1',hoteis:[{nome:'Hotel teste único'}]}];var resultadoTeste=buscarEmTudo('hotel teste único')[0];resultadoTeste.f.col+':'+resultadoTeste.x.id"),'viagens:v1'));

test('viagem pronta reconhece hotel no cadastro atual',()=>assert.equal(app()("docsViagem=()=>({ok:true});viagemOk({status:'Confirmado',transporte:'Avião',hoteis:[{nome:'Reservado'}]})"),true));


test('agenda: período iniciado no mês anterior aparece no mês selecionado',()=>assert.equal(app()("eventoNoMes({data:'2026-08-30',ate:'2026-09-03'},'2026-09')"),true));
test('agenda: período fora do mês não aparece',()=>assert.equal(app()("eventoNoMes({data:'2026-08-20',ate:'2026-08-30'},'2026-09')"),false));
test('agenda: último dia de fevereiro bissexto é incluído',()=>assert.equal(app()("eventoNoMes({data:'2024-02-29'},'2024-02')"),true));
test('agenda: viagem passada não é pendência vencida',()=>assert.equal(app()("eventoPendenteVencido({data:'2026-08-20',fonte:'viagens'})"),false));
test('agenda: demanda passada continua como pendência vencida',()=>assert.equal(app()("eventoPendenteVencido({data:'2026-08-20',fonte:'demandas'})"),true));
test('agenda: viagem cancelada não entra no calendário',()=>assert.equal(app()("E.viagens=[{ida:'2026-09-05',status:'Cancelado'}];eventosDoEcossistema().filter(e=>e.fonte==='viagens').length"),0));
test('agenda: próximos incluem andamento e ordenam horas sem alterar origem',()=>{const run=app();assert.equal(run("var agendaTeste=[{id:'tarde',data:'2026-09-05',hora:'18:00'},{id:'manha',data:'2026-09-05',hora:'09:00'},{id:'andamento',data:'2026-09-03',ate:'2026-09-06'},{id:'passado',data:'2026-09-01'}];proximosCompromissos(agendaTeste).map(x=>x.id).join(',')"),'andamento,manha,tarde');assert.equal(run("agendaTeste[0].id"),'tarde')});
test('busca: compromisso abre registro correto',()=>assert.equal(app()("var compromissoTeste;irTela=()=>{};modalCompromisso=a=>compromissoTeste=a.id;abrirRegistro('agenda','agenda',{id:'agenda-exata'});compromissoTeste"),'agenda-exata'));


function telaAssincronaTeste(){const run=app();run("var paginaTeste={isConnected:true,querySelectorAll:()=>[]},concluirTelaTeste;document.createElement=()=>({innerHTML:'',firstElementChild:paginaTeste});document.getElementById=()=>({replaceChildren(){}});indiceDaTela=()=>{};var saltosTeste=[];rolaAlvo=(p,id)=>saltosTeste.push(id);MODS.push({id:'teste-assincrono',nome:'Teste',render:()=>new Promise(r=>concluirTelaTeste=r)});atual='teste-assincrono';_alvoBloco='assunto-teste';tela()");return run}
test('navegação: atalho espera conteúdo assíncrono',async()=>{const run=telaAssincronaTeste();assert.equal(run('saltosTeste.length'),0);await run('concluirTelaTeste();Promise.resolve()');assert.equal(run("saltosTeste.join(',')"),'assunto-teste')});
test('navegação: tela antiga não interfere após a troca',async()=>{const run=telaAssincronaTeste();await run('paginaTeste.isConnected=false;concluirTelaTeste();Promise.resolve()');assert.equal(run('saltosTeste.length'),0)});
test('navegação: destino solicitado é consumido pela própria tela',()=>{const run=telaAssincronaTeste();assert.equal(run('_alvoBloco'),null)});


test('financeiro: atalho de lançamento seleciona sua visão',()=>assert.equal(app()("abaDoBlocoFinanceiro('gt-lista','gastos')"),'lancamentos'));
test('financeiro: seguros ficam na visão Recorrentes',()=>assert.equal(app()("abaDoBlocoFinanceiro('gt-seg','gastos')"),'recorrentes'));
test('rendimentos: empresa selecionada define total e comparação',()=>{const run=app();assert.equal(run("JSON.stringify(resumoRendimentoFiltrado({anos:[2025,2026],totalAno:[1000,3000],empresas:{Teste:[100,150]}},'Teste',2026))"),'{'+'"total":150,"anterior":100,"crescimento":50'+'}')});
test('rendimentos: todos os anos respeita a empresa selecionada',()=>assert.equal(app()("resumoRendimentoFiltrado({anos:[2025,2026],totalAno:[1000,3000],empresas:{Teste:[100,150]}},'Teste',2026,true).total"),250));
test('rendimentos: sem base anterior não inventa crescimento',()=>assert.equal(app()("resumoRendimentoFiltrado({anos:[2026],totalAno:[150],empresas:{}},'Todas',2026).crescimento"),null));
test('rendimentos: empresa sem dados não mostra total de outras empresas',()=>assert.equal(app()("resumoRendimentoFiltrado({anos:[2026],totalAno:[150],empresas:{}},'Ausente',2026).total"),0));

test('saúde: cadastro vazio recente não apaga última pressão completa',()=>assert.equal(app()("ultimoRegistroSaude([{data:'2026-09-01',sis:120,dia:80},{data:'2026-09-05',sis:'',dia:''}],['sis','dia']).data"),'2026-09-01'));
test('saúde: batimento e pressão podem ter datas diferentes',()=>assert.equal(app()("ultimoRegistroSaude([{data:'2026-09-01',sis:120,dia:80},{data:'2026-09-05',fc:70}],['fc']).fc"),70));
test('saúde: medida futura não vira última medida realizada',()=>assert.equal(app()("ultimoRegistroSaude([{data:'2026-09-10',peso:80}],['peso'])"),null));
test('saúde: falta de exame é Sem registro, não Nunca feito',()=>assert.equal(app()("E.perfil={nascimento:'1986-01-01'};E.exames=[];E.vitais=[];rastreiosPendentes(true).every(x=>x.situacao==='Sem registro')"),true));
test('saúde: atalhos levam à área que contém o cadastro',()=>assert.equal(app()("['sa-ex','sa-peso','sa-trat','sa-dash'].map(abaDoBlocoSaude).join(',')"),'exames,medidas,cuidados,resumo'));

test('conferência: identifica duplicação e data invertida sem modificar dados',()=>{const run=app();assert.equal(run("var dadosConf={viagens:[{id:'v',ida:'2026-09-10',volta:'2026-09-01'},{id:'v'}]};var antesConf=JSON.stringify(dadosConf);conferirCadastros(dadosConf).length"),2);assert.equal(run('JSON.stringify(dadosConf)===antesConf'),true)});
test('conferência: rejeita dia inexistente e valor não numérico',()=>assert.equal(app()("conferirCadastros({gastos:[{data:'2026-02-30',valor:'abc'}]}).length"),2));
test('conferência: campos vazios e valores negativos válidos não são erros',()=>assert.equal(app()("conferirCadastros({gastos:[{data:'',valor:-10}]}).length"),0));
test('busca: encontra vacina, empreendimento e reserva',()=>{const run=app();assert.equal(run("E.vacinas=[{vacina:'Vacina teste único'}];E.empreend=[{nome:'Projeto busca único'}];E.reservas=[{nome:'Reserva busca única'}];['vacina teste único','projeto busca único','reserva busca única'].map(q=>buscarEmTudo(q)[0].f.col).join(',')"),'vacinas,empreend,reservas')});

test('exportação: evento de vários dias preserva todo o período',async()=>{const run=app();const ics=await run("E.agenda=[{id:'1',data:'2026-09-05',ate:'2026-09-07',titulo:'Evento'}];var arquivo;baixar=b=>arquivo=b;exportarIcs();arquivo.text()");assert.match(ics,/DTEND;VALUE=DATE:20260908/)});

function convite(trecho){return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:convite-teste\r\n'+trecho+'\r\nEND:VEVENT\r\nEND:VCALENDAR'}
function lerConviteTeste(ics){return app()(`lerConvitesAgenda(${JSON.stringify(ics)},{id:'email1',internalDate:'100'})`)}
test('Gmail Agenda: convite UTC vira horário de Brasília',()=>{const r=lerConviteTeste(convite('DTSTART:20260906T010000Z\r\nDTEND:20260906T020000Z\r\nSUMMARY:Reunião'));assert.equal(r.eventos[0].reg.data,'2026-09-05');assert.equal(r.eventos[0].reg.hora,'22:00')});
test('Gmail Agenda: convite de vários dias preserva último dia',()=>{const r=lerConviteTeste(convite('DTSTART;VALUE=DATE:20260906\r\nDTEND;VALUE=DATE:20260909\r\nSUMMARY:Viagem'));assert.equal(r.eventos[0].reg.ate,'2026-09-08')});
test('Gmail Agenda: título acentuado e vírgula escapada',()=>assert.equal(lerConviteTeste(convite('DTSTART:20260906T150000Z\r\nSUMMARY:Reunião\\, equipe')).eventos[0].reg.titulo,'Reunião, equipe'));
test('Gmail Agenda: série recorrente pede Google Agenda',()=>{const r=lerConviteTeste(convite('DTSTART:20260906T150000Z\r\nRRULE:FREQ=WEEKLY'));assert.equal(r.eventos.length,0);assert.equal(r.avisos.length,1)});
test('Gmail Agenda: fuso desconhecido não gera hora inventada',()=>{const r=lerConviteTeste(convite('DTSTART;TZID=Unknown/Test:20260906T150000'));assert.equal(r.eventos.length,0);assert.equal(r.avisos.length,1)});
test('Gmail Agenda: cancelamento sem data é reconhecido',()=>{const r=lerConviteTeste(convite('STATUS:CANCELLED'));assert.equal(r.eventos[0].cancelado,true)});
test('Gmail Agenda: cancelamento mais novo suprime convite anterior',()=>assert.equal(app()("planejarConvitesAgenda([{gid:'u',seq:0,emailEm:1,reg:{data:'2026-09-10'}},{gid:'u',seq:1,emailEm:2,cancelado:true}],[])[0].acao"),'cancelado'));
test('Gmail Agenda: versão antiga recebida depois não substitui remarcação',()=>assert.equal(app()("planejarConvitesAgenda([{gid:'u',seq:2,emailEm:1,reg:{data:'2026-09-11'}},{gid:'u',seq:1,emailEm:2,reg:{data:'2026-09-10'}}],[])[0].reg.data"),'2026-09-11'));
test('Gmail Agenda: reconsulta não duplica registro importado',()=>assert.equal(app()("planejarConvitesAgenda([{gid:'u',seq:1,emailEm:100,reg:{data:'2026-09-10'}}],[{gid:'u',gmailSequencia:1,gmailRecebidoEm:100}])[0].acao"),'existente'));
test('Gmail Agenda: evento do Google Agenda não é importado novamente',()=>assert.equal(app()("planejarConvitesAgenda([{gid:'u',seq:1,emailEm:100,reg:{data:'2026-09-10'}}],[{gid:'u',googleId:'cal:evento'}])[0].acao"),'google'));
