/* A conexão do Google passou a nascer do servidor: um crachá só serve Drive,
   Gmail e Agenda. O que estes testes guardam é a parte que engana — escopo que
   o dono NÃO concedeu não pode virar sessão, senão a tela promete um serviço
   que vai responder 403 sem explicação. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';

const app = (resposta) => {
  const {run} = setup({hostname:'central.example.test'});
  run("window.__n=0;apiSync=async(m,c)=>{if(c&&c.acao==='googleToken'){window.__n++;return " + JSON.stringify(resposta) + "}return{}}");
  run("for(const k in googleSessao)googleSessao[k]=null;googleCrachaPedido=null;_gmailToken=''");
  return run;
};
const vence = new Date(Date.now() + 3000e3).toISOString();

test('crachá do servidor liga os quatro serviços quando tudo foi concedido', async () => {
  const run = app({token: 'tk', vence, escopo: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.app.created'});
  assert.equal(await run('googleCrachaDoServidor()'), true);
  for (const s of ['drive', 'gmail', 'agenda', 'agendaEnviar'])
    assert.equal(run(`googleConectado('${s}')`), true, s + ' ficou de fora');
  assert.equal(run('_gmailToken'), 'tk');
});

test('escopo não concedido NÃO vira sessão', async () => {
  const run = app({token: 'tk', vence, escopo: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly'});
  await run('googleCrachaDoServidor()');
  assert.equal(run("googleConectado('drive')"), true);
  assert.equal(run("googleConectado('agenda')"), true);
  assert.equal(run("googleConectado('gmail')"), false, 'Gmail sem permissão não pode parecer conectado');
  assert.equal(run("googleConectado('agendaEnviar')"), false);
  assert.equal(run('_gmailToken'), '');
});

test('autorização antiga, sem lista de escopos, vale só para o Drive', async () => {
  const run = app({token: 'tk', vence, escopo: ''});
  await run('googleCrachaDoServidor()');
  assert.equal(run("googleConectado('drive')"), true);
  assert.equal(run("googleConectado('gmail')"), false, 'assumir escopo que não veio enche a tela de 403');
});

test('servidor sem autorização não inventa sessão', async () => {
  const run = app({precisaAutorizar: true});
  assert.equal(await run('googleCrachaDoServidor()'), false);
  assert.equal(run("googleConectado('drive')"), false);
});

test('conectarGoogle não abre janela quando o servidor já resolve', async () => {
  const run = app({token: 'tk', vence, escopo: 'https://www.googleapis.com/auth/gmail.readonly'});
  run("carregarGis=async()=>{throw new Error('abriu a janela do Google')}");
  assert.equal(await run("conectarGoogle('gmail')"), 'tk');
});

test('pedidos ao mesmo tempo não viram dois pedidos', async () => {
  const run = app({token: 'tk', vence, escopo: 'https://www.googleapis.com/auth/drive.readonly'});
  await run('Promise.all([googleCrachaDoServidor(),googleCrachaDoServidor(),googleCrachaDoServidor()])');
  assert.equal(Number(run('window.__n')), 1);
});

test('a volta do Google diz QUAL permissão faltou', () => {
  const {run} = setup({hostname:'central.example.test'});
  const txt = run("driveTextoVolta('escopo-gmail.readonly,calendar.app.created')");
  assert.match(txt, /Gmail/);
  assert.match(txt, /Agenda/);
  assert.match(txt, /continua valendo/);
});

test('prévia local não consulta token nem provoca recarga por sessão ausente', async()=>{
 const {run}=setup();run("apiSync=async()=>{throw Error('não deveria consultar servidor')}");
 assert.equal(await run('googleCrachaDoServidor()'),false);
});

test('abrir o Drive apenas verifica o servidor, sem abrir login automaticamente',async()=>{
 const {run,document}=setup({hostname:'central.example.test'});
 run("window.__popups=0;apiSync=async()=>({precisaAutorizar:true});carregarGis=async()=>{window.__popups++;throw Error('popup inesperado')};tela=()=>{};atual='drive';driveAutoTentado=false;vDrive(document.getElementById('main'))");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('window.__popups'),0);
 run("vDrive(document.getElementById('main'))");
 assert.match(document.getElementById('main').textContent,/Conectar Google/);
});

test('conexão permanente não aceita token vencido nem mantém escopo retirado',async()=>{
 const run=app({token:'tk',vence,escopo:'https://www.googleapis.com/auth/gmail.readonly'});
 await run('googleCrachaDoServidor()');
 run("apiSync=async()=>({token:'tk2',vence:"+JSON.stringify(vence)+",escopo:'https://www.googleapis.com/auth/drive.readonly'})");
 await run('googleCrachaDoServidor()');
 assert.equal(run("googleConectado('gmail')"),false);
 assert.equal(run('_gmailToken'),'');
 run("apiSync=async()=>({token:'velho',vence:'2020-01-01T00:00:00Z',escopo:'https://www.googleapis.com/auth/drive.readonly'})");
 assert.equal(await run('googleCrachaDoServidor()'),false);
 assert.equal(run("googleConectado('drive')"),false);
});

test('Gmail oferece conexão que persiste e identifica a origem da sessão',async()=>{
 const {run,document}=setup({hostname:'central.example.test'});
 run("window.__autorizou=0;driveAutorizarNoGoogle=async()=>{window.__autorizou++};document.getElementById('main').appendChild(blocoGoogle('gmail'))");
 const button=[...document.querySelectorAll('#main button')].find(b=>b.textContent==='Conectar Google');
 assert.ok(button,'conexão permanente deve estar visível');
 button.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('window.__autorizou'),1);
 run("googleSessao.gmail={token:'tk',vence:Date.now()+3600000,origem:'servidor'};document.getElementById('main').replaceChildren(blocoGoogle('gmail'))");
 assert.match(document.getElementById('main').textContent,/Reconexão automática/);
 assert.doesNotMatch(document.getElementById('main').textContent,/Conectado nesta sessão/);
});

test('desconectar a autorização compartilhada limpa todos os serviços somente após confirmação do servidor',async()=>{
 const run=app({token:'tk',vence,escopo:'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly'});
 await run('googleCrachaDoServidor()');
 run("apiSync=async()=>{throw Error('sem resposta')};tela=()=>{}");
 await assert.rejects(run('googleDesconectarTudo()'),/sem resposta/);
 assert.equal(run("googleConectado('gmail')"),true);
 run("apiSync=async()=>({ok:true})");await run('googleDesconectarTudo()');
 for(const s of ['drive','gmail','agenda'])assert.equal(run(`googleConectado('${s}')`),false);
 assert.equal(run('_gmailToken'),'');
});
