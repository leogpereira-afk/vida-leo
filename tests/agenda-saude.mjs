import {readFileSync} from 'node:fs';
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
  assert.match(barra.textContent, /Buscar no Gmail/);
  assert.match(barra.textContent, /Buscar no Google Agenda/);
  assert.equal(barra.querySelectorAll('.agenda-google-acoes button').length, 2, 'tem de haver um botão por fonte');
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

/* Cada botão puxa a SUA fonte, e só ela. Um botão que arrasta a outra junto
   volta a obrigar a esperar as duas para ver qualquer uma. */
test('Agenda: o botão do Gmail não lê o calendário, e vice-versa', async () => {
  const montar = () => {
    const {run} = setup();
    const vence = Date.now() + 3000e3;
    run(`atual='agenda';for(const k of ['gmail','agenda'])googleSessao[k]={token:'t',vence:${vence}}`);
    run("window.__lidos=[];tela=()=>{};abrirModal=(t,s,m,aoFechar)=>{if(aoFechar)aoFechar()}");
    run("consultarConvitesGmail=async()=>{window.__lidos.push('gmail');return{plano:[],avisos:[],mensagens:0,proximaPagina:''}}");
    run("googleLer=async(serv,caminho)=>{window.__lidos.push('cal:'+caminho);return caminho.includes('events')?{items:[]}:{id:'primary',summary:'Principal'}}");
    return run;
  };
  const a = montar();
  await a("buscarNoGmailParticular(()=>{},()=>{})");
  const soGmail = JSON.parse(a('JSON.stringify(window.__lidos)'));
  assert.ok(soGmail.includes('gmail'));
  assert.ok(!soGmail.some(x => x.startsWith('cal:')), 'o botão do Gmail puxou o calendário: ' + soGmail.join(', '));

  const b = montar();
  await b("buscarNoCalendarioParticular(()=>{},()=>{})");
  const soCal = JSON.parse(b('JSON.stringify(window.__lidos)'));
  assert.ok(soCal.some(x => x.startsWith('cal:')));
  assert.ok(!soCal.includes('gmail'), 'o botão do calendário puxou o Gmail: ' + soCal.join(', '));
});

