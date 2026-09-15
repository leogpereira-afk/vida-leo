/* Saúde entrou na Agenda. A regra que estes testes guardam é uma só e é a que
   quebra fácil: o calendário só recebe o que TEM data. Rastreio sem nenhum
   exame registrado não tem data — tem ausência de data — e jogá-lo no dia de
   hoje inventaria um compromisso que ninguém marcou. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const app = ({nascimento = '1980-01-01'} = {}) => {
  const {run} = setup();
  run("E.vacinas=[];E.tratamentos=[];E.exames=[];E.vitais=[];E.agenda=[];E.documentos=[];E.viagens=[]");
  run("E.perfil=Object.assign({},E.perfil,{nascimento:" + JSON.stringify(nascimento) + "})");
  return run;
};
const saude = (run) => JSON.parse(run("JSON.stringify(eventosDoEcossistema().filter(e=>e.fonte==='saude').map(e=>({data:e.data,titulo:e.titulo})))"));

test('Saúde na agenda: próxima dose de vacina entra pela data dela', () => {
  const run = app();
  run("E.vacinas=[{vacina:'Febre amarela',data:'2020-03-01',proxima:'2030-03-01'},{vacina:'Sem próxima',data:'2020-03-01',proxima:''}]");
  const ev = saude(run);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].data, '2030-03-01');
  assert.match(ev[0].titulo, /Febre amarela/);
});

test('Saúde na agenda: tratamento encerrado não cobra término', () => {
  const run = app();
  run("E.tratamentos=[{oque:'Antibiótico',fim:'2030-01-10',status:'Em andamento'},{oque:'Velho',fim:'2030-01-11',status:'Encerrado'}]");
  const ev = saude(run);
  assert.equal(ev.length, 1);
  assert.match(ev[0].titulo, /Antibiótico/);
});

test('Saúde na agenda: exame com laudo pronto já aconteceu — não é compromisso', () => {
  const run = app();
  run("E.exames=[{exame:'Futuro',data:'2030-05-05',resultado:''},{exame:'Aguardando',data:'2020-01-01',resultado:'Aguardando'},{exame:'Pronto',data:'2020-01-02',resultado:'Normal'}]");
  const titulos = saude(run).map(e => e.titulo).join(' | ');
  assert.match(titulos, /Futuro/);
  assert.match(titulos, /Aguardando/);
  assert.ok(!/Pronto/.test(titulos), titulos);
});

test('Saúde na agenda: rastreio SEM registro não vira data inventada', () => {
  const run = app();
  // sem nenhum exame lançado, todo rastreio está "Sem registro" — e sem data
  assert.equal(run("rastreiosPendentes().some(x=>!x.ultima)"), true, 'o cenário precisa ter rastreio sem registro');
  assert.deepEqual(saude(run), []);
});

test('Saúde na agenda: rastreio COM registro cai no vencimento, não em hoje', () => {
  const run = app();
  run("E.exames=[{exame:rastreiosPendentes(true)[0].nome,data:'2026-01-10',resultado:'Normal'}]");
  const cada = Number(run("rastreiosPendentes(true)[0].cada"));
  const ev = saude(run).filter(e => /refazer/.test(e.titulo));
  assert.equal(ev.length, 1, JSON.stringify(saude(run)));
  const d = new Date('2026-01-10T12:00'); d.setMonth(d.getMonth() + cada);
  assert.equal(ev[0].data, d.toISOString().slice(0, 10));
  assert.notEqual(ev[0].data, run('hoje()'));
});

test('Saúde na agenda: a fonte existe nos chips e tem cor', () => {
  const run = app();
  assert.equal(run("FONTES_AGENDA.some(f=>f.k==='saude')"), true);
  assert.match(run("corFonte('saude')"), /^#[0-9a-f]{6}$/i);
});

test('Agenda fica logo abaixo de Início no menu', () => {
  const run = app();
  const ids = JSON.parse(run("JSON.stringify(MODS.map(m=>m.id))"));
  assert.equal(ids[0], 'inicio');
  assert.equal(ids[1], 'agenda');
  assert.equal(ids.filter(x => x === 'agenda').length, 1, 'Agenda duplicada no menu');
});

/* O calendário da empresa vem da rede. Quando a leitura falhava, a tela
   re-renderizava para mostrar o aviso — e re-renderizar pedia de novo. O laço
   apareceu de verdade: a suíte inteira travou. O freio é de uma tentativa. */
