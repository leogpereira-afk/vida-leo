import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
function app({nuvem=[],locais=[],falha=false}={}){
  const a=setup(),storage=new Map();a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  for(const nome of ['fortemais-documentos-modelo.js','fortemais-documentos.js']){const caminho=new URL('../publico/'+nome,import.meta.url);if(existsSync(caminho)&&a.run('typeof '+(nome.includes('modelo')?'FortemaisDocumentosModelo':'fmDocumentosPainel'))==='undefined')vm.runInContext(readFileSync(caminho,'utf8'),a.ctx);}
  assert.equal(a.run('typeof fmDocumentosPainel'),'function','Painel de documentos disponível');
  a.ctx.mockNuvem=nuvem;a.ctx.mockLocais=locais;a.ctx.falhaNuvem=falha;
  a.run(`E=structuredClone(SEED);var obra={id:'o',nome:'Obra sintética'};E.obras=[obra];tela=()=>{};arqEsquecerIndice=()=>{};arqIndice=async()=>falhaNuvem?null:new Map(mockNuvem.map(a=>[a.ref,mockNuvem.filter(x=>x.ref===a.ref)]));todosArquivos=async()=>mockLocais;arqPorLocal=async id=>mockLocais.find(a=>a.id===id)||null;var painel=fmDocumentosPainel(obra);document.getElementById('main').appendChild(painel)`);
  return {...a,storage};
}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const arquivo=(id='a',ref='obra:o',tipo='application/pdf')=>({id,ref,nome:'Projeto '+id+'.pdf',tipo,tam:123,em:'2026-10-14'});
const botao=(a,texto)=>[...a.document.querySelectorAll('button')].find(b=>b.textContent===texto);
function preencher(a,nome,valor){const campo=a.document.querySelector('[name='+nome+']');assert.ok(campo,nome);campo.value=valor;campo.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}));}
function enviar(a){const form=a.document.querySelector('.fmdoc-editor');assert.ok(form);form.onsubmit({preventDefault(){}});}

