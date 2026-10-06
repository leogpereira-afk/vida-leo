import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/dom.mjs';
const documento=(estado='disponivel')=>({chave:'doc_01',nome:'manual.txt',titulo:'Manual de operações',origem:'Diretoria',empresa:'Impresilk',dataBase:null,recebidoEm:'2026-10-06T14:00:00Z',estado,leitura:estado==='disponivel'?'texto_original':null,caracteres:estado==='disponivel'?120:0,observacoes:[]});
const arquivo=(nome='manual.txt',texto='Conhecimento autorizado.',tamanho)=>({name:nome,type:'text/plain',size:tamanho??Buffer.byteLength(texto),arrayBuffer:async()=>Uint8Array.from(Buffer.from(texto)).buffer});
function app(){const a=setup();const chamadas=[];a.ctx.apiTeste=async(m,b)=>{chamadas.push({m,b});return b.acao==='donboy_memoria_listar'?{documentos:[],proximoInicio:null}:{ok:true,duplicado:false,documento:documento(),telegram_enviado:false}};a.run('apiSync=apiTeste');return{...a,chamadas}}

test('selecionar arquivo não envia nem lê seu conteúdo antes do botão explícito',()=>{
 const a=app();let leu=false;a.ctx.arquivo=arquivo();a.ctx.arquivo.arrayBuffer=async()=>{leu=true;return new ArrayBuffer(1)};
 assert.equal(a.run('donboyMemoriaSelecionar(arquivo)'),true);assert.equal(leu,false);assert.equal(a.chamadas.length,0);
});
test('arquivo vazio, acima de 3 MiB ou formato não permitido não entra na memória',async()=>{
 const a=app();for(const f of [arquivo('vazio.txt',''),arquivo('grande.txt','x',3*1024*1024+1),arquivo('programa.exe','x'),arquivo('arquivo.zip','x')]){a.ctx.arquivo=f;assert.equal(a.run('donboyMemoriaSelecionar(arquivo)'),false)}
 await a.run('donboyMemoriaGuardar()');assert.equal(a.chamadas.length,0);
});
test('guardar envia base64 e metadados opcionais somente após ação explícita',async()=>{
 const a=app();a.ctx.arquivo=arquivo();a.run("donboyMemoriaSelecionar(arquivo);Object.assign(donboyMemoriaEstado,{titulo:'  Manual  ',origem:' Diretoria ',empresa:' Impresilk '})");
 await a.run('donboyMemoriaGuardar()');assert.equal(a.chamadas.length,1);const b=JSON.parse(JSON.stringify(a.chamadas[0].b));
 assert.deepEqual(b,{acao:'donboy_memoria_adicionar',nome:'manual.txt',mime:'text/plain',base64:Buffer.from('Conhecimento autorizado.').toString('base64'),titulo:'Manual',origem:'Diretoria',empresa:'Impresilk'});
 assert.equal(a.run('donboyMemoriaEstado.resultado.documento.estado'),'disponivel');assert.equal(a.run('donboyMemoriaEstado.arquivo'),null);
});
test('recebido não vira lido; revisão não é anunciada disponível para consulta',()=>{
 const a=app();for(const estado of ['recebido','revisao','falhou']){a.ctx.doc=documento(estado);const html=a.run('donboyMemoriaFonte(doc)');assert.doesNotMatch(html,/Disponível para consulta|Leitura concluída/)}
 a.ctx.doc=documento('recebido');assert.match(a.run('donboyMemoriaFonte(doc)'),/Recebido/);a.ctx.doc=documento('revisao');assert.match(a.run('donboyMemoriaFonte(doc)'),/Revisar leitura/);
});
test('duplo clique não cria envios concorrentes',async()=>{
 const a=app();let concluir;a.ctx.apiTeste=async(m,b)=>{a.chamadas.push({m,b});return await new Promise(r=>concluir=r)};a.ctx.arquivo=arquivo();a.run('apiSync=apiTeste;donboyMemoriaSelecionar(arquivo)');
 const primeiro=a.run('donboyMemoriaGuardar()');await a.run('donboyMemoriaGuardar()');await new Promise(r=>setImmediate(r));assert.equal(a.chamadas.length,1);concluir({ok:true,duplicado:false,documento:documento(),telegram_enviado:false});await primeiro;
});
test('falha sem resposta não alega que gravou; mantém arquivo para conferência',async()=>{
 const a=app();a.ctx.apiTeste=async()=>{throw Error('segredo interno')};a.ctx.arquivo=arquivo();a.run('apiSync=apiTeste;donboyMemoriaSelecionar(arquivo)');await a.run('donboyMemoriaGuardar()');
 assert.match(a.run('donboyMemoriaEstado.erroEnvio'),/Não foi possível confirmar/);assert.doesNotMatch(a.run('donboyMemoriaEstado.erroEnvio'),/segredo/);assert.notEqual(a.run('donboyMemoriaEstado.arquivo'),null);
});
test('resposta sem garantia de não envio ao Telegram é rejeitada',async()=>{
 const a=app();a.ctx.apiTeste=async()=>({ok:true,documento:documento()});a.ctx.arquivo=arquivo();a.run('apiSync=apiTeste;donboyMemoriaSelecionar(arquivo)');await a.run('donboyMemoriaGuardar()');assert.match(a.run('donboyMemoriaEstado.erroEnvio'),/Não foi possível confirmar/);
});
test('fontes paginadas vêm do servidor e não duplicam a mesma chave',async()=>{
 const a=app();let pagina=0;a.ctx.apiTeste=async(m,b)=>{a.chamadas.push({m,b});return pagina++?{documentos:[documento(),{...documento(),chave:'doc_02'}],proximoInicio:null}:{documentos:[documento()],proximoInicio:20}};a.run('apiSync=apiTeste');await a.run('donboyMemoriaListar()');await a.run('donboyMemoriaListar(true)');
 assert.deepEqual(a.chamadas.map(c=>JSON.parse(JSON.stringify(c.b))),[{acao:'donboy_memoria_listar',inicio:0,limite:20},{acao:'donboy_memoria_listar',inicio:20,limite:20}]);assert.equal(a.run('donboyMemoriaEstado.documentos.length'),2);
});
test('nome, observações e erro de arquivo não são interpretados como HTML',()=>{
 const a=app();a.ctx.doc={...documento('revisao'),nome:'<img src=x onerror=1>',titulo:'<script>mal</script>',observacoes:['<b>trecho ilegível</b>'],erro:'<svg onload=1>'};const html=a.run('donboyMemoriaFonte(doc)');assert.doesNotMatch(html,/<(?:img|script|svg|b)>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;b&gt;trecho/);
});

