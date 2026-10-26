import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
import {consultarSincronizacaoAgenda,reconciliarAgendaGoogle} from '../supabase/functions/leo-sync/agenda-core.mjs';
const scripts=['documentos-agenda.js','documentos-habitualidade.js','documentos-armas.js'].map(n=>readFileSync(new URL('../publico/'+n,import.meta.url),'utf8'));
function app(){const a=setup();scripts.forEach(s=>a.run(s));a.run(`E.documentos=[{id:'documento-teste',grupo:'armas',tipoRegistro:'arma',nome:'Modelo fictício',dono:'Pessoa fictícia',habitualidade:{metaAnual:4,clubeId:'',visitas:[{id:'visita-teste',data:'2027-02-06',hora:'09:00',local:'Local original',status:'planejada',obs:'Anotação pessoal',googleCalendarId:'calendario-teste',googleEventId:'evento-teste',googleHtmlLink:'https://calendar.google.com/calendar/event?eid=teste'}]}}];E.agenda=[{id:'agenda-teste',googleCalendar:'calendario-teste',googleId:'calendario-teste:evento-teste',data:'2027-02-13',hora:'10:00',local:'Local confirmado',titulo:'Clube fictício',obs:'Nota da agenda'}];E.agendaGoogleHistorico=[]`);return a}
const json=(a,s)=>JSON.parse(a.run('JSON.stringify('+s+')'));
test('uma ocorrência Google e dois avisos na Central, sem modificar estado ou diário',()=>{
 const a=app();a.run(`const antes=JSON.stringify(E);const eventos=eventosDoEcossistema();const clube=eventos.filter(e=>e.ref?.id==='agenda-teste'||e.tipo==='habitualidade')`);
 assert.equal(a.run('clube.length'),3);assert.equal(a.run('clube.filter(e=>!e.avisoDocumento).length'),1);assert.equal(a.run('clube.find(e=>!e.avisoDocumento).ref===E.agenda[0]'),true);
 assert.deepEqual(json(a,'clube.filter(e=>e.avisoDocumento).map(e=>e.data)'),['2027-02-06','2027-02-12']);assert.equal(a.run('JSON.stringify(E)===antes'),true);assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2027).realizadas`),0);
});
test('ID e calendário exatos: nomes iguais ou evento igual em outro calendário ficam independentes',()=>{
 const a=app();a.run(`E.agenda.push({...E.agenda[0],id:'outro-cal',googleCalendar:'outro-calendario',googleId:'outro-calendario:evento-teste'},{...E.agenda[0],id:'outro-evento',googleId:'calendario-teste:outro-evento'});const clube=eventosDoEcossistema().filter(e=>e.fonte==='compromissos'||e.tipo==='habitualidade')`);
 assert.equal(a.run('clube.filter(e=>!e.avisoDocumento).length'),3);assert.equal(a.run('clube.filter(e=>e.avisoDocumento).length'),2);
 a.run('E.agenda.shift()');assert.equal(a.run(`DocumentosHabitualidade.eventos(E.documentos,'2026-10-26').length`),0);assert.equal(a.run(`DocumentosHabitualidade.resolverGoogle(E.documentos[0].habitualidade.visitas[0]).situacao`),'aguardando');
});
test('cancelamento, recusa e remoção confirmados não revivem o plano local nem apagam presença ou notas',()=>{
 for(const motivo of ['Cancelado no Google','Recusado no Google','Removido nesta Central']){
  const a=app();a.run(`E.agendaGoogleHistorico=[{motivo:${JSON.stringify(motivo)},registro:structuredClone(E.agenda[0])}];E.agenda=[];const antes=JSON.stringify(E);const eventos=eventosDoEcossistema()`);
  assert.equal(a.run(`eventos.filter(e=>e.tipo==='habitualidade'||e.fonte==='compromissos').length`),0);assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2027).planejadas`),0);assert.equal(a.run('JSON.stringify(E)===antes'),true);
  a.run(`DocumentosArmas.editar('documento-teste')`);const select=a.document.querySelector('[aria-label="Ano das visitas"]');for(const o of select.options)o.selected=false;[...select.options].find(o=>o.value==='2027').selected=true;select.onchange();
  assert.match(a.document.querySelector('.dh-visitas').textContent,motivo==='Removido nesta Central'?/retirado da Central/:/cancelado no Google/);assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].obs'),'Anotação pessoal');assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].status'),'planejada');
 }
});
test('falha ou ausência do espelho não se apresenta como cancelamento nem recria visita antiga',()=>{
 const a=app();a.run('E.agenda=[]');assert.equal(a.run(`DocumentosHabitualidade.eventos(E.documentos,'2026-10-26').length`),0);assert.equal(a.run(`DocumentosHabitualidade.resolverGoogle(E.documentos[0].habitualidade.visitas[0]).situacao`),'aguardando');assert.equal(a.run('E.documentos[0].habitualidade.visitas.length'),1);
});
test('remarcação no Google muda resumo, ano e avisos; diário e observações permanecem',()=>{
 const a=app();a.run(`E.agenda[0].data='2029-03-10';const antes=JSON.stringify(E.documentos);const visitas=DocumentosHabitualidade.eventos(E.documentos,'2026-10-26')`);
 assert.equal(a.run('visitas[0].data'),'2029-03-10');assert.equal(a.run('visitas[0].hora'),'10:00');assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2027).planejadas`),0);assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2029).planejadas`),1);
 assert.deepEqual(json(a,'DocumentosAgenda.eventosVisitas(visitas).filter(e=>e.avisoDocumento).map(e=>e.data)'),['2029-03-03','2029-03-09']);assert.equal(a.run('JSON.stringify(E.documentos)===antes'),true);
 a.run(`DocumentosArmas.editar('documento-teste')`);assert.ok([...a.document.querySelector('[aria-label="Ano das visitas"]').options].some(o=>o.value==='2029'));
});
test('edição vinculada oferece link Google, protege agendamento e salva apenas o acompanhamento',()=>{
 const a=app();a.run(`DocumentosArmas.editar('documento-teste')`);const select=a.document.querySelector('[aria-label="Ano das visitas"]');for(const o of select.options)o.selected=false;[...select.options].find(o=>o.value==='2027').selected=true;select.onchange();const rows=a.document.querySelector('.dh-visitas');
 assert.equal(rows.querySelector('a').getAttribute('href'),'https://calendar.google.com/calendar/event?eid=teste');assert.match(rows.textContent,/13\/02\/2027.*10:00/);
 rows.querySelector('button').click();const f=a.document.querySelector('.dh-form-host form');assert.equal(f.querySelector('[name=data]'),null);assert.equal(f.querySelector('[name=hora]'),null);assert.equal(f.querySelector('[name=local]'),null);assert.match(a.document.querySelector('.dh-form-host').textContent,/Cancelar aqui não cancela o evento no Google/);
 f.querySelector('[name=obs]').value='Observação revisada';f.onsubmit({preventDefault(){}});assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].obs'),'Observação revisada');assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].data'),'2027-02-06');assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].googleEventId'),'evento-teste');assert.equal(a.run('E.agenda[0].obs'),'Nota da agenda');
 a.run(`const base=structuredClone(E.documentos[0].habitualidade.visitas[0])`);assert.throws(()=>a.run(`DocumentosHabitualidade.salvarVisita('documento-teste',base,{...base,data:'2027-03-01'})`),/no Google Agenda/);
});
test('presença depende de confirmação e da data efetiva; mudar Google depois não desloca presença registrada',()=>{
 const a=app();a.run(`E.agenda[0].data='2020-02-08';const base=structuredClone(E.documentos[0].habitualidade.visitas[0]);DocumentosHabitualidade.salvarVisita('documento-teste',base,{...base,status:'realizada'})`);
 assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].data'),'2020-02-08');assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].historico[0].antes.data'),'2027-02-06');assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2020).realizadas`),1);
 a.run(`E.agenda[0].data='2099-02-14'`);assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2020).realizadas`),1);assert.equal(a.run(`DocumentosHabitualidade.resumo(E.documentos[0],2099).realizadas`),0);
 const b=app();b.run(`E.documentos[0].habitualidade.visitas[0].data='2020-02-08';E.agenda[0].data='2099-02-14';const base=structuredClone(E.documentos[0].habitualidade.visitas[0])`);assert.throws(()=>b.run(`DocumentosHabitualidade.salvarVisita('documento-teste',base,{...base,status:'realizada'})`),/futura/);
});
test('backup rejeita vínculo incompleto, tipos inválidos, links inseguros e dois vínculos ao mesmo evento',()=>{
 for(const patch of [{googleCalendarId:''},{googleEventId:2},{googleHtmlLink:'javascript:alert(1)'},{googleCalendarId:' calendario-teste'}]){const a=app();a.run('Object.assign(E.documentos[0].habitualidade.visitas[0],'+JSON.stringify(patch)+')');assert.throws(()=>a.run('validarBackup(E)'),/habitualidade/)}
 const a=app();assert.doesNotThrow(()=>a.run('validarBackup(E)'));a.run(`E.documentos[0].habitualidade.visitas.push({...E.documentos[0].habitualidade.visitas[0],id:'outra',data:'2027-03-06'})`);assert.throws(()=>a.run('validarBackup(E)'),/já vinculado/);
});
test('troca concorrente do vínculo não é sobrescrita pelo formulário antigo',()=>{
 const a=app();a.run(`const base=structuredClone(E.documentos[0].habitualidade.visitas[0]);E.documentos[0].habitualidade.visitas[0].googleEventId='outro-evento'`);assert.throws(()=>a.run(`DocumentosHabitualidade.salvarVisita('documento-teste',base,{...base,obs:'Alteração'})`),/vínculo Google mudou/);assert.equal(a.run('E.documentos[0].habitualidade.visitas[0].googleEventId'),'outro-evento');
});
test('cinco importados são preservados, inclusive quinto fora de12meses consultado pelo ID',async()=>{
 const datas=['2026-11-07','2027-02-06','2027-05-01','2027-08-07','2027-11-06'];const eventos=datas.map((data,i)=>({id:'visita'+i,summary:'Visita de exemplo',start:{dateTime:data+'T09:00:00-03:00'},end:{dateTime:data+'T10:00:00-03:00'},reminders:{useDefault:false,overrides:[{method:'popup',minutes:10080},{method:'popup',minutes:1440}]}}));
 let n=0;const inicial=reconciliarAgendaGoogle([],[],[{id:'calendario-teste',adicionar:true,eventos}],'agora',()=> 'local'+n++);const chamadas=[];
 const consulta=await consultarSincronizacaoAgenda(inicial.agenda,async(_,path)=>{chamadas.push(path);if(path.startsWith('calendars/primary?'))return{id:'calendario-teste'};if(path.endsWith('/events/visita4'))return eventos[4];return{items:eventos.slice(0,4)}},new Date('2026-10-26T12:00:00Z'));
 assert.ok(chamadas.some(p=>p.endsWith('/events/visita4')));const segunda=reconciliarAgendaGoogle(inicial.agenda,inicial.historico,consulta.lotes,'depois',()=> 'não-criar');assert.equal(segunda.agenda.length,5);assert.equal(segunda.mudou,false);assert.equal(segunda.historico.length,0);assert.equal(segunda.agenda[4].googleLembretes.overrides[0].minutes,10080);
});
