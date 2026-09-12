import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
function memoria(app){const itens=new Map();app.ctx.sessionStorage={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,String(v)),removeItem:k=>itens.delete(k)};app.ctx.localStorage={getItem:k=>itens.get(k)||null,setItem:(k,v)=>itens.set(k,String(v)),removeItem:k=>itens.delete(k)};return itens}

test('Sync: adoção com modal aberto libera aplicação e preserva rascunho',()=>{
 const app=setup(),{run,document}=app;memoria(app);run("novoCompromissoRotina('2027-01-10')");document.querySelector('[name="titulo"]').value='Reunião digitada';run('adotaNuvem({dados:structuredClone(SEED),mt:50},false)');assert.equal(document.querySelectorAll('#modais .fundo').length,0);assert.equal(document.querySelector('.app').hasAttribute('inert'),false);assert.equal(document.querySelector('.app').hasAttribute('aria-hidden'),false);assert.match(run('JSON.stringify(lerRascunhoSync())'),/Reunião digitada/);assert.ok(document.querySelector('[data-abrir-rascunho-sync]'));
});
test('Sync: leitura inicial fecha referências antigas e mantém texto recuperável',async()=>{
 const app=setup(),{run,document}=app;memoria(app);run("window.__testeSync=true;_tabBase=0;E._mt=1;apiSync=async()=>({mt:50,dados:{...structuredClone(SEED),_mt:100}});novoCompromissoRotina('2027-01-10')");document.querySelector('[name="titulo"]').value='Rascunho enquanto carrega';await run('puxarNuvem()');assert.equal(document.querySelectorAll('.rotina-form').length,0);assert.equal(run('_tabBase'),50);assert.equal(run('E.agenda.length'),0);run('abrirRascunhoSync()');assert.match(document.querySelector('[data-recuperacao-sync] textarea').value,/Rascunho enquanto carrega/);
});
test('Sync: recuperação não aplica campos automaticamente',()=>{
 const app=setup(),{run,document}=app;memoria(app);run("novoCompromissoRotina();");document.querySelector('[name="titulo"]').value='<script>conteúdo literal</script>';run('adotaNuvem({dados:structuredClone(SEED),mt:50},false);abrirRascunhoSync()');assert.equal(run('E.agenda.length'),0);assert.equal(document.querySelector('[data-recuperacao-sync] script'),null);assert.match(document.querySelector('[data-recuperacao-sync] textarea').value,/<script>/);
});
test('Sync: senhas, tokens, chaves e campos ocultos não entram no rascunho',()=>{
 const app=setup(),{run,document}=app;memoria(app);run("abrirModal('Teste','',c=>c.appendChild(el('<label>Nome<input name=nome value=Pessoa></label><label>Senha<input type=password value=senha-secreta></label><label>Token API<input value=token-secreto></label><label>Chave de acesso<input value=chave-secreta></label><input type=hidden value=oculto-secreto>')));guardarRascunhoSync()");const json=run('JSON.stringify(lerRascunhoSync())');assert.match(json,/Pessoa/);assert.doesNotMatch(json,/senha-secreta|token-secreto|chave-secreta|oculto-secreto/);
});
test('Sync: indisponibilidade de sessionStorage mantém recuperação em memória',()=>{
 const {run,document,ctx}=setup();ctx.sessionStorage={getItem(){throw Error('bloqueado')},setItem(){throw Error('bloqueado')},removeItem(){throw Error('bloqueado')}};run('novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Texto em memória';assert.doesNotThrow(()=>run('adotaNuvem({dados:structuredClone(SEED),mt:50},false)'));assert.match(run('JSON.stringify(lerRascunhoSync())'),/Texto em memória/);
});
test('Sync: segunda adoção não apaga textos previamente preservados',()=>{
 const app=setup(),{run,document}=app;memoria(app);run('novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Primeiro';run('adotaNuvem({dados:structuredClone(SEED),mt:50},false);novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Segundo';run('adotaNuvem({dados:structuredClone(SEED),mt:60},false)');const json=run('JSON.stringify(lerRascunhoSync())');assert.match(json,/Primeiro/);assert.match(json,/Segundo/);assert.equal(document.querySelectorAll('[data-abrir-rascunho-sync]').length,1);
});
test('Sync: usuário pode apagar só os textos de recuperação',()=>{
 const app=setup(),{run,document}=app;memoria(app);run('novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Rascunho';run('adotaNuvem({dados:structuredClone(SEED),mt:50},false);abrirRascunhoSync()');[...document.querySelectorAll('#modais button')].find(b=>b.textContent==='Apagar textos preservados').click();assert.equal(run('lerRascunhoSync()'),null);assert.equal(document.querySelector('[data-abrir-rascunho-sync]'),null);assert.equal(run('E.agenda.length'),0);
});
test('Sync: sair da aplicação limpa recuperação da sessão anterior',()=>{
 const app=setup(),{run,document,ctx}=app;memoria(app);ctx.confirm=()=>true;ctx.location.reload=()=>{};run('novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Texto da sessão';run('guardarRascunhoSync();sairApp()');assert.equal(run('lerRascunhoSync()'),null);assert.equal(run('sessionStorage.getItem(CHAVE_RASCUNHO_SYNC)'),null);
});
for(const chamada of ['apiSync("GET")','apiPut()'])test('Sync: sessão expirada limpa recuperação em '+chamada,async()=>{
 const app=setup(),{run,document,ctx}=app;memoria(app);ctx.location.reload=()=>{};ctx.fetch=async()=>({status:401});run('novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Texto da sessão';run('guardarRascunhoSync()');await assert.rejects(()=>run(chamada),/sessão expirou/);assert.equal(run('lerRascunhoSync()'),null);assert.equal(run('sessionStorage.getItem(CHAVE_RASCUNHO_SYNC)'),null);
});
test('Sync: tela de login remove textos de outro usuário da mesma aba',()=>{
 const app=setup(),{run,document}=app;memoria(app);run('novoCompromissoRotina()');document.querySelector('[name="titulo"]').value='Texto anterior';run('guardarRascunhoSync();telaLogin()');assert.equal(run('lerRascunhoSync()'),null);
});

const calendario=eventos=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+eventos.join('\r\n')+'\r\nEND:VCALENDAR';
const evento=(id,ini,fim,titulo='Evento')=>`BEGIN:VEVENT\r\nUID:${id}\r\nDTSTART${ini}\r\nDTEND${fim}\r\nSUMMARY:${titulo}\r\nEND:VEVENT`;
test('ICS: UTC é convertido para Brasília sem gravar antes da aprovação',async()=>{
 const {run,ctx,document}=setup();ctx.arquivo={text:async()=>calendario([evento('utc',':20260920T150000Z',':20260920T160000Z')])};await run('importarIcs(arquivo)');assert.equal(run('E.agenda.length'),0);assert.match(document.querySelector('.google-evento').textContent,/12:00 → 13:00/);const bt=[...document.querySelectorAll('#modais button')].find(b=>b.textContent==='Importar selecionados');assert.equal(bt.disabled,true);const box=document.querySelector('.google-evento input');assert.equal(box.checked,undefined);box.checked=true;box.onchange({target:box});bt.click();assert.equal(run('E.agenda[0].hora'),'12:00');assert.equal(run('E.agenda[0].horaFim'),'13:00');
});
test('ICS: fim exclusivo de período em dias inteiros preserva 20 a 23',()=>{
 const {run,ctx}=setup();ctx.ics=calendario([evento('dias',';VALUE=DATE:20260920',';VALUE=DATE:20260924')]);assert.equal(run('prepararImportacaoIcs(ics).plano[0].reg.ate'),'2026-09-23');assert.equal(run('E.agenda.length'),0);
});
test('ICS: período com horário preserva todos os dias e fim exato',()=>{
 const {run,ctx}=setup();ctx.ics=calendario([evento('longo',':20260920T150000Z',':20260923T160000Z')]);assert.equal(run('prepararImportacaoIcs(ics).plano[0].reg.ate'),'2026-09-23');assert.equal(run('prepararImportacaoIcs(ics).plano[0].reg.icsFim'),'2026-09-23T16:00:00.000Z');
});
test('ICS: cancelar prévia não inclui qualquer evento',async()=>{
 const {run,ctx,document}=setup();ctx.arquivo={text:async()=>calendario([evento('x',';VALUE=DATE:20260920',';VALUE=DATE:20260921')])};await run('importarIcs(arquivo)');[...document.querySelectorAll('#modais button')].find(b=>b.textContent==='Cancelar').click();assert.equal(run('E.agenda.length'),0);
});
test('ICS: UID existente atualiza em vez de duplicar e Google continua protegido',()=>{
 const {run,ctx}=setup();ctx.ics=calendario([evento('x',';VALUE=DATE:20260920',';VALUE=DATE:20260921','Título novo')]);run("E.agenda=[{id:'local',gid:'x',titulo:'Antigo',data:'2026-09-20'}]");assert.equal(run('prepararImportacaoIcs(ics).plano[0].acao'),'atualizar');run("E.agenda[0].googleId='cal:x'");assert.equal(run('prepararImportacaoIcs(ics).plano[0].acao'),'google');
});
test('ICS: mudança somente no horário final é oferecida para revisão',()=>{
 const {run,ctx}=setup();ctx.ics=calendario([evento('fim',':20260920T150000Z',':20260920T160000Z')]);run('E.agenda=[{id:"local",...prepararImportacaoIcs(ics).plano[0].reg}]');assert.equal(run('prepararImportacaoIcs(ics).plano[0].acao'),'existente');ctx.ics=calendario([evento('fim',':20260920T150000Z',':20260920T170000Z')]);assert.equal(run('prepararImportacaoIcs(ics).plano[0].acao'),'atualizar');assert.equal(run('E.agenda[0].horaFim'),'13:00');
});
test('ICS: recorrência não é reduzida silenciosamente ao primeiro evento',()=>{
 const {run,ctx}=setup();ctx.ics=calendario([evento('recorrente',';VALUE=DATE:20260920',';VALUE=DATE:20260921').replace('SUMMARY:','RRULE:FREQ=WEEKLY\r\nSUMMARY:')]);assert.equal(run('prepararImportacaoIcs(ics).plano.length'),0);assert.match(run('prepararImportacaoIcs(ics).avisos.join()'),/recorrente/);
});
test('Saúde: texto misturado não é classificado como valor numérico',()=>{
 const {run}=setup();for(const valor of ['90abc','90 mg/dL','<90','Infinity','',' ']){assert.equal(run(`Number.isNaN(numeroResultadoSaude(${JSON.stringify(valor)}))`),true);assert.equal(run(`semaforo({exame:'LDL',valor:${JSON.stringify(valor)}})`),'')}
});
test('Saúde: decimais e número zero continuam numéricos',()=>{
 const {run}=setup();assert.equal(run("numeroResultadoSaude('5,4')"),5.4);assert.equal(run("numeroResultadoSaude(' 90.5 ')"),90.5);assert.equal(run('numeroResultadoSaude(0)'),0);
});
test('Saúde: texto numérico parcial não entra no gráfico ou tendência',()=>{
 const {run,document}=setup();run("E.exames=[{id:'a',exame:'LDL',data:'2026-01-01',valor:'90abc'},{id:'b',exame:'LDL',data:'2026-02-01',valor:'100'}];vSaude(document.getElementById('main'))");assert.match(document.querySelector('[data-bid="sa-ex"] tbody tr').textContent,/Sem comparação numérica/);run("modalMarcador('LDL')");assert.equal(document.querySelector('#modais .grafico'),null);
});