test('data de referência sem horário não muda de dia pelo fuso local',()=>{
 const a=app();assert.equal(a.run("donboyMemoriaData('2026-10-06')"),'06/10/2026');
});

test('abrir memória e selecionar arquivo não altera armazenamento persistente',async()=>{
 const a=app();let gravacoes=0;a.ctx.localStorage.setItem=()=>gravacoes++;a.ctx.sessionStorage.setItem=()=>gravacoes++;a.ctx.arquivo=arquivo();a.run('donboyMemoriaSelecionar(arquivo)');await a.run('donboyMemoriaListar()');assert.equal(gravacoes,0);
});

test('link só é enviado após ação explícita com assunto e empresa como contexto',async()=>{
 const a=app();a.run("Object.assign(donboyMemoriaEstado,{url:' https://example.com/referencia ',titulo:' Política ',assunto:' Regras de compras ',empresa:' Impresilk '})");await a.run('donboyMemoriaGuardarLink()');
 assert.equal(a.chamadas.length,1);assert.deepEqual(JSON.parse(JSON.stringify(a.chamadas[0].b)),{acao:'donboy_memoria_link',url:'https://example.com/referencia',titulo:'Política',assunto:'Regras de compras',empresa:'Impresilk'});
});
test('link inválido, com credenciais ou assunto excessivo é barrado antes da rede',async()=>{
 const a=app();for(const url of ['javascript:alert(1)','http://example.com/','https://user:senha@example.com/', 'https://example.com/'+ 'a'.repeat(2000)]){a.ctx.urlTeste=url;a.run('donboyMemoriaEstado.url=urlTeste');await a.run('donboyMemoriaGuardarLink()')}
 a.run("Object.assign(donboyMemoriaEstado,{url:'https://example.com/',assunto:'x'.repeat(501)})");await a.run('donboyMemoriaGuardarLink()');assert.equal(a.chamadas.length,0);
});
test('empresa acima do limite do proxy não é enviada',async()=>{
 const a=app();a.ctx.arquivo=arquivo();a.run("donboyMemoriaSelecionar(arquivo);donboyMemoriaEstado.empresa='x'.repeat(81)");await a.run('donboyMemoriaGuardar()');assert.equal(a.chamadas.length,0);
});
test('modalidade link explica a diferença entre fonte e conexão autenticada',()=>{
 const a=app();a.run("donboyMemoriaEstado.modo='link'");const card=a.run('donboyMemoriaCard(()=>{})');assert.match(card.textContent,/Colar um link não conecta uma conta/);assert.match(card.textContent,/Ler e guardar/);assert.equal(card.querySelector('input[type=file]'),null);assert.equal(card.querySelector('[name=assunto]').maxLength??card.querySelector('[name=assunto]').getAttribute('maxlength'),'500');
});