test('Agenda: os chips saem todos do mesmo tamanho, em grade', () => {
  const {run, document} = setup();
  run("atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  const chips = [...document.querySelectorAll('.agenda-categorias .ag-chip')];
  assert.ok(chips.length > 5, 'faltam chips');
  // largura igual vem da grade, não do texto: nenhum chip carrega style de largura
  assert.ok(chips.every(c => !/width/.test(c.getAttribute('style') || '')), 'chip com largura própria quebra a simetria');
  /* A COR SAIU DO PONTO DE 9px PARA UM FILETE de 3px à esquerda (16/09/2026).
     Isto é escolha, não descuido: o ponto custava 15px de largura por chip e um
     nó a mais, e o filete diz a mesma coisa gastando só sombra. O que o teste
     guarda continua sendo o mesmo: TODO chip carrega a cor da sua categoria e
     só o escolhido acende. */
  assert.ok(chips.every(c => /--cor:/.test(c.getAttribute('style') || '')), 'chip sem a cor da categoria');
  assert.equal(chips.filter(c => c.classList.contains('on')).length, 1, 'sem filtro, só "Tudo" fica aceso');
  /* O emoji tem coluna PRÓPRIA. Colado ao rótulo no mesmo <span>, os doze
     nomes começavam em doze posições diferentes — emoji não tem largura fixa. */
  assert.ok(chips.every(c => c.querySelector('.ic')), 'chip sem a coluna do ícone');
  /* A classe do chip zerado NÃO pode voltar a se chamar `vazio`: `.vazio` é o
     estado-vazio do app inteiro e traz padding de 26-30px de duas folhas
     diferentes, o que dobrava a altura de toda fileira que tivesse uma
     categoria sem evento. Era esse o "ícones grandes demais" do dono. */
  assert.ok(!chips.some(c => c.classList.contains('vazio')), 'a classe `vazio` colide e infla o chip');
});

/* O SELETOR DE DATA EM CHIPS (pedido do dono, 16/09/2026: "melhorar o seletor
   de data em forma de chips" + "um seletor de ano"). Os doze meses ficam à
   vista; o ano continua em seletor, porque doze chips não alcançam 2022. */
test('Agenda: os doze meses viram chips, e o ano continua num seletor', () => {
  const {run, document} = setup();
  run("atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  const meses = [...document.querySelectorAll('.ag-meses .ag-mes-chip')];
  assert.equal(meses.length, 12, 'os doze meses, sempre — pular mês vazio desalinha a régua');
  assert.equal(meses.filter(m => m.classList.contains('on')).length, 1, 'um mês aceso de cada vez');
  // o ano NÃO virou chip: é seletor, e precisa alcançar bem além do ano corrente
  const anoSel = document.querySelector('.ag-data select');
  assert.ok(anoSel, 'o ano tem de continuar num seletor');
  const anos = [...anoSel.querySelectorAll('option')].map(o => Number(o.value));
  assert.ok(anos.length >= 6, 'o seletor de ano tem de alcançar mais que o ano corrente');
  // e o mês NÃO pode ter sobrado como dropdown: era isso que ia virar chip
  assert.equal(document.querySelectorAll('.ag-data select').length, 1, 'só o ano é seletor; o mês virou chip');
});

test('Agenda: cada chip de mês diz quantas coisas tem no mês', () => {
  const {run, document} = setup();
  run("E.agenda=[{id:'a',titulo:'Consulta',data:'2026-09-10'},{id:'b',titulo:'Outra',data:'2026-09-20'},{id:'c',titulo:'Longe',data:'2026-03-02'}];");
  run("atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  const chip = n => [...document.querySelectorAll('.ag-meses .ag-mes-chip')][n];
  assert.match(chip(8).getAttribute('aria-label'), /Setembro de 2026 — 2 coisas/, 'setembro tem duas');
  assert.match(chip(2).getAttribute('aria-label'), /Março de 2026 — 1 coisa/, 'março tem uma, no singular');
  /* Mês sem nada esconde o número em vez de repetir "0" doze vezes — mas o
     chip continua na régua, senão os doze desalinham a cada troca de mês. */
  assert.ok(chip(0).classList.contains('ag-mes-zero'), 'janeiro vazio fica marcado como zero');
  assert.ok(!chip(8).classList.contains('ag-mes-zero'));
});

test('Agenda: a régua de meses segue a categoria acesa', () => {
  const {run, document} = setup();
  run("E.agenda=[{id:'a',titulo:'Reunião',data:'2026-04-10'}];E.viagens=[{id:'v',destino:'Lisboa',ida:'2026-07-01',volta:'2026-07-05'}];");
  run("filtro.agSo='viagens';atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  const chips = [...document.querySelectorAll('.ag-meses .ag-mes-chip')];
  // com "Viagens" aceso, abril (que só tem compromisso) some da contagem e
  // julho aparece: a régua vira o panorama do ano daquele assunto
  assert.ok(chips[3].classList.contains('ag-mes-zero'), 'abril não é viagem');
  assert.ok(!chips[6].classList.contains('ag-mes-zero'), 'julho é a viagem');
});

/* O CHIP ACESO PINTA O FUNDO COM A COR DA CATEGORIA e escrevia por cima sempre
   em branco. Em "Demandas" (#0ca678) isso dá 3,1:1 — o nome sumia justamente
   no chip selecionado. Agora o texto é escolhido pelo contraste real. */
test('Agenda: o texto do chip aceso é escolhido pelo contraste, não fixo em branco', () => {
  const {run} = setup();
  const escuro = ['#e8590c', '#b8860b', '#0ca678'];   // brancos ilegíveis
  const claro  = ['#1f2b4d', '#5145a5', '#c92a2a', '#16334f'];
  for (const h of escuro) assert.equal(run(`corTextoSobre('${h}')`), '#20211f', h + ' precisa de texto escuro');
  for (const h of claro)  assert.equal(run(`corTextoSobre('${h}')`), '#fff',    h + ' precisa de texto branco');
  // e a cor calculada tem de chegar ao chip, não ficar só na função
  const {document} = (() => { const s = setup();
    s.run("atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
    return s; })();
  const chips = [...document.querySelectorAll('.agenda-categorias .ag-chip')];
  assert.ok(chips.every(c => /--cor-txt:/.test(c.getAttribute('style') || '')), 'o chip tem de levar a cor do texto');
});

/* ACHADOS DA REVISÃO ADVERSARIAL DO PRÓPRIO CONSERTO (16/09/2026). Duas lentes
   independentes acharam o mesmo defeito grave, e ele era meu. */
test('Agenda: o chip do mês aceso não pode escrever branco fixo', () => {
  const css = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  const regra = css.match(/\.ag-mes-chip\.on\{[^}]*\}/)[0];
  /* `--tinta` vale #eceae5 no tema escuro: fundo quase branco. Com `color:#fff`
     o mês selecionado dava 1,2:1 e sumia justamente por estar selecionado. */
  assert.ok(!/#fff/.test(regra), 'branco fixo sobre --tinta some no tema escuro');
  assert.match(regra, /color:var\(--card\)/, 'o texto tem de ser o inverso do fundo nos dois temas');
});

test('Agenda: a barra de data respeita a régua de dedo de 44px', () => {
  const css = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  /* `.ag-data .btn.mini` (0,3,0) vence o `.btn.mini{min-height:44px}` (0,2,0)
     do refinamento.css — dá para rebaixar o alvo de toque da navegação sem
     ninguém notar. A régua de dedo não mora em media query. */
  for (const sel of ['.ag-data .btn.mini', '.ag-data-nav']) {
    const regra = css.match(new RegExp(sel.replace(/[.\s]/g, m => m === ' ' ? '\\s' : '\\.') + '\\{[^}]*\\}'))[0];
    assert.match(regra, /min-height:44px/, sel + ' é navegação: 44px');
  }
});

test('Agenda: o 🗓️ leva o seletor de variação em todos os lugares', () => {
  const css = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
  /* Sem o U+FE0F o Unicode manda renderizar como glifo de TEXTO: sai
     monocromático e mais estreito que os outros dez ícones da mesma régua. */
  const soltos = [...css.matchAll(/\u{1F5D3}(?!\u{FE0F})/gu)];
  assert.equal(soltos.length, 0, 'ícone sem U+FE0F destoa dos vizinhos');
});

/* APAGAR DENTRO DO DIA ABERTO (pedido do dono, 16/09/2026). A mesma regra do
   bloco "Hoje": some só o que é DESTA Central. */
const abrirDia = (estado, iso) => {
  const {run, document} = setup();
  run("E.agenda=[];E.viagens=[];E.documentos=[];E.demandas=[];E.oportunidades=[];empresaDatasCache=null;" + estado);
  run(`const ev=eventosDoEcossistema().filter(e=>e.data<='${iso}'&&(e.ate||e.data)>='${iso}');modalDia('${iso}',ev)`);
  return {run, document};
};

test('Dia aberto: compromisso desta Central ganha o ✕ de apagar', () => {
  const {document} = abrirDia("E.agenda=[{id:'c1',titulo:'Reunião de Liderança',data:'2026-09-22',hora:'14:00'}];", '2026-09-22');
  const apagar = [...document.querySelectorAll('.fundo .acoes-dia button')]
    .filter(b => /Apagar/.test(b.getAttribute('aria-label') || ''));
  assert.equal(apagar.length, 1, 'o compromisso próprio precisa do ✕');
  assert.match(apagar[0].getAttribute('aria-label'), /Reunião de Liderança/);
});

test('Dia aberto: o que mora em outra tela NÃO ganha o ✕', () => {
  const {document} = abrirDia("E.viagens=[{id:'v1',destino:'Lisboa',ida:'2026-09-20',volta:'2026-09-25'}];", '2026-09-22');
  const linhas = [...document.querySelectorAll('.fundo .acoes-dia')];
  assert.ok(linhas.length, 'a viagem tem de aparecer no dia');
  const apagar = [...document.querySelectorAll('.fundo .acoes-dia button')]
    .filter(b => /Apagar/.test(b.getAttribute('aria-label') || ''));
  assert.equal(apagar.length, 0, 'apagar viagem daqui seria apagar pelas costas da tela dona');
});

test('Dia aberto: o ✕ tira da Central e não abre a ficha do que sumiu', () => {
  const {run, document} = abrirDia("E.agenda=[{id:'c1',titulo:'Mentoria',data:'2026-09-22'},{id:'c2',titulo:'Treino',data:'2026-09-22'}];", '2026-09-22');
  run("globalThis.confirm=()=>true");
  const bx = [...document.querySelectorAll('.fundo .acoes-dia button')]
    .find(b => /Apagar Mentoria/.test(b.getAttribute('aria-label') || ''));
  let subiu = false;
  bx.onclick({ stopPropagation: () => { subiu = true; } });
  assert.ok(subiu, 'o ✕ tem de comer o clique, senão a linha abre o que foi apagado');
  assert.deepEqual([...run("E.agenda.map(c=>c.titulo)")], ['Treino'], 'só a Mentoria sai');
  // e o subtítulo acompanha: contador que mente é pior que contador nenhum
  assert.match(document.querySelector('.fundo .modal header p').textContent, /1 coisa$/);
});

/* O resumo do dia, no alto. E a regra que o protege: apagar vale só para o que
   é DESTA Central. Viagem, documento e evento da empresa moram noutra tela ou
   noutro sistema — apagar daqui seria apagar pelas costas de quem é dono. */
const comAgenda = (estado = '') => {
  const {run, document} = setup();
  run("E.agenda=[];E.viagens=[];E.documentos=[];E.demandas=[];E.oportunidades=[];empresaDatasCache=null;" + estado);
  run("atual='agenda';const m=document.getElementById('main');m.replaceChildren();vAgenda(m);organizarAgenda(m)");
  return {run, document};
};

test('Hoje: o resumo do dia lista o que é de hoje, com hora', () => {
  const {run, document} = comAgenda("E.agenda=[{id:'a',data:hoje(),hora:'14:00',titulo:'Reunião de hoje'},{id:'b',data:'2099-01-01',titulo:'Lá longe'}]");
  const bloco = document.querySelector('[data-bid="ag-hoje"]');
  assert.ok(bloco, 'o resumo do dia não foi montado');
  /* PRIMEIRO da página, acima do calendário: achar o bloco em qualquer lugar
     não bastava — ele estava sendo varrido para dentro de uma aba e aparecia
     lá no fim. */
  assert.equal(bloco.closest('.agenda-pane'), null, 'o resumo do dia caiu dentro de uma aba');
  const cal = document.querySelector('[data-bid="ag-mes"]');
  assert.ok(bloco.compareDocumentPosition(cal) & 4, 'o resumo do dia ficou depois do calendário');
  const topo = document.querySelector('.topo');
  assert.ok(topo.compareDocumentPosition(bloco) & 4, 'o resumo do dia ficou antes do cabeçalho');
  const itens = [...bloco.querySelectorAll('.ag-hoje-item')];
  assert.equal(itens.length, 1, 'trouxe o que não é de hoje');
  assert.match(itens[0].textContent, /Reunião de hoje/);
  assert.match(itens[0].textContent, /14:00/);
});

test('Hoje: dá para apagar o compromisso próprio', () => {
  const {run, document} = comAgenda("E.agenda=[{id:'a',data:hoje(),titulo:'Sai fora'}]");
  run("confirm=()=>true");
  const bx = [...document.querySelectorAll('[data-bid="ag-hoje"] .acoes button')].find(b => b.textContent === '✕');
  assert.ok(bx, 'não há botão de apagar no resumo do dia');
  bx.click();
  assert.equal(run('E.agenda.length'), 0, 'o compromisso não foi apagado');
});

test('Hoje: apagar pergunta antes, e "não" não apaga', () => {
  const {run, document} = comAgenda("E.agenda=[{id:'a',data:hoje(),titulo:'Fica'}]");
  run("confirm=()=>false");
  [...document.querySelectorAll('[data-bid="ag-hoje"] .acoes button')].find(b => b.textContent === '✕').click();
  assert.equal(run('E.agenda.length'), 1, 'apagou sem confirmação');
});

test('Hoje: o que é de outra tela não ganha botão de apagar', () => {
  const {document} = comAgenda("E.documentos=[{id:'d',nome:'CNH',validade:hoje()}]");
  const item = document.querySelector('[data-bid="ag-hoje"] .ag-hoje-item');
  assert.ok(item, 'o documento vencendo não apareceu no dia');
  const botoes = [...item.querySelectorAll('.acoes button')].map(b => b.textContent);
  assert.ok(!botoes.includes('✕'), 'ofereceu apagar algo que mora noutra tela: ' + botoes.join(','));
  assert.ok(botoes.some(b => /Ver/.test(b)), 'devia levar até onde se resolve');
});

test('Agenda: o topo junta Google e + Novo compromisso na mesma linha', () => {
  const {document} = comAgenda();
  const acoes = document.querySelector('.topo .agenda-topo-acoes');
  assert.ok(acoes, 'a linha de ações do topo não existe');
  assert.ok(acoes.querySelector('.agenda-google'), 'a barra do Google não subiu para o topo');
  assert.match(acoes.textContent, /Novo compromisso/);
});
