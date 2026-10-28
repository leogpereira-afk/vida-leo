import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const coletadoEm='2026-10-28T19:40:00Z';
const ids=['ga4','search','perfil','instagram','google_ads','meta_ads'];
const contatos=()=>({inicioMedicao:'2026-10-28',coletadoEm,estado:'ok',periodo:{inicio:'2026-10-28',fim:'2026-10-28',metricas:{whatsapp:4,telefone:2,email:0}}});
function montar(c,empresa='minaslab'){
 const detalhe={versao:1,fontes:ids.map(id=>({id,nome:id,estado:'ok',coletadoEm,identidade:'Site de teste',avisos:[],atrasado:false,periodos:[{id:'atual',inicio:'2026-09-28',fim:'2026-10-25',completo:true,metricas:{usuarios:15,cliques_whatsapp:null},tabelas:{},serie:[]},{id:'anterior',inicio:'2026-08-31',fim:'2026-09-27',completo:true,metricas:{usuarios:10,cliques_whatsapp:null},tabelas:{},serie:[]}],...(id==='ga4'&&c?{contatos:c}:{})})),administracao:{fontes:Object.fromEntries(ids.map(id=>[id,{situacao:'localizado'}]))}};
 const {document}=parseHTML('<main></main>');
 const context=vm.createContext({Date,document,console});
 vm.runInContext(readFileSync(new URL('../publico/marketing-fortemais.js',import.meta.url),'utf8'),context);
 context.LeoFortemaisMarketing.montar(document.querySelector('main'),{detalhe,empresa,api:async()=>({ok:true})});
 const abrir=aba=>document.querySelector('.fmkt-tabs [data-aba="'+aba+'"]').click();
 return {document,abrir};
}

test('Contatos UI: canais separados, WhatsApp destacado e período recente identificado',()=>{
 const {document,abrir}=montar(contatos());
 assert.equal(document.querySelector('.fmkt-contatos'),null,'Visão geral permanece compacta');
 abrir('ga4');
 const bloco=document.querySelector('.fmkt-contatos');
 assert.ok(bloco);
 assert.equal(bloco.querySelectorAll('[data-contato]').length,3);
 assert.equal(bloco.querySelector('[data-contato=whatsapp] strong').textContent,'4');
 assert.match(bloco.querySelector('[data-contato=whatsapp]').getAttribute('style'),/canal-fundo/);
 assert.equal(bloco.querySelector('[data-contato=telefone] strong').textContent,'2');
 assert.equal(bloco.querySelector('[data-contato=email] strong').textContent,'0');
 assert.match(bloco.textContent,/Período recente: 28\/10\/2026 a 28\/10\/2026/);
 assert.match(bloco.textContent,/Separação por canal desde 28\/10\/2026/);
 assert.match(bloco.textContent,/Coleta: 28\/10\/2026/);
 assert.match(bloco.textContent,/Dados recentes, sujeitos a processamento/);
 assert.match(bloco.textContent,/não mensagens enviadas ou conversas concluídas/);
 assert.match(bloco.textContent,/históricos agrupados não podem ser separados/);
 assert.match(document.querySelector('.fmkt-extra').textContent,/Cliques no WhatsApp—Aguardando separação por canal/);
});

test('Contatos UI: não transforma ausentes em zero e explica processamento',()=>{
 const c=contatos();c.estado='aguardando_dados';c.periodo.metricas={whatsapp:null,email:0};
 const {document,abrir}=montar(c);abrir('ga4');
 const bloco=document.querySelector('.fmkt-contatos');
 assert.equal(bloco.querySelector('[data-contato=whatsapp] strong').textContent,'—');
 assert.equal(bloco.querySelector('[data-contato=telefone] strong').textContent,'—');
 assert.equal(bloco.querySelector('[data-contato=email] strong').textContent,'0');
 assert.match(bloco.textContent,/24 a 48 horas/);
 assert.match(bloco.textContent,/Aguardando processamento/);
});

test('Contatos UI: configuração pendente e falha de coleta não exibem contagem como confirmada',()=>{
 for(const estado of ['aguardando_configuracao','erro']){
  const c={...contatos(),estado};const {document,abrir}=montar(c);abrir('ga4');
  const bloco=document.querySelector('.fmkt-contatos');
  assert.ok([...bloco.querySelectorAll('[data-contato] strong')].every(x=>x.textContent==='—'));
  assert.match(bloco.textContent,estado==='erro'?/Não foi possível atualizar/:/precisa ser configurada/);
 }
});

