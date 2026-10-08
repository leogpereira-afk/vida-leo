import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const painel=()=>({versao:'2026.10.06-versao-longa-de-implantacao-informada',consultadoEm:'2026-10-07T15:00:00Z',inteligencia:{modelo:'gpt-6-luna',provedor:'openai',esforco:'max'},capacidades:[],ultimosTurnos:[],pendentes:[],custos:{mes:'2026-10',openai:{custoUsd:0.1,chamadas:1},claude:{custoUsd:0,chamadas:0}}});
async function carregar(d=painel()){
 const a=setup(),calls=[];a.ctx.apiTeste=async(_method,body)=>{calls.push(body);return body.acao==='donboy_memoria_listar'?{documentos:[],proximoInicio:null}:d};a.run('apiSync=apiTeste');await a.run("vDonBoy(document.getElementById('main'))");return {...a,calls};
}
const abrir=(a,aba)=>a.document.getElementById('db-aba-'+aba).onclick();

test('Comando abre primeiro e só um dos sete painéis fica visível',async()=>{
 const a=await carregar(),tabs=a.document.querySelectorAll('[role=tab]'),panels=a.document.querySelectorAll('[role=tabpanel]');
 assert.equal(tabs.length,7);assert.equal(panels.length,7);assert.equal([...panels].filter(p=>!p.hidden).length,1);
 assert.equal(a.document.getElementById('db-painel-comando').hidden,false);assert.equal(a.document.getElementById('db-painel-memoria').hidden,true);
 assert.equal(a.document.querySelector('.db-versao').closest('[role=tabpanel]').id,'db-painel-inteligencia');
 assert.deepEqual(a.calls.map(c=>c.acao),['donboy_painel']);
 for(const tab of tabs)assert.equal(a.document.getElementById(tab.getAttribute('aria-controls')).getAttribute('aria-labelledby'),tab.id);
});

test('chips só navegam: não executam consulta de IA nem escrita e preservam rascunhos',async()=>{
 const a=await carregar();const campo=a.document.getElementById('db-comando');campo.value='Meu pedido incompleto';campo.oninput();
 for(const aba of ['ambientes','conexoes','inteligencia','automacoes','atividade','comando'])await abrir(a,aba);
 assert.deepEqual(a.calls.map(c=>c.acao),['donboy_painel','donboy_email_status']);assert.equal(a.document.getElementById('db-comando').value,'Meu pedido incompleto');
 assert.equal(a.run('donboyPainelEstado.comando'),'Meu pedido incompleto');assert.equal(a.document.querySelectorAll('[aria-selected=true]').length,1);
});

test('memória carrega uma vez ao abrir e conserva arquivo e metadados ao navegar',async()=>{
 const a=await carregar();a.ctx.arquivo={name:'fonte.txt',size:10,type:'text/plain'};a.run("donboyMemoriaSelecionar(arquivo);donboyMemoriaEstado.titulo='Minha referência';donboyMemoriaEstado.url='https://exemplo.test/fonte'");
 await abrir(a,'memoria');await abrir(a,'comando');await abrir(a,'memoria');
 assert.deepEqual(a.calls.map(c=>c.acao),['donboy_painel','donboy_memoria_listar']);
 assert.equal(a.run('donboyMemoriaEstado.arquivo.name'),'fonte.txt');assert.equal(a.run('donboyMemoriaEstado.titulo'),'Minha referência');assert.equal(a.run('donboyMemoriaEstado.url'),'https://exemplo.test/fonte');
 assert.equal(a.document.getElementById('db-painel-memoria').hidden,false);
});

test('exemplo de ambiente prepara o texto e abre Comando sem executar',async()=>{
 const a=await carregar();await abrir(a,'ambientes');const b=a.document.querySelector('#db-painel-ambientes [data-donboy-exemplo]');const texto=b.dataset.donboyExemplo;
 await b.onclick();assert.equal(a.run('donboyPainelEstado.aba'),'comando');assert.equal(a.document.getElementById('db-comando').value,texto);
 assert.deepEqual(a.calls.map(c=>c.acao),['donboy_painel']);assert.match(a.document.getElementById('db-painel-ambientes').textContent,/não muda permissões nem comprova a conexão/);
});

