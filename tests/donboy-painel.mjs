import test from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/dom.mjs';

test('DON BOY aparece logo após Início como tela interna',()=>{
 const {run}=setup();
 assert.deepEqual(JSON.parse(run('JSON.stringify(MODS.slice(0,3).map(m=>m.id))')),['inicio','donboy','agenda']);
 assert.equal(run("MODS.find(m=>m.id==='donboy')?.url"),undefined);
});

test('abrir painel só consulta status e não dispara comando de teste ou gravação',async()=>{
 const {ctx,run,document}=setup(); const calls=[];
 ctx.apiTeste=async(method,body)=>{calls.push({method,body});if(body.acao==='donboy_memoria_listar')return {documentos:[],proximoInicio:null};return {versao:'93',inteligencia:{modelo:'gpt-6-luna',esforco:'max'},capacidades:[],ultimosTurnos:[],pendentes:[],custos:{mes:'2026-10',moeda:'USD',openai:{custoUsd:0.12,chamadas:4},claude:{custoUsd:0.03,chamadas:1}}};};
 run('apiSync=apiTeste'); assert.equal(run('typeof vDonBoy'),'function');
 await run("vDonBoy(document.getElementById('main'))");
 assert.equal(calls.length,2); assert.deepEqual(JSON.parse(JSON.stringify(calls.map(c=>c.body))),[{acao:'donboy_painel'},{acao:'donboy_memoria_listar',inicio:0,limite:20}]);
 assert.match(document.getElementById('main').textContent,/DON BOY/);
 assert.equal(document.querySelector('[data-donboy-teste] button[type=submit]').disabled,false);
});

test('falha de conexão não apresenta sucesso nem custos zero inventados',async()=>{
 const {ctx,run,document}=setup(); ctx.apiTeste=async()=>{throw Error('HTTP 502')}; run('apiSync=apiTeste');
 assert.equal(run('typeof vDonBoy'),'function'); await run("vDonBoy(document.getElementById('main'))");
 assert.match(document.querySelector('[data-donboy-status]').textContent,/Não foi possível/);
 assert.equal(document.querySelector('[data-donboy-custo-openai]'),null);
});

const painel=()=>({versao:'2026.10.06-drive-painel-1',consultadoEm:'2026-10-06T14:00:00Z',inteligencia:{modelo:'gpt-6-luna',esforco:'max',provedor:'openai'},capacidades:[{id:'google_drive',nome:'Google Drive',configuracao:'implementada',modo:'busca_e_entrega_sob_pedido',faz:'Busca arquivos e pastas.',verificacao:'nao_testada_nesta_consulta'}],ultimosTurnos:[],pendentes:[],custos:{mes:'2026-10',moeda:'USD',openai:{custoUsd:0.12,chamadas:4},claude:{custoUsd:0.03,chamadas:1},desconhecido:{custoUsd:0,chamadas:0}},limites:{referenciaBrl:200,tetoAutomatico:false}});
async function carregar(dados=painel()){
 const app=setup();app.ctx.apiTeste=async(_m,b)=>b.acao==='donboy_memoria_listar'?{documentos:[],proximoInicio:null}:dados;app.run('apiSync=apiTeste');await app.run("vDonBoy(document.getElementById('main'))");return app;
}

test('modelo e raciocínio vêm do servidor; custos OpenAI e Claude ficam separados',async()=>{
 const {document}=await carregar();const main=document.getElementById('main');
 assert.match(main.textContent,/gpt-6-luna/);assert.match(main.textContent,/Máximo/);
 assert.match(main.querySelector('[data-donboy-custo-openai]').textContent,/0,12/);assert.match(main.querySelector('[data-donboy-custo-claude]').textContent,/0,03/);
 assert.match(main.textContent,/não há bloqueio automático por orçamento/);
});

test('função implementada não aparece como conexão testada',async()=>{
 const {document}=await carregar();const card=document.querySelector('.db-conexao');
 assert.match(card.textContent,/Recurso implementado/);assert.match(card.textContent,/Não testada nesta consulta/);
 assert.doesNotMatch(card.textContent,/nao_testada_nesta_consulta|busca_e_entrega_sob_pedido/);
});

