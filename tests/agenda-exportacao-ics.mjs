import {test} from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import {setup} from './helpers/dom.mjs';

const arquivo=(inicio,fim,titulo='Encontro')=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:origem-estavel\r\nDTSTART${inicio}\r\nDTEND${fim}\r\nSUMMARY:${titulo}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
function importar(app,inicio,fim){app.ctx.ics=arquivo(inicio,fim);app.run('E.agenda=[{id:"local-1",...prepararImportacaoIcs(ics).plano[0].reg}]')}
async function exportado(app){app.ctx.arquivos=[];app.run('baixar=(blob,nome)=>arquivos.push({blob,nome});exportarIcs()');assert.equal(app.ctx.arquivos.length,1);const texto=await app.ctx.arquivos[0].blob.text();return {texto,evento:new ICAL.Component(ICAL.parse(texto)).getFirstSubcomponent('vevent')}}
function utc(evento,campo){return evento.getFirstPropertyValue(campo).toJSDate().toISOString()}

test('Exportação ICS: importado preserva início, término e UID no roundtrip',async()=>{
 const app=setup();importar(app,':20260920T150030Z',':20260920T173045Z');const {evento,texto}=await exportado(app);assert.equal(utc(evento,'dtstart'),'2026-09-20T15:00:30.000Z');assert.equal(utc(evento,'dtend'),'2026-09-20T17:30:45.000Z');assert.equal(evento.getFirstPropertyValue('uid'),'origem-estavel');app.ctx.ics=texto;assert.equal(app.run('prepararImportacaoIcs(ics).plano[0].acao'),'existente');
});
test('Exportação ICS: fim à meia-noite não acrescenta ou perde um dia',async()=>{
 const app=setup();importar(app,':20260920T230000Z',':20260921T030000Z');assert.equal(app.run('E.agenda[0].ate'),'2026-09-20');const {evento,texto}=await exportado(app);assert.equal(utc(evento,'dtend'),'2026-09-21T03:00:00.000Z');app.ctx.ics=texto;assert.equal(app.run('prepararImportacaoIcs(ics).plano[0].reg.ate'),'2026-09-20');
});
test('Exportação ICS: evento com horário em vários dias mantém duração',async()=>{
 const app=setup();importar(app,':20260920T150000Z',':20260923T164500Z');const {evento}=await exportado(app);assert.equal(utc(evento,'dtend'),'2026-09-23T16:45:00.000Z');
});
test('Exportação ICS: dia inteiro conserva final exclusivo e múltiplos dias',async()=>{
 const app=setup();importar(app,';VALUE=DATE:20260920',';VALUE=DATE:20260924');const {evento,texto}=await exportado(app);assert.equal(evento.getFirstPropertyValue('dtstart').isDate,true);assert.equal(evento.getFirstPropertyValue('dtend').toString(),'2026-09-24');app.ctx.ics=texto;assert.equal(app.run('prepararImportacaoIcs(ics).plano[0].reg.ate'),'2026-09-23');
});
test('Exportação ICS: editar início desloca a duração, sem reaproveitar a data anterior',async()=>{
 const app=setup();importar(app,':20260920T150000Z',':20260920T173000Z');app.run('E.agenda[0].data="2026-10-02";E.agenda[0].hora="09:30"');const {evento}=await exportado(app);assert.equal(utc(evento,'dtstart'),'2026-10-02T12:30:00.000Z');assert.equal(utc(evento,'dtend'),'2026-10-02T15:00:00.000Z');
});
test('Exportação ICS: editar último dia e horário final usa o período atual',async()=>{
 const app=setup();importar(app,':20260920T150000Z',':20260923T164500Z');app.run('E.agenda[0].ate="2026-09-25";E.agenda[0].horaFim="18:00"');const {evento}=await exportado(app);assert.equal(utc(evento,'dtend'),'2026-09-25T21:00:00.000Z');
});
test('Exportação ICS: editar o último dia de evento que acaba à meia-noite mantém fim exclusivo',async()=>{
 const app=setup();importar(app,':20260920T230000Z',':20260921T030000Z');app.run('E.agenda[0].ate="2026-09-22"');const {evento}=await exportado(app);assert.equal(utc(evento,'dtend'),'2026-09-23T03:00:00.000Z');
});
test('Exportação ICS: remover hora transforma em dia inteiro sem usar timestamps antigos',async()=>{
 const app=setup();importar(app,':20260920T150000Z',':20260920T160000Z');app.run('E.agenda[0].hora="";E.agenda[0].data="2026-10-02";E.agenda[0].ate="2026-10-03"');const {evento}=await exportado(app);assert.equal(evento.getFirstPropertyValue('dtstart').toString(),'2026-10-02');assert.equal(evento.getFirstPropertyValue('dtend').toString(),'2026-10-04');
});
test('Exportação ICS: hora final explícita funciona sem timestamps importados',async()=>{
 const app=setup();app.run('E.agenda=[{id:"manual",data:"2026-09-20",hora:"09:00",ate:"2026-09-20",horaFim:"11:30",titulo:"Manual"}]');const {evento}=await exportado(app);assert.equal(utc(evento,'dtstart'),'2026-09-20T12:00:00.000Z');assert.equal(utc(evento,'dtend'),'2026-09-20T14:30:00.000Z');
});
test('Exportação ICS: texto escapado preserva vírgulas, ponto e vírgula, barras e novas linhas',async()=>{
 const app=setup();const titulo='Revisão; metas, pessoas\\planos\nSegunda linha',local='Sala; A, corredor\\2',obs='Linha 1\r\nLinha 2\rLinha 3\nBEGIN:VEVENT\nSUMMARY:Não criar evento';app.ctx.registro={id:'texto',data:'2026-09-20',titulo,local,obs};app.run('E.agenda=[registro]');const {evento,texto}=await exportado(app);assert.equal(evento.getFirstPropertyValue('summary'),titulo);assert.equal(evento.getFirstPropertyValue('location'),local);assert.equal(evento.getFirstPropertyValue('description'),obs.replace(/\r\n?/g,'\n'));assert.equal(new ICAL.Component(ICAL.parse(texto)).getAllSubcomponents('vevent').length,1);
});
test('Exportação ICS: textos longos e Unicode sobrevivem às linhas dobradas',async()=>{
 const app=setup();const titulo='Reunião de evolução 🚀 e atenção à família. '.repeat(15);app.ctx.registro={id:'longo',data:'2026-09-20',titulo};app.run('E.agenda=[registro]');const {evento,texto}=await exportado(app);assert.match(texto,/\r\n /);assert.equal(evento.getFirstPropertyValue('summary'),titulo);
});
test('Exportação ICS: evento manual sem término mantém uma hora, incluindo virada de dia',async()=>{
 const app=setup();app.run('E.agenda=[{id:"manual",data:"2026-09-20",hora:"23:30",titulo:"Manual"}]');const {evento}=await exportado(app);assert.equal(utc(evento,'dtend'),'2026-09-21T03:30:00.000Z');
});
test('Exportação ICS: horário civil usa Brasília inclusive em datas históricas',async()=>{
 const app=setup();app.run('E.agenda=[{id:"historico",data:"2018-12-20",hora:"12:00",titulo:"Histórico"}]');const {evento}=await exportado(app);assert.equal(utc(evento,'dtstart'),'2018-12-20T14:00:00.000Z');
});
test('Exportação ICS: período inválido avisa e não baixa arquivo parcial',()=>{
 const app=setup();app.ctx.arquivos=[];app.ctx.avisos=[];app.ctx.alert=x=>app.ctx.avisos.push(x);app.run('baixar=b=>arquivos.push(b);E.agenda=[{id:"bom",data:"2026-09-20",titulo:"Válido"},{id:"erro",data:"2026-09-20",ate:"2026-09-19",titulo:"Inválido"}];exportarIcs()');assert.equal(app.ctx.arquivos.length,0);assert.match(app.ctx.avisos[0],/Inválido/);
});
