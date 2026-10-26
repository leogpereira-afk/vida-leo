import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
const js=readFileSync(new URL('../publico/documentos-agenda.js',import.meta.url),'utf8');
const armas=readFileSync(new URL('../publico/documentos-armas.js',import.meta.url),'utf8');
const fixture=[{id:'arma-exemplo',grupo:'armas',tipoRegistro:'arma',nome:'Modelo de exemplo',dono:'Pessoa de exemplo',validade:'2027-01-15'},{id:'clube-exemplo',grupo:'armas',tipoRegistro:'clube',nome:'Clube de exemplo',dono:'Pessoa de exemplo',renovacaoDia:30,renovacaoMes:9},{id:'documento-geral',nome:'Documento de exemplo',validade:'2027-01-10'}];
function app(){const a=setup();a.run(js);a.run(armas);a.run('E.documentos='+JSON.stringify(fixture));return a}
const json=(a,s)=>JSON.parse(a.run('JSON.stringify('+s+')'));
test('validades têm lembretes60/30/7 e clube30/7/1 sem multiplicar documentos nem agenda',()=>{
  const a=app();a.run(`const antes=JSON.stringify(E);const ev=DocumentosAgenda.eventos(E.documentos,'2026-10-26')`);
  const es=json(a,'ev');assert.equal(es.length,9);assert.deepEqual(es.filter(e=>e.ref.id==='arma-exemplo'&&e.avisoDocumento).map(e=>e.diasAntes),[60,30,7]);assert.deepEqual(es.filter(e=>e.ref.id==='clube-exemplo'&&e.avisoDocumento).map(e=>e.diasAntes),[30,7,1]);assert.equal(es.filter(e=>e.ref.id==='documento-geral').length,1);assert.equal(a.run('JSON.stringify(E)===antes'),true);assert.equal(new Set(es.map(e=>e.id)).size,es.length);
});
test('mudança de validade substitui datas derivadas sem manter aviso antigo e conserva fontes',()=>{
  const a=app();a.run(`const anterior=DocumentosAgenda.eventos(E.documentos,'2026-10-26');E.documentos[0].fontes=[{id:'f-exemplo'}];E.documentos[0].validade='2027-03-01';const depois=DocumentosAgenda.eventos(E.documentos,'2026-10-26')`);
  assert.equal(a.run(`depois.some(e=>e.ref.id==='arma-exemplo'&&e.dataAlvo==='2027-01-15')`),false);assert.equal(a.run(`depois.filter(e=>e.ref.id==='arma-exemplo').length`),4);assert.equal(a.run('E.documentos[0].fontes[0].id'),'f-exemplo');assert.equal(a.run(`JSON.stringify(DocumentosAgenda.eventos(E.documentos,'2026-10-26').map(e=>e.id))===JSON.stringify(depois.map(e=>e.id))`),true);
});
test('históricos, datas vazias ou impossíveis não viram prazos nem avisos',()=>{
  const a=app();a.run(`E.documentos=[{id:'gt-antiga',grupo:'armas',tipoRegistro:'guia',classificacao:'historico',validade:'2027-01-15'},...['2026-02-30','2027-13-01','','texto',null].map((validade,i)=>({id:'d'+i,grupo:'armas',tipoRegistro:'cr',validade}))]`);
  assert.deepEqual(json(a,`DocumentosAgenda.eventos(E.documentos,'2026-10-26')`),[]);assert.deepEqual(json(a,`DocumentosAgenda.alertas(E.documentos,'2026-10-26')`),[]);assert.deepEqual(json(a,`DocumentosAgenda.eventos(${JSON.stringify(fixture)},'2026-02-30')`),[]);
});
test('avisos atravessam o ano e usam calendário sem erro de fuso ou horário de verão',()=>{
  const a=app();assert.equal(a.run(`DocumentosAgenda.deslocar('2027-01-15',-60)`),'2026-11-16');assert.equal(a.run(`DocumentosAgenda.deslocar('2027-01-15',-30)`),'2026-12-16');assert.equal(a.run(`DocumentosAgenda.deslocar('2028-03-01',-1)`),'2028-02-29');assert.equal(a.run(`DocumentosAgenda.diasEntre('2026-10-26','2026-11-02')`),7);
});
test('renovação em29fevereiro espera ano válido inclusive salto secular',()=>{
  const a=app();a.run(`const c={grupo:'armas',tipoRegistro:'clube',renovacaoDia:29,renovacaoMes:2}`);assert.equal(a.run(`DocumentosAgenda.proximaRenovacao(c,'2026-10-26')`),'2028-02-29');assert.equal(a.run(`DocumentosAgenda.proximaRenovacao(c,'2099-03-01')`),'2104-02-29');assert.equal(a.run(`DocumentosAgenda.proximaRenovacao({...c,renovacaoDia:30},'2026-01-01')`),'');assert.equal(a.run(`DocumentosAgenda.proximaRenovacao({...c,renovacaoDia:31,renovacaoMes:4},'2026-01-01')`),'');
});
test('radar mostra um alerta ativo por prazo, desde60dias, e mantém vencimento não resolvido',()=>{
  const a=app();assert.equal(json(a,`DocumentosAgenda.alertas(E.documentos,'2026-11-15')`).length,0);let at=json(a,`DocumentosAgenda.alertas(E.documentos,'2026-11-16')`);assert.equal(at.length,1);assert.equal(at[0].quando,60);assert.equal(json(a,`DocumentosAgenda.alertas(E.documentos,'2027-01-15')`)[0].quando,0);at=json(a,`DocumentosAgenda.alertas(E.documentos,'2027-01-16')`);assert.equal(at[0].g,0);assert.match(at[0].txt,/Prazo impresso ultrapassado/);
});
test('radar renova clube a cada ano em30dias sem transformar filiação em regular',()=>{
  const a=app();a.run('E.documentos=[E.documentos[1]]');assert.equal(json(a,`DocumentosAgenda.alertas(E.documentos,'2027-08-30')`).length,0);assert.equal(json(a,`DocumentosAgenda.alertas(E.documentos,'2027-08-31')`)[0].quando,30);assert.equal(json(a,`DocumentosAgenda.eventos(E.documentos,'2027-10-01').filter(e=>!e.avisoDocumento)`)[0].data,'2028-09-30');assert.equal(a.run('E.documentos[0].validade'),undefined);
});
test('mesmo ID na coleção não duplica ocorrência; documentos legados sem ID permanecem distintos',()=>{
  const a=app();a.run('E.documentos=[E.documentos[0],structuredClone(E.documentos[0]),{nome:"A",validade:"2027-01-01"},{nome:"B",validade:"2027-01-01"}]');const es=json(a,`DocumentosAgenda.eventos(E.documentos,'2026-10-26')`);assert.equal(es.length,6);assert.equal(new Set(es.map(e=>e.id)).size,6);
});
test('integração usa documentos como origem e não marca avisos já exibidos como dívida vencida',()=>{
  const a=app();a.run(`const ev=eventosDoEcossistema();const aviso=ev.find(e=>e.avisoDocumento);const prazo=ev.find(e=>!e.avisoDocumento&&e.ref?.id==='arma-exemplo')`);assert.equal(a.run('prazo.ref===E.documentos[0]'),true);assert.equal(a.run(`eventoPendenteVencido(aviso,'2099-01-01')`),false);assert.equal(a.run(`eventoPendenteVencido(prazo,'2099-01-01')`),true);assert.equal(a.run('E.agenda.length'),0);
});
test('painel compacto destaca datas, explica alcance e abre ficha pelo documento original',()=>{
  const a=app();a.run(`let selecionado=null;const painelTeste=DocumentosAgenda.painel(E.documentos,'2026-10-26',e=>{selecionado=e});document.body.appendChild(painelTeste)`);assert.equal(a.document.querySelectorAll('.documentos-agenda-prazo').length,2);const primeiro=a.document.querySelector('.documentos-agenda-prazo');assert.equal(primeiro.querySelector('time').getAttribute('datetime'),'2027-01-15');assert.match(a.document.querySelector('.documentos-agenda').textContent,/60, 30 e 7 dias/);assert.match(a.document.querySelector('.documentos-agenda').textContent,/Agenda e no Radar da Central/);assert.match(primeiro.getAttribute('aria-label'),/abrir ficha/);primeiro.click();assert.equal(a.run('selecionado.ref===E.documentos[0]'),true);
});
test('nomes emHTML são texto, datas inválidas não geram cartões vazios',()=>{
  const a=app();a.run(`E.documentos[0].nome='<img src=x onerror=alert(1)>';document.body.appendChild(DocumentosAgenda.painel(E.documentos,'2026-10-26',()=>{}))`);assert.equal(a.document.querySelectorAll('.documentos-agenda img').length,0);assert.match(a.document.querySelector('.documentos-agenda').textContent,/<img src=x/);assert.equal(a.run(`DocumentosAgenda.painel([{grupo:'armas',tipoRegistro:'arma',validade:'2026-02-30'}],'2026-10-26')`),null);
});
test('visitas planejadas recebem7/1dias; canceladas, realizadas e datas inválidas ficam fora',()=>{
  const a=app();a.run(`const visitas=[{id:'v-demo',ref:E.documentos[0],data:'2026-11-07',hora:'09:00',status:'planejada',fonte:'documentos',tipo:'habitualidade'},{id:'v-realizada',data:'2026-11-07',status:'realizada'},{id:'v-cancelada',data:'2026-11-07',status:'cancelada'},{id:'v-invalida',data:'2026-02-30',status:'planejada'}];const v=DocumentosAgenda.eventosVisitas(visitas)`);const es=json(a,'v');assert.equal(es.length,3);assert.deepEqual(es.filter(e=>e.avisoDocumento).map(e=>e.data),['2026-10-31','2026-11-06']);assert.equal(a.run(`eventoPendenteVencido(v[1],'2027-01-01')`),false);assert.equal(a.run(`DocumentosAgenda.alertasVisitas(visitas,'2026-10-30').length`),0);assert.equal(a.run(`DocumentosAgenda.alertasVisitas(visitas,'2026-10-31').length`),1);assert.match(a.run(`DocumentosAgenda.alertasVisitas(visitas,'2026-11-08')[0].txt`),/Presença a confirmar/);
});
test('recarga independente deriva os mesmos IDs e prazos a partir dos mesmos documentos',()=>{
  const a=app(),b=app();a.run(`E.documentos[0].validade='2028-05-01'`);b.run('E.documentos='+a.run('JSON.stringify(E.documentos)'));assert.deepEqual(json(a,`DocumentosAgenda.eventos(E.documentos,'2026-10-26').map(e=>[e.id,e.data])`),json(b,`DocumentosAgenda.eventos(E.documentos,'2026-10-26').map(e=>[e.id,e.data])`));assert.equal(b.run('E.agenda.length'),0);
});
test('Agenda abre a ficha original pelo cartão e filtra prazos junto com documentos',()=>{
  const a=app();a.run(`atual='agenda';tela()`);assert.equal(a.document.querySelectorAll('.documentos-agenda-prazo').length,2);a.document.querySelector('.documentos-agenda-prazo').click();assert.equal(a.run('atual'),'documentos');assert.ok(a.document.querySelector('.da-modal'));assert.equal(a.document.querySelector('.da-modal [name=nome]').value,'Modelo de exemplo');assert.equal(a.run('E.documentos.length'),3);
});
test('Radar integrado emite apenas um alerta por validade e exclui datas impossíveis',()=>{
  const a=app();a.run(`E.documentos[0].validade=hoje();E.documentos.push({id:'inválida',grupo:'armas',tipoRegistro:'cr',validade:'2026-02-30'});const rads=radar()`);assert.equal(a.run(`rads.filter(e=>e.ref?.id==='arma-exemplo').length`),1);assert.equal(a.run(`rads.some(e=>e.ref?.id==='inválida')`),false);
});
test('passaportes com mesmo nome distinguem o titular sem expor número nos eventos e cards',()=>{
  const a=app();a.run(`E.documentos=[{id:'doc-alfa',nome:'Passaporte',dono:'Pessoa Alfa',numero:'EXEMPLO-A',validade:'2027-06-01'},{id:'doc-beta',nome:'Passaporte',dono:'Pessoa Beta',numero:'EXEMPLO-B',validade:'2027-06-01'}];const eventosTitulares=DocumentosAgenda.eventos(E.documentos,'2026-10-26')`);
  const todos=json(a,'eventosTitulares'),ev=todos.filter(e=>!e.avisoDocumento);assert.equal(todos.length,8);assert.equal(ev.length,2);assert.match(ev[0].sub,/de Pessoa Alfa/);assert.match(ev[1].sub,/de Pessoa Beta/);assert.equal(todos.some(e=>/EXEMPLO-[AB]/.test(e.sub)),false);
  a.run(`document.body.appendChild(DocumentosAgenda.painel(E.documentos,'2026-10-26',()=>{}))`);
  const cards=[...a.document.querySelectorAll('.documentos-agenda-prazo')];assert.match(cards[0].querySelector('strong').textContent,/Pessoa Alfa/);assert.match(cards[1].querySelector('strong').textContent,/Pessoa Beta/);assert.match(cards[0].getAttribute('aria-label'),/Pessoa Alfa/);assert.equal(cards[0].textContent.includes('EXEMPLO-A'),false);
});
test('habitualidade integra visitas e avisos sem mudar agenda; backup revalida estrutura aninhada',()=>{
  const a=app();a.run(readFileSync(new URL('../publico/documentos-habitualidade.js',import.meta.url),'utf8'));a.run(`E.documentos[0].habitualidade={metaAnual:4,clubeId:'clube-exemplo',visitas:[{id:'visita-exemplo',data:'2027-01-09',hora:'09:00',status:'planejada'}]};const antesVisitas=JSON.stringify(E);const integrado=eventosDoEcossistema().filter(e=>e.tipo==='habitualidade')`);assert.equal(a.run('integrado.length'),3);assert.equal(a.run('JSON.stringify(E)===antesVisitas'),true);assert.doesNotThrow(()=>a.run('validarBackup(E)'));a.run(`E.documentos[0].habitualidade.visitas[0].data='2027-02-30'`);assert.throws(()=>a.run('validarBackup(E)'),/habitualidade/i);
});