test('preparar arquivo não equivale a enviar; só recibo com messageId confirma anexo',async()=>{
 const d=painel();d.ultimosTurnos=[{id:5,estado:'entregue',iniciado_em:'2026-10-06T12:00:00Z',consultas:['drive_arquivo: contrato.pdf']},{id:4,estado:'entregue',consultas:['telegram_anexo_confirmado: {"nome":"Contrato.pdf","bytes":1200,"messageId":42}']},{id:3,estado:'entregue',consultas:['telegram_anexo_confirmado: {"nome":"Invalido.pdf","bytes":1200}']}];
 const {document}=await carregar(d);const rows=document.querySelectorAll('.db-atividade>li');
 assert.match(rows[0].textContent,/Sem comprovante/);assert.match(rows[1].textContent,/1 anexo com envio confirmado/);assert.match(rows[2].textContent,/Sem comprovante/);
});

test('texto vindo de respostas, nomes e falhas nunca vira HTML executável',async()=>{
 const d=painel();d.inteligencia.modelo='<img src=x onerror=alert(1)>';d.ultimosTurnos=[{id:1,estado:'falhou',erro:'<script>alert(1)</script>',consultas:[]}];
 const {document,run}=await carregar(d);
 assert.equal(document.querySelector('.donboy-layout img'),null);assert.equal(document.querySelector('.donboy-layout script'),null);
 assert.match(run("donboyResultadoTeste({texto:'<img src=x onerror=1>',anexos:[{nome:'<script>',bytes:1}]})"),/&lt;img/);
});

test('teste envia somente comando de consulta e exige confirmação de somente leitura',async()=>{
 const {ctx,run}=await carregar();const calls=[];ctx.apiTeste=async(m,b)=>{calls.push({m,b});return {somente_leitura:true,telegram_enviado:false,texto:'Arquivo localizado.',anexos:[{nome:'Contrato.pdf',bytes:100}],consultas:[]}};run('apiSync=apiTeste');
 await run("donboyTestar('  procure contrato SP LG  ')");
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{m:'POST',b:{acao:'donboy_testar',comando:'procure contrato SP LG'}}]);
 assert.match(run('donboyResultadoTeste(donboyPainelEstado.teste)'),/não foram enviados/);
 ctx.apiTeste=async()=>({texto:'feito',telegram_enviado:true});run('apiSync=apiTeste');await run("donboyTestar('consulta')");
 assert.match(run('donboyPainelEstado.teste.erro'),/somente leitura/);
});

test('teste vazio ou grande é rejeitado sem chamar o servidor',async()=>{
 const {ctx,run}=await carregar();let chamadas=0;ctx.apiTeste=async()=>{chamadas++;return {}};run('apiSync=apiTeste');
 await run("donboyTestar('  ')");await run("donboyTestar('x'.repeat(1501))");assert.equal(chamadas,0);
});

test('falha ao atualizar mantém valores anteriores com aviso explícito',async()=>{
 const {ctx,run,document}=await carregar();ctx.apiTeste=async()=>{throw Error('offline')};run('apiSync=apiTeste');await run('donboyAtualizar()');run("document.getElementById('main').replaceChildren()");await run("vDonBoy(document.getElementById('main'))");
 assert.match(document.querySelector('[data-donboy-status]').textContent,/última consulta bem-sucedida/);assert.match(document.querySelector('[data-donboy-custo-openai]').textContent,/0,12/);
});

test('Telegram não aceita destino arbitrário nem credencial em URL',()=>{
 const {run}=setup();for(const url of ['javascript:alert(1)','https://evil.example/a','https://t.me.evil.example/bot','https://user:pass@t.me/meubot','https://t.me/+invite'])assert.equal(run('donboyTelegram('+JSON.stringify(url)+')'),'');
 assert.equal(run("donboyTelegram('https://t.me/donboy_bot')"),'https://t.me/donboy_bot');
});

test('sem valores de consumo, mostra ausência de informação em vez de zero',async()=>{
 const d=painel();d.custos={mes:'2026-10',moeda:'USD'};const {document}=await carregar(d);
 assert.match(document.querySelector('[data-donboy-custo-openai]').textContent,/Não informado/);
 assert.doesNotMatch(document.querySelector('[data-donboy-custo-openai]').textContent,/0,00/);
});

test('observação de limites do servidor aparece sem interpretar HTML',async()=>{
 const d=painel();d.limites.observacao='Referência <b>mensal</b> sujeita ao consumo.';const {document}=await carregar(d);
 const nota=document.querySelector('[data-donboy-limites]');assert.ok(nota);assert.equal(nota.textContent,d.limites.observacao);assert.equal(nota.querySelector('b'),null);
});