const passo = () => new Promise(r => setImmediate(r));

test('Agenda: calendário da empresa que falha não entra em laço', async () => {
  const {run} = setup();
  run("atual='agenda';window.__pedidos=0;window.__telas=0;tela=()=>{window.__telas++}");
  run("apiSync=async(m,c)=>{if(c&&c.acao==='empresaDatas'){window.__pedidos++;throw new Error('sem rede')}return{}}");
  run("empresaDatasCache=null;empresaDatasPedido=null;empresaDatasErro='';empresaDatasDesistiu=false");
  run("vAgenda(document.createElement('div'))"); await passo(); await passo();
  run("vAgenda(document.createElement('div'))"); await passo(); await passo();
  run("vAgenda(document.createElement('div'))"); await passo(); await passo();
  assert.equal(Number(run('window.__pedidos')), 1, 'pediu mais de uma vez depois de falhar');
  assert.ok(Number(run('window.__telas')) <= 1, 'redesenhou em laço');
  assert.match(run('empresaDatasErro'), /sem rede/);
});

test('Agenda: depois da falha, é o dono que destrava', async () => {
  const {run} = setup();
  run("atual='agenda';window.__pedidos=0;tela=()=>{}");
  run("apiSync=async(m,c)=>{if(c&&c.acao==='empresaDatas'){window.__pedidos++;throw new Error('sem rede')}return{}}");
  run("empresaDatasCache=null;empresaDatasPedido=null;empresaDatasErro='';empresaDatasDesistiu=false");
  run("vAgenda(document.createElement('div'))"); await passo(); await passo();
  assert.equal(Number(run('window.__pedidos')), 1);
  run("empresaDatasDesistiu=false;empresaDatasErro=''");            // é o que o botão faz
  run("vAgenda(document.createElement('div'))"); await passo(); await passo();
  assert.equal(Number(run('window.__pedidos')), 2, 'o botão de tentar de novo não refez o pedido');
});

test('Agenda: evento da empresa entra pela data, e some se a leitura não veio', () => {
  const {run} = setup();
  run("empresaDatasCache=null;E.agenda=[];E.documentos=[];E.viagens=[]");
  assert.equal(run("eventosDoEcossistema().filter(e=>e.fonte==='painel').length"), 0);
  run("empresaDatasCache={em:Date.now(),eventos:[{id:'a',titulo:'Feriado',data:'2026-12-25',tipo:'Feriado',cor:'#dc2626',hora:'',descricao:''},{id:'b',titulo:'Sem data',data:'',tipo:'Outro'}]}");
  const ev = JSON.parse(run("JSON.stringify(eventosDoEcossistema().filter(e=>e.fonte==='painel').map(e=>({data:e.data,titulo:e.titulo})))"));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].data, '2026-12-25');
});

/* A barra do Google no topo da Agenda: ela existe para o Léo saber, de relance,
   se está conectado — "atualizar" que não diz o estado deixa a pessoa clicando
   num botão morto. E os chips saíram de dentro do recolhido. */
