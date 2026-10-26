import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
const js=readFileSync(new URL('../publico/documentos-agenda.js',import.meta.url),'utf8');
const armas=readFileSync(new URL('../publico/documentos-armas.js',import.meta.url),'utf8');
function app(){const a=setup();a.run(js);a.run(armas);a.run(`E.documentos=[{id:'d-exemplo',grupo:'armas',tipoRegistro:'cr',nome:'Documento fictício',dono:'Titular fictício',validade:'2027-01-15',fontes:[{nome:'Fonte preservada'}],agendaGoogle:{validade:{googleCalendarId:'cal-teste',googleEventId:'ev-teste',googleHtmlLink:'https://calendar.google.com/calendar/event?eid=ficticio',dataReferencia:'2027-01-15'}}}];E.agenda=[{id:'g-exemplo',googleCalendar:'cal-teste',googleId:'cal-teste:ev-teste',data:'2027-01-15',hora:'09:00',titulo:'Lembrete fictício no Google',obs:'Nota local preservada',googleLembretes:{useDefault:false,overrides:[{method:'popup',minutes:40320},{method:'popup',minutes:10080},{method:'popup',minutes:1440}]}}];E.agendaGoogleHistorico=[]`);return a}
const json=(a,s)=>JSON.parse(a.run('JSON.stringify('+s+')'));
test('vencimento tem uma ocorrência documental e avisos60/30/7; espelho Google permanece integral',()=>{
 const a=app();a.run(`const antes=JSON.stringify(E);const ev=eventosDoEcossistema().filter(e=>e.ref?.id==='d-exemplo'||e.ref?.id==='g-exemplo')`);
 assert.equal(a.run('ev.length'),4);assert.equal(a.run('ev.filter(e=>!e.avisoDocumento).length'),1);assert.equal(a.run('ev.find(e=>!e.avisoDocumento).ref===E.documentos[0]'),true);assert.deepEqual(json(a,'ev.filter(e=>e.avisoDocumento).map(e=>e.diasAntes)'),[60,30,7]);assert.equal(a.run('JSON.stringify(E)===antes'),true);assert.equal(a.run('E.agenda[0].googleLembretes.overrides[0].minutes'),40320);
});
test('filtro só Compromissos mostra o espelho; visualização conjunta continua sem duplicar',()=>{
 const a=app();assert.equal(a.run(`eventosDoEcossistema({preservarCopiasGoogle:true}).filter(e=>e.fonte==='compromissos').length`),1);assert.equal(a.run(`eventosDoEcossistema().filter(e=>e.fonte==='compromissos').length`),0);
 a.run(`filtro.agMes='2027-01';filtro.agSo='compromissos';atual='agenda';tela()`);assert.match(a.document.getElementById('main').textContent,/Lembrete fictício no Google/);
});
test('mesmo título ou mesmo evento em outro calendário não são suprimidos',()=>{
 const a=app();a.run(`E.agenda.push({...E.agenda[0],id:'outro-id',googleId:'cal-teste:outro-evento'},{...E.agenda[0],id:'outro-cal',googleCalendar:'cal-alternativo',googleId:'cal-alternativo:ev-teste'});const outros=eventosDoEcossistema().filter(e=>e.fonte==='compromissos')`);assert.deepEqual(json(a,'outros.map(e=>e.ref.id)'),['outro-id','outro-cal']);
});
test('editar validade da ficha mantém nova data, mostra divergência e não oculta o evento antigo',()=>{
 const a=app();a.run(`E.documentos[0].validade='2027-03-01';const antes=JSON.stringify(E);const ev=eventosDoEcossistema();const prazo=ev.find(e=>e.tipoDocumentoAgenda==='validade'&&!e.avisoDocumento)`);
 assert.equal(a.run('prazo.data'),'2027-03-01');assert.equal(a.run('prazo.googleAgenda.situacao'),'alterado');assert.match(a.run('prazo.sub'),/Data da ficha mudou/);assert.equal(a.run(`ev.filter(e=>e.fonte==='compromissos').length`),1);assert.equal(a.run('JSON.stringify(E)===antes'),true);
});
test('alterar data no Google não altera o documento nem seus avisos',()=>{
 const a=app();a.run(`E.agenda[0].data='2027-02-20';const ev=eventosDoEcossistema();const prazo=ev.find(e=>e.tipoDocumentoAgenda==='validade'&&!e.avisoDocumento)`);
 assert.equal(a.run('prazo.data'),'2027-01-15');assert.equal(a.run('prazo.googleAgenda.situacao'),'divergente');assert.match(a.run('prazo.sub'),/20\/02\/2027/);assert.equal(a.run('E.documentos[0].validade'),'2027-01-15');assert.equal(a.run(`ev.filter(e=>e.fonte==='compromissos').length`),1);
});
test('ausência e cancelamento do Google nunca retiram validade nem avisos documentais',()=>{
 for(const cancelado of [false,true]){const a=app();if(cancelado)a.run(`E.agendaGoogleHistorico=[{registro:structuredClone(E.agenda[0]),motivo:'Cancelado no Google'}]`);a.run('E.agenda=[]');const r=json(a,`DocumentosAgenda.resolverGoogle(E.documentos[0],'validade','2027-01-15',E.agenda,E.agendaGoogleHistorico)`);assert.equal(r.situacao,cancelado?'cancelado':'aguardando');assert.match(r.texto,/prazo da ficha mantido/);assert.equal(a.run(`eventosDoEcossistema().filter(e=>e.ref?.id==='d-exemplo').length`),4);}
});
function clube(){const a=app();a.run(`E.documentos=[{id:'clube-exemplo',grupo:'armas',tipoRegistro:'clube',nome:'Clube fictício',renovacaoDia:30,renovacaoMes:9,agendaGoogle:{renovacao:{googleCalendarId:'cal-teste',googleEventId:'serie-teste',googleHtmlLink:'https://calendar.google.com/calendar/event?eid=serie',diaMesReferencia:'09-30'}}}];E.agenda=[{id:'inst-2027',googleCalendar:'cal-teste',googleId:'cal-teste:instancia-a',googleRecorrencia:'serie-teste',data:'2027-09-30',hora:'09:00',titulo:'Renovação fictícia'},{id:'inst-2028',googleCalendar:'cal-teste',googleId:'cal-teste:instancia-b',googleRecorrencia:'serie-teste',data:'2028-09-30',hora:'09:00',titulo:'Renovação fictícia'}]`);return a}
test('renovação usa série e calendário exatos, com uma ocorrência por ano após rollover',()=>{
 const a=clube();for(const [hoje,esperado] of [['2027-01-01','instancia-a'],['2027-10-01','instancia-b']]){assert.deepEqual(json(a,`[...DocumentosAgenda.copiasGoogle(E.documentos,'${hoje}',E.agenda)]`),['cal-teste:'+esperado]);assert.deepEqual(json(a,`DocumentosAgenda.eventos(E.documentos,'${hoje}',E.agenda).filter(e=>e.avisoDocumento).map(e=>e.diasAntes)`),[30,7,1]);}
 assert.equal(a.run('E.documentos[0].renovacaoDia'),30);assert.equal(a.run('E.agenda.length'),2);
});
test('instância só é reconhecida por googleRecorrencia, sem adivinhar ID ou comparar nomes',()=>{
 const a=clube();a.run(`E.agenda[0].googleCalendar='outro-cal';E.agenda[0].googleId='outro-cal:instancia-a';E.agenda.push({id:'parecida',googleCalendar:'cal-teste',googleId:'cal-teste:serie-teste_20270930T120000Z',data:'2027-09-30',titulo:'Renovação fictícia'})`);assert.deepEqual(json(a,`[...DocumentosAgenda.copiasGoogle(E.documentos,'2027-01-01',E.agenda)]`),[]);
});
test('renovação divergente, referência alterada e cancelamento não escondem data30/09 da ficha',()=>{
 const a=clube();a.run(`E.agenda[0].data='2027-10-02'`);assert.equal(a.run(`DocumentosAgenda.resolverGoogle(E.documentos[0],'renovacao','2027-09-30',E.agenda).situacao`),'divergente');assert.deepEqual(json(a,`[...DocumentosAgenda.copiasGoogle(E.documentos,'2027-01-01',E.agenda)]`),[]);
 a.run(`E.documentos[0].renovacaoDia=29`);assert.equal(a.run(`DocumentosAgenda.eventos(E.documentos,'2027-01-01',E.agenda).find(e=>!e.avisoDocumento).googleAgenda.situacao`),'alterado');a.run(`E.documentos[0].renovacaoDia=30;E.agenda[0].data='2027-09-30';E.agendaGoogleHistorico=[{registro:structuredClone(E.agenda[0]),motivo:'Cancelado no Google'}];E.agenda.shift()`);
 assert.equal(a.run(`DocumentosAgenda.resolverGoogle(E.documentos[0],'renovacao','2027-09-30',E.agenda,E.agendaGoogleHistorico).situacao`),'cancelado');assert.equal(a.run(`DocumentosAgenda.resolverGoogle(E.documentos[0],'renovacao','2028-09-30',E.agenda,E.agendaGoogleHistorico).situacao`),'alinhado');assert.equal(a.run(`DocumentosAgenda.eventos(E.documentos,'2027-01-01',E.agenda).filter(e=>!e.avisoDocumento)[0].data`),'2027-09-30');
});
test('painel destaca vínculo e link HTTPS sem executar nomes ou apagar o caminho para a ficha',()=>{
 const a=app();a.run(`E.documentos[0].nome='<img src=x onerror=alert(1)>';let aberto=null;document.body.appendChild(DocumentosAgenda.painel(E.documentos,'2026-10-26',e=>aberto=e,E.agenda,E.agendaGoogleHistorico))`);assert.equal(a.document.querySelectorAll('.documentos-agenda img').length,0);assert.match(a.document.querySelector('.documentos-agenda-prazo').textContent,/Google vinculado/);assert.equal(a.document.querySelector('.documentos-agenda a').getAttribute('href'),'https://calendar.google.com/calendar/event?eid=ficticio');a.document.querySelector('.documentos-agenda-prazo').click();assert.equal(a.run('aberto.ref===E.documentos[0]'),true);
});
test('backup valida vínculos sem exigir referências iguais à data editável nem alterar outras propriedades',()=>{
 const a=app();a.run(`const antes=JSON.stringify(E);validarBackup(E)`);assert.equal(a.run('JSON.stringify(E)===antes'),true);a.run(`E.documentos[0].validade='2030-01-01'`);assert.doesNotThrow(()=>a.run('validarBackup(E)'));
 for(const v of [null,[],{validade:{}},{validade:{googleCalendarId:'c',googleEventId:'e',dataReferencia:'2027-02-30'}},{renovacao:{googleCalendarId:'c',googleEventId:'e',diaMesReferencia:'02-30'}},{validade:{googleCalendarId:'c',googleEventId:'e',dataReferencia:'2027-01-01',googleHtmlLink:'javascript:alert(1)'}}]){a.run('E.documentos[0].agendaGoogle='+JSON.stringify(v));assert.throws(()=>a.run('validarBackup(E)'),/agendaGoogle/);}
});
function pessoais(){
 const a=app();a.run(`E.documentos=['CNH','Passaporte'].map((nome,i)=>({id:'pessoal-'+i,nome,dono:'Titular fictício '+i,numero:'PRIVADO-FICTICIO-'+i,validade:'2027-01-15',onde:'Arquivo original',fontes:[{nome:'Documento fictício'}],agendaGoogle:{validade:{googleCalendarId:'cal-teste',googleEventId:'pessoal-'+i,googleHtmlLink:'https://calendar.google.com/calendar/event?eid=pessoal'+i,dataReferencia:'2027-01-15'}}}));E.agenda=E.documentos.map((d,i)=>({id:'google-pessoal-'+i,googleCalendar:'cal-teste',googleId:'cal-teste:pessoal-'+i,googleLink:d.agendaGoogle.validade.googleHtmlLink,data:d.validade,hora:'09:00',titulo:'Vencimento de documento',googleLembretes:{useDefault:false,overrides:[{method:'popup',minutes:40320},{method:'popup',minutes:10080},{method:'popup',minutes:1440}]}}))`);return a;
}
test('CNH e passaporte genéricos recebem avisos e ocultam só a cópia Google exata',()=>{
 const a=pessoais();a.run(`E.agenda.push({...E.agenda[0],id:'outro-titulo-igual',googleId:'cal-teste:outra-identidade'},{...E.agenda[0],id:'outro-calendario',googleCalendar:'outro-cal',googleId:'outro-cal:pessoal-0'});const antesPessoais=JSON.stringify(E);const eventosPessoais=eventosDoEcossistema()`);
 for(const id of ['pessoal-0','pessoal-1']){const eventos=json(a,`eventosPessoais.filter(e=>e.ref?.id==='${id}')`);assert.equal(eventos.length,4);assert.equal(eventos.filter(e=>!e.avisoDocumento).length,1);assert.deepEqual(eventos.filter(e=>e.avisoDocumento).map(e=>e.diasAntes),[60,30,7]);}
 assert.deepEqual(json(a,`eventosPessoais.filter(e=>e.fonte==='compromissos').map(e=>e.ref.id)`),['outro-titulo-igual','outro-calendario']);assert.equal(a.run(`eventosDoEcossistema({preservarCopiasGoogle:true}).filter(e=>e.fonte==='compromissos').length`),4);assert.equal(a.run('JSON.stringify(E)===antesPessoais'),true);assert.doesNotThrow(()=>a.run('validarBackup(E)'));
});
test('painel de documentos pessoais informa titular, vínculo e prazo sem exibir número',()=>{
 const a=pessoais();a.run(`document.body.appendChild(DocumentosAgenda.painel(E.documentos,'2026-10-26',()=>{},E.agenda))`);const p=a.document.querySelector('.documentos-agenda');assert.ok(p);assert.match(p.querySelector('h2').textContent,/Documentos e clube/);assert.equal(p.querySelectorAll('.documentos-agenda-prazo').length,2);assert.match(p.textContent,/CNH.*Titular fictício 0/);assert.match(p.textContent,/Passaporte.*Titular fictício 1/);assert.match(p.textContent,/60, 30 e 7 dias/);assert.equal(/PRIVADO-FICTICIO/.test(p.outerHTML),false);
 const links=[...p.querySelectorAll('a')];assert.match(links[0].textContent,/Titular fictício 0/);assert.match(links[1].textContent,/Titular fictício 1/);assert.equal(a.run(`DocumentosAgenda.eventos(E.documentos,'2026-10-26',E.agenda).some(e=>e.sub.includes('PRIVADO-FICTICIO'))`),false);
});
test('documentos pessoais com data divergente, cancelamento ou sem vínculo mantêm seus prazos',()=>{
 const a=pessoais();a.run(`E.documentos[0].validade='2027-02-15';E.agendaGoogleHistorico=[{registro:structuredClone(E.agenda[1]),motivo:'Cancelado no Google'}];E.agenda.splice(1,1);E.documentos.push({id:'sem-vinculo',nome:'CNH',dono:'Outro titular',validade:'2027-01-15'});const prazosPessoais=DocumentosAgenda.prazos(E.documentos,'2026-10-26',E.agenda,E.agendaGoogleHistorico)`);
 const prazos=json(a,'prazosPessoais');assert.equal(prazos.length,3);assert.equal(prazos.find(e=>e.ref.id==='pessoal-0').googleAgenda.situacao,'alterado');assert.equal(prazos.find(e=>e.ref.id==='pessoal-1').googleAgenda.situacao,'cancelado');assert.equal(prazos.find(e=>e.ref.id==='sem-vinculo').googleAgenda,undefined);assert.deepEqual(json(a,`[...DocumentosAgenda.copiasGoogle(E.documentos,'2026-10-26',E.agenda,E.agendaGoogleHistorico)]`),[]);
 assert.equal(a.run(`DocumentosAgenda.eventos(E.documentos,'2026-10-26').filter(e=>e.avisoDocumento).length`),9);
});
test('Radar emite um aviso por documento pessoal e não acompanha títulos apenas parecidos',()=>{
 const a=pessoais();a.run(`E.documentos.forEach(d=>d.validade=hoje());E.documentos.push({id:'quase-cnh',nome:'CNH - material de estudo',validade:hoje()});const avisosPessoais=radar()`);
 for(const id of ['pessoal-0','pessoal-1'])assert.equal(a.run(`avisosPessoais.filter(e=>e.ref?.id==='${id}').length`),1);
 assert.equal(a.run(`DocumentosAgenda.acompanhado({nome:' cNh '})`),true);assert.equal(a.run(`DocumentosAgenda.acompanhado({nome:'passaporte'})`),true);assert.equal(a.run(`DocumentosAgenda.acompanhado(E.documentos[2])`),false);assert.equal(a.run(`DocumentosAgenda.acompanhado({nome:'Contrato'})`),false);
});