test('Documentos: leitura agregada preserva origens e não confunde obras',async()=>{
  const a=app({nuvem:[arquivo(),arquivo('b','obra:o:demanda:d'),arquivo('fora','obra:outro')],locais:[{...arquivo(),blob:'local'},{...arquivo('c'),blob:'fila'}]});
  assert.match(a.run('painel.textContent'),/Carregando/);await tick();
  assert.equal(a.document.querySelectorAll('.fmdoc-item').length,3);assert.match(a.run('painel.textContent'),/Demanda/);assert.match(a.run('painel.textContent'),/neste aparelho/i);
});
test('Documentos: indisponibilidade remota mostra falha e mantém anexos locais',async()=>{
  const a=app({falha:true,locais:[{...arquivo('c'),blob:'fila'}]});await tick();
  assert.match(a.run('painel.textContent'),/não.*conferir.*nuvem/i);assert.doesNotMatch(a.run('painel.textContent'),/Nenhum arquivo/);assert.equal(a.document.querySelectorAll('.fmdoc-item').length,1);
});
test('Documentos: recategorizar salva localmente sem chamar upload e arquivamento é reversível',async()=>{
  const a=app({nuvem:[arquivo()]});a.run('arqAdd=()=>{throw Error("Upload não deve ocorrer")};arqDel=()=>{throw Error("Exclusão não deve ocorrer")}');await tick();
  botao(a,'Classificar').click();preencher(a,'categoria','Estrutural');preencher(a,'titulo','Fundação');enviar(a);await tick();
  assert.equal(a.run('obra.fmArquivosMetadados.a.categoria'),'Estrutural');assert.equal(a.run('painel._fmDirty'),false);assert.match(a.run('painel.textContent'),/neste navegador.*sincroniza/i);
  botao(a,'Arquivar').click();await tick();assert.equal(a.run('obra.fmArquivosMetadados.a.arquivado'),true);
  botao(a,'Arquivados').click();await tick();botao(a,'Desarquivar').click();await tick();assert.equal(a.run('obra.fmArquivosMetadados.a.arquivado'),false);
});
test('Documentos: falha de salvamento restaura o mapa e preserva rascunho',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();botao(a,'Classificar').click();preencher(a,'titulo','Rascunho conservado');
  a.ctx.localStorage.setItem=()=>{throw Error('quota')};enviar(a);
  assert.equal(a.run('obra.fmArquivosMetadados'),undefined);assert.equal(a.document.querySelector('[name=titulo]').value,'Rascunho conservado');assert.match(a.document.querySelector('.fmdoc-editor [role=alert]').textContent,/Não foi possível salvar/);assert.equal(a.run('painel._fmDirty'),true);
});
test('Documentos: conflito na edição preserva metadados recebidos e rascunho',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();botao(a,'Classificar').click();preencher(a,'titulo','Meu rascunho');a.run("obra.fmArquivosMetadados={a:{titulo:'Outro acesso'}}");enviar(a);
  assert.equal(a.run('obra.fmArquivosMetadados.a.titulo'),'Outro acesso');assert.equal(a.document.querySelector('[name=titulo]').value,'Meu rascunho');assert.match(a.document.querySelector('.fmdoc-editor [role=alert]').textContent,/atualizad|mudaram/);
});
test('Documentos: HTML e SVG oferecem somente baixar e nomes são texto literal',async()=>{
  const a=app({nuvem:[{...arquivo('a','obra:o','text/html'),nome:'<img src=x> arquivo.html'},arquivo('b','obra:o','image/svg+xml'),arquivo('c')]});await tick();
  assert.equal(a.document.querySelectorAll('.fmdoc-item .fmdoc-abrir').length,1);assert.equal(a.document.querySelectorAll('.fmdoc-item .fmdoc-baixar').length,3);assert.equal(a.document.querySelector('.fmdoc-item img'),null);assert.match(a.run('painel.textContent'),/<img src=x>/);
});
test('Documentos: upload usa referência canônica e falha de classificação deixa arquivo visível',async()=>{
  const a=app();await tick();preencher(a,'categoriaUpload','Estrutural');a.ctx.file={name:'Novo.pdf',type:'application/pdf',size:12};
  a.run(`var refEnviada='';arqAdd=async(ref,file)=>{refEnviada=ref;const r={id:'novo',ref,nome:file.name,tipo:file.type,tam:file.size,em:'2026-10-14'};mockNuvem.push(r);return r};`);
  a.ctx.localStorage.setItem=()=>{throw Error('quota')};const input=a.document.querySelector('[name=arquivos]');Object.defineProperty(input,'files',{value:[a.ctx.file]});input.onchange();await tick();
  assert.equal(a.run('refEnviada'),'obra:o');assert.equal(a.run('obra.fmArquivosMetadados'),undefined);assert.match(a.run('painel.textContent'),/sem categoria/i);assert.equal(a.document.querySelectorAll('.fmdoc-item').length,1);
});
test('Documentos: índice PDF recebe só a visão atual com metadados e disponibilidade',async()=>{
  const a=app({nuvem:[arquivo(),arquivo('b')]});a.run("obra.fmArquivosMetadados={a:{categoria:'Estrutural',titulo:'Fundação'}};var pdf=null;fmPdfDocumentos=(o,rows,opts)=>{pdf={obra:o.id,rows,opts}}");await tick();botao(a,'Estrutural').click();botao(a,'Índice em PDF').click();
  assert.equal(a.run('pdf.obra'),'o');assert.equal(a.run('pdf.rows.length'),1);assert.equal(a.run('pdf.rows[0].id'),'a');assert.equal(a.run('pdf.rows[0].meta.titulo'),'Fundação');assert.equal(a.run('pdf.opts.nuvemDisponivel'),true);
});
test('Documentos: atualizar durante edição conserva o rascunho e a marca de alteração',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();botao(a,'Classificar').click();preencher(a,'descricao','Conferir estrutura');await a.run('painel.atualizar()');
  assert.equal(a.document.querySelector('[name=descricao]').value,'Conferir estrutura');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.run('painel.textContent'),/Salve ou cancele/);
});
test('Documentos: indisponibilidade não remove classificação de arquivos ausentes no índice',async()=>{
  const a=app({falha:true});a.run("obra.fmArquivosMetadados={antigo:{titulo:'Registro preservado',arquivado:true}}");await tick();await a.run('painel.atualizar()');
  assert.equal(a.run('obra.fmArquivosMetadados.antigo.titulo'),'Registro preservado');assert.equal(a.run('obra.fmArquivosMetadados.antigo.arquivado'),true);
});
test('Documentos: upload acima de 25 MiB é recusado pelo serviço antes de persistir',async()=>{
  const a=app();await tick();a.ctx.file={name:'Grande.pdf',type:'application/pdf',size:25*1024*1024+1};const input=a.document.querySelector('[name=arquivos]');Object.defineProperty(input,'files',{value:[a.ctx.file]});input.onchange();await tick();
  assert.equal(a.document.querySelectorAll('.fmdoc-item').length,0);assert.match(a.run('painel.textContent'),/limite é 25 MB/);assert.equal(a.run('obra.fmArquivosMetadados'),undefined);assert.equal(a.run('painel._fmDirty'),false);
});
test('Documentos: exportar pela barra utiliza a visão filtrada e avisa quando a lista não está pronta',async()=>{
  const a=app({nuvem:[arquivo(),arquivo('b')]});a.run("obra.fmArquivosMetadados={a:{categoria:'Estrutural',titulo:'Fundação'}};var pdf=null;fmPdfDocumentos=(o,rows,opts)=>{pdf={obra:o.id,rows,opts}}");
  assert.equal(a.run('typeof painel.exportar'),'function');a.run('painel.exportar()');assert.equal(a.run('pdf'),null);assert.match(a.run('painel.textContent'),/carregando|aguarde/i);
  await tick();botao(a,'Estrutural').click();const buscaAtual=a.document.querySelector('[aria-label="Buscar documentos"]');buscaAtual.value='fundacao';buscaAtual.oninput();a.run('painel.exportar()');assert.equal(a.run('pdf.rows.length'),1);assert.equal(a.run('pdf.rows[0].id'),'a');assert.equal(a.run('pdf.opts.categoria'),'Estrutural');assert.equal(a.run('pdf.opts.busca'),'fundacao');
  a.run('pdf=null');const busca=a.document.querySelector('[aria-label="Buscar documentos"]');busca.value='Não existe';busca.oninput();a.run('painel.exportar()');assert.equal(a.run('pdf'),null);assert.match(a.run('painel.textContent'),/nenhum.*document|nenhum.*arquivo/i);
});
test('Documentos: reabrir conserva a busca e categoria somente na navegação da obra',async()=>{
  const a=app({nuvem:[arquivo(),arquivo('b')]});a.run("obra.fmArquivosMetadados={a:{categoria:'Estrutural',titulo:'Fundação'}}");await tick();const antes=a.run('JSON.stringify(E)');botao(a,'Estrutural').click();const busca=a.document.querySelector('[aria-label="Buscar documentos"]');busca.value='fundacao';busca.oninput();
  a.run("document.getElementById('main').replaceChildren();painel=fmDocumentosPainel(obra);document.getElementById('main').appendChild(painel)");await tick();
  assert.equal(a.document.querySelector('[aria-label="Buscar documentos"]').value,'fundacao');assert.equal(botao(a,'Estrutural').getAttribute('aria-pressed'),'true');assert.equal(a.document.querySelectorAll('.fmdoc-item').length,1);assert.equal(a.run('JSON.stringify(E)'),antes);
});
test('Documentos: enviar pendentes informa a referência desta obra ao serviço',async()=>{
  const a=app({locais:[{...arquivo('c'),blob:'fila'}]});a.run('var envio=null;arqSubirPendentes=async(...args)=>{envio=args;return{subiu:1,falhou:0}}');await tick();
  const enviar=botao(a,'Enviar pendentes desta obra');assert.ok(enviar);enviar.click();await tick();assert.equal(a.run('envio[0]'),false);assert.equal(a.run('envio[1]'),'obra:o');
});
test('Documentos: distingue a data do documento da data de inclusão do arquivo',async()=>{
  const a=app({nuvem:[arquivo()]});a.run("obra.fmArquivosMetadados={a:{dataDocumento:'2026-10-01'}}");await tick();const meta=a.document.querySelector('.fmdoc-item-meta').textContent;
  assert.match(meta,/Documento.*01\/10\/2026/);assert.match(meta,/Anexado.*14\/10\/2026/);
});
test('Documentos: abertura recusa URL executável e fecha a janela sem navegar',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();a.ctx.janela={close(){this.fechada=true}};a.ctx.window.open=()=>a.ctx.janela;a.run("arqUrlDe=async()=> 'javascript:alert(1)'");
  await a.document.querySelector('.fmdoc-abrir').onclick();assert.equal(a.ctx.janela.location,undefined);assert.equal(a.ctx.janela.fechada,true);assert.match(a.document.querySelector('.fmdoc-painel>[role=alert]').textContent,/Não foi possível abrir/);
});
test('Documentos: consulta nova bloqueia exportação antiga e PDF recebe cobertura local',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();a.run('var pdf=null;fmPdfDocumentos=(o,rows,opts)=>{pdf={rows,opts}};var concluirIndice;arqIndice=()=>new Promise(resolve=>concluirIndice=resolve);var atualizando=painel.atualizar()');
  assert.equal(botao(a,'Índice em PDF').disabled,true);a.run('painel.exportar()');assert.equal(a.run('pdf'),null);
  await a.run("concluirIndice(new Map([['obra:o',mockNuvem]]));atualizando");a.run('todosArquivos=async()=>{throw Error("IndexedDB indisponível")}');await a.run('arqIndice=async()=>new Map([["obra:o",mockNuvem]]);painel.atualizar()');a.run('painel.exportar()');assert.equal(a.run('pdf.opts.localDisponivel'),false);
});
test('Documentos: envio parcial mantém aviso de falha depois de atualizar a lista',async()=>{
  const a=app({locais:[{...arquivo('c'),blob:'fila'}]});a.run('arqSubirPendentes=async()=>({subiu:0,falhou:1})');await tick();botao(a,'Enviar pendentes desta obra').click();await tick();
  const aviso=a.document.querySelector('.fmdoc-painel>[role=alert]');assert.equal(aviso.hidden,false);assert.match(aviso.textContent,/continuam pendentes/);
});
for(const tipo of ['cursor local','aborto local'])test('Documentos: '+tipo+' com falha mantém os arquivos remotos disponíveis',async()=>{
  const a=setup();a.ctx.cursorLocal={error:Error('Erro sintético de leitura')};a.ctx.transacaoLocal={error:Error('Aborto sintético'),objectStore:()=>({openCursor:()=>a.ctx.cursorLocal})};
  a.run(`E=structuredClone(SEED);var obra={id:'erro-local',nome:'Obra sintética'};E.obras=[obra];db=async()=>({transaction:()=>transacaoLocal});arqIndice=async()=>new Map([['obra:erro-local',[{id:'remoto',ref:'obra:erro-local',nome:'Projeto remoto.pdf',tipo:'application/pdf',tam:10,em:'2026-10-14'}]]]);var painel=fmDocumentosPainel(obra);document.getElementById('main').appendChild(painel)`);
  await tick();if(tipo==='cursor local')a.ctx.cursorLocal.onerror?.({target:a.ctx.cursorLocal});else a.ctx.transacaoLocal.onabort?.({target:a.ctx.transacaoLocal});await tick();
  assert.equal(a.document.querySelectorAll('.fmdoc-item').length,1);assert.match(a.run('painel.textContent'),/somente os arquivos da nuvem/);assert.doesNotMatch(a.run('painel.textContent'),/Carregando/);assert.equal(a.run('obra.fmArquivosMetadados'),undefined);
});
test('Anexos: exportação ZIP com falha local avisa e não gera nem baixa cópia parcial',async()=>{
  const a=setup();let aviso='';a.ctx.alert=s=>{aviso=s};a.run("var gerouZip=0,baixouZip=0;zipStore=()=>{gerouZip++;return new Blob([])};baixar=()=>{baixouZip++};todosArquivos=async()=>{throw Error('Falha sintética de leitura local')}");
  let rejeitou=false;try{await a.run('exportarArquivos()')}catch(e){rejeitou=true}
  assert.equal(rejeitou,false);assert.match(aviso,/ZIP.*não|não.*ZIP/i);assert.equal(a.run('gerouZip'),0);assert.equal(a.run('baixouZip'),0);
});
test('Documentos: popup bloqueado conserva rascunho e não consulta URL nem sai da Central',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();botao(a,'Classificar').click();preencher(a,'descricao','Rascunho em andamento');a.ctx.window.open=()=>null;
  a.run("location.href='https://central.example/';var consultouUrl=0;arqUrlDe=async()=>{consultouUrl++;return 'https://storage.example/projeto.pdf'}");
  await a.document.querySelector('.fmdoc-abrir').onclick();assert.equal(a.run('consultouUrl'),0);assert.equal(a.run('location.href'),'https://central.example/');assert.equal(a.document.querySelector('[name=descricao]').value,'Rascunho em andamento');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.document.querySelector('.fmdoc-painel>[role=alert]').textContent,/permit|nova aba|nova janela/i);
});
test('Documentos: link de download isola a nova aba quando o servidor não força download',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();a.run("arqUrlDe=async()=> 'https://storage.example/projeto.pdf'");let destino;const append=a.document.body.appendChild.bind(a.document.body);
  a.document.body.appendChild=node=>{if(node.tagName==='A')destino={target:node.getAttribute('target'),rel:node.getAttribute('rel'),nome:node.getAttribute('download')};return append(node)};
  await a.document.querySelector('.fmdoc-baixar').onclick();assert.equal(destino.target,'_blank');assert.match(destino.rel,/noopener/);assert.match(destino.rel,/noreferrer/);assert.equal(destino.nome,'Projeto a.pdf');
});