test('Contatos UI: falha com última leitura confirmada preserva números e identifica data original',()=>{
 const c={...contatos(),estado:'erro',ultimaLeituraConfirmada:true,coletadoEm:'2026-10-28T16:00:00Z'};
 const {document,abrir}=montar(c);abrir('ga4');
 const bloco=document.querySelector('.fmkt-contatos');
 assert.equal(bloco.querySelector('[data-contato=whatsapp] strong').textContent,'4');
 assert.equal(bloco.querySelector('[data-contato=email] strong').textContent,'0');
 assert.match(bloco.textContent,/Última leitura preservada/);
 assert.match(bloco.textContent,/A atualização falhou/);
 assert.match(bloco.textContent,/data de coleta original/);
 assert.match(bloco.textContent,/28\/10\/2026, 13:00:00/);
});

test('Contatos UI: pendências preservam leitura confirmada com data e explicação do estado atual',()=>{
 for(const estado of ['aguardando_dados','aguardando_configuracao']){
  const c={...contatos(),estado,ultimaLeituraConfirmada:true,coletadoEm:'2026-10-28T15:00:00Z'};
  const {document,abrir}=montar(c);abrir('ga4');
  const bloco=document.querySelector('.fmkt-contatos');
  assert.equal(bloco.querySelector('[data-contato=whatsapp] strong').textContent,'4');
  assert.equal(bloco.querySelector('[data-contato=email] strong').textContent,'0');
  assert.match(bloco.textContent,/Última leitura preservada/);
  assert.match(bloco.textContent,/data de coleta original/);
  assert.match(bloco.textContent,/28\/10\/2026, 12:00:00/);
  assert.match(bloco.textContent,estado==='aguardando_dados'?/24 a 48 horas/:/configuração.*Google Analytics/);
  assert.doesNotMatch(bloco.textContent,/Leitura por canal/);
 }
});

test('Contatos UI: marcas sem dados de contatos preservam visual e legenda anteriores',()=>{
 for(const empresa of ['minaslab','fortemais','domo']){
  const {document,abrir}=montar(undefined,empresa);abrir('ga4');
  assert.equal(document.querySelector('.fmkt-contatos'),null);
  assert.match(document.querySelector('.fmkt-extra').textContent,/Cliques no WhatsApp—Não disponibilizado/);
  assert.doesNotMatch(document.querySelector('main').textContent,/Aguardando separação por canal/);
 }
});

test('Contatos UI: mudar período consolidado não mistura nem soma intervalo recente',()=>{
 const {document,abrir}=montar(contatos());abrir('ga4');
 const select=document.querySelector('[data-periodo=ga4]');
 select.querySelector('[value=atual]').removeAttribute('selected');
 select.querySelector('[value=anterior]').setAttribute('selected','');
 select.onchange();
 const bloco=document.querySelector('.fmkt-contatos');
 assert.match(document.querySelector('.fmkt-periodo').textContent,/31\/08\/2026 a 27\/09\/2026/);
 assert.match(bloco.textContent,/Período recente: 28\/10\/2026 a 28\/10\/2026/);
 assert.equal(bloco.querySelector('[data-contato=whatsapp] strong').textContent,'4');
});

test('Contatos UI: texto externo e números inválidos não viram HTML ou métricas',()=>{
 const c=contatos();c.inicioMedicao='<img src=x onerror=alert(1)>';c.coletadoEm=c.inicioMedicao;c.estado=c.inicioMedicao;c.periodo.metricas.whatsapp='<img src=x onerror=alert(1)>';
 const {document,abrir}=montar(c);abrir('ga4');
 assert.equal(document.querySelector('img[onerror]'),null);
 assert.equal(document.querySelector('[data-contato=whatsapp] strong').textContent,'—');
 assert.match(document.querySelector('.fmkt-contatos').textContent,/Aguardando confirmação/);
});

test('Meta Ads UI: esclarece atribuição dos anúncios e duplicidade entre fontes',()=>{
 const {document,abrir}=montar(contatos());abrir('anuncios');
 const texto=document.querySelector('[data-canal=meta_ads]').textContent;
 assert.match(texto,/atribuídos aos anúncios/);
 assert.match(texto,/não representam o total de eventos recebidos pelo Pixel/);
 assert.match(texto,/Google e Meta podem registrar o mesmo clique: não some suas contagens/);
 assert.equal(document.querySelector('.fmkt-contatos'),null);
});