test('setas Home e End movem foco sem executar nem ativar outra aba',async()=>{
 const a=await carregar();let foco='',prevented=0;const tabs=[...a.document.querySelectorAll('[role=tab]')];for(const t of tabs)t.focus=()=>{foco=t.id};
 tabs[0].onkeydown({key:'ArrowRight',preventDefault(){prevented++}});assert.equal(foco,'db-aba-ambientes');assert.equal(a.run('donboyPainelEstado.aba'),'comando');
 tabs[1].onkeydown({key:'End',preventDefault(){prevented++}});assert.equal(foco,'db-aba-atividade');
 tabs[6].onkeydown({key:'Home',preventDefault(){prevented++}});assert.equal(foco,'db-aba-comando');
 assert.equal(prevented,3);assert.equal(tabs.filter(t=>t.getAttribute('tabindex')==='0').length,1);assert.equal(a.calls.length,1);
});

test('erro de atualização preserva aba e valores anteriores sem alegar dados novos',async()=>{
 const a=await carregar();await abrir(a,'inteligencia');a.ctx.apiTeste=async()=>{throw Error('offline')};a.run('apiSync=apiTeste');await a.document.getElementById('db-atualizar').onclick();
 assert.equal(a.document.getElementById('db-painel-inteligencia').hidden,false);assert.equal(a.document.getElementById('db-aba-inteligencia').getAttribute('aria-selected'),'true');
 assert.match(a.document.querySelector('[data-donboy-status]').textContent,/última consulta bem-sucedida/);
 assert.match(a.document.querySelector('[data-donboy-custo-openai]').textContent,/0,10/);
});

test('métricas explicitam amostra e não confundem resposta entregue com pedido concluído',async()=>{
 const d=painel();d.ultimosTurnos=[{estado:'entregue',conclusao:'parcial'},{estado:'falhou'},{estado:'entrega_incerta'},{estado:'entregue',conclusao:'evidencias_disponiveis'}];d.pendentes=[{id:1,tipo:'email',estado:'pendente'}];
 const a=await carregar(d);assert.deepEqual(JSON.parse(a.run('JSON.stringify(donboyMetricas(donboyPainelEstado.dados))')),{amostra:4,falhas:2,parciais:1,pendentes:1});
 assert.match(a.document.querySelector('.db-amostra').textContent,/4 pedidos recentes/);assert.match(a.document.querySelector('.db-amostra').textContent,/não representa todo o histórico/);
 assert.deepEqual(JSON.parse(a.run('JSON.stringify(donboyMetricas(null))')),{amostra:null,falhas:null,parciais:null,pendentes:null});
});

test('automações não inventam atividade e estados desconhecidos permanecem desconhecidos',async()=>{
 const a=await carregar();assert.match(a.document.getElementById('db-painel-automacoes').textContent,/Situação não informada pelo servidor/);
 const html=a.run("donboyAutomacoes({automacoes:[null,{nome:'Agenda',estado:'nao_verificado'},{nome:'E-mail',estado:'inativo'},{nome:'Estranha',estado:'__proto__'}]})");
 assert.match(html,/Não verificada/);assert.match(html,/Inativa/);assert.match(html,/Situação não informada/);assert.doesNotMatch(html,/\[object Object\]/);
});

test('preferências vêm do servidor, são somente leitura e escapam conteúdo',async()=>{
 const d=painel();d.preferencias=[{chave:'extensao',rotulo:'Extensão',valor:'curta',origem:'pedido_confirmado'},null,{chave:'formato',rotulo:'<img src=x>',valor:'padrao',origem:'padrao'}];
 const a=await carregar(d);const p=a.document.getElementById('db-painel-inteligencia');assert.match(p.textContent,/Curta/);assert.match(p.textContent,/Pedido confirmado por você/);assert.match(p.textContent,/Padrão do assistente/);assert.equal(p.querySelectorAll('input,select,textarea').length,0);assert.equal(p.querySelectorAll('img').length,0);
 assert.match(a.run("donboyPreferencias({preferencias:[],preferenciasEstado:'indisponivel'})"),/Não foi possível consultar/);
});