test('Agenda: a barra do Google diz o estado e fica no topo', () => {
  const {run, document} = setup();
  run("atual='agenda';for(const k in googleSessao)googleSessao[k]=null");
  run("const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  const barra = document.querySelector('.agenda-google');
  assert.ok(barra, 'a barra do Google não foi montada');
  assert.match(barra.textContent, /desconectado/i);
  assert.match(barra.textContent, /7 dias/);
  assert.match(barra.textContent, /sem você marcar/);
  assert.ok(document.querySelector('.topo').contains(barra), 'a barra não ficou no topo');
});

test('Agenda: conectado, a barra muda de recado', () => {
  const {run, document} = setup();
  const vence = Date.now() + 3000e3;
  run(`atual='agenda';googleSessao.gmail={token:'t',vence:${vence}};googleSessao.agenda={token:'t',vence:${vence}}`);
  run("const m=document.getElementById('main');m.replaceChildren();vAgenda(m)");
  const barra = document.querySelector('.agenda-google');
  assert.match(barra.textContent, /Google conectado/);
  assert.match(barra.textContent, /Atualizar Gmail e Agenda/);
});

test('Agenda: os chips ficam à vista, acima da grade do mês', () => {
  const {run, document} = setup();
  run("atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  const chips = document.querySelector('.agenda-categorias');
  assert.ok(chips, 'os chips sumiram');
  assert.equal(chips.closest('details'), null, 'os chips voltaram para dentro do recolhido');
  const cal = document.querySelector('[data-bid="ag-mes"]');
  assert.ok(cal.contains(chips), 'os chips foram varridos para fora do quadro do calendário');
  const grade = cal.querySelector('table, .cal-grade, .conteudo > *:not(.agenda-categorias):not(.agenda-filtro-aviso)');
  if (grade) assert.ok(chips.compareDocumentPosition(grade) & 4, 'os chips ficaram DEPOIS da grade');
});

/* O botão diz "Gmail e Agenda". Ele tinha de ler os dois — na primeira versão
   lia só o Gmail, e botão que mente é pior que botão que falta. */
test('Agenda: o botão lê o Gmail E o calendário', async () => {
  const {run} = setup();
  const vence = Date.now() + 3000e3;
  run(`atual='agenda';for(const k of ['gmail','agenda','agendaEnviar','drive'])googleSessao[k]={token:'t',vence:${vence}}`);
  run("window.__lidos=[];tela=()=>{};abrirModal=(t,s,montar,aoFechar)=>{window.__lidos.push('modal:'+t);if(aoFechar)aoFechar()}");
  run("consultarConvitesGmail=async()=>{window.__lidos.push('gmail');return{plano:[],avisos:[],mensagens:0,proximaPagina:''}}");
  run("googleLer=async(serv,caminho)=>{window.__lidos.push(serv+':'+caminho);return caminho.startsWith('calendars/primary')&&!caminho.includes('events')?{id:'primary',summary:'Principal'}:{items:[]}}");
  await run("atualizarGoogleParticular(()=>{},()=>{})");
  const lidos = JSON.parse(run('JSON.stringify(window.__lidos)'));
  assert.ok(lidos.includes('gmail'), 'não leu o Gmail: ' + lidos.join(', '));
  assert.ok(lidos.some(x => x.startsWith('agenda:calendars/primary')), 'não leu o calendário: ' + lidos.join(', '));
});

test('Agenda: calendário fora do ar não apaga o que o Gmail trouxe', async () => {
  const {run} = setup();
  const vence = Date.now() + 3000e3;
  run(`atual='agenda';for(const k of ['gmail','agenda'])googleSessao[k]={token:'t',vence:${vence}}`);
  run("window.__recado='';tela=()=>{};abrirModal=(t,s,m,aoFechar)=>{if(aoFechar)aoFechar()}");
  run("consultarConvitesGmail=async()=>({plano:[],avisos:[],mensagens:0,proximaPagina:''})");
  run("googleLer=async()=>{throw new Error('sem rede')}");
  await run("atualizarGoogleParticular(m=>{window.__recado=m},()=>{})");
  assert.match(run('window.__recado'), /Gmail conferido/);
  assert.match(run('window.__recado'), /sem rede/);
});
