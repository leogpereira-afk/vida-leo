import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {setup} from './helpers/dom.mjs';
function app({nuvem=[],locais=[],falha=false,dados}={}){
  const a=setup(),storage=new Map();a.ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  for(const nome of ['fortemais-imovel-modelo.js','fortemais-imovel.js'])vm.runInContext(readFileSync(new URL('../publico/'+nome,import.meta.url),'utf8'),a.ctx);
  a.ctx.mockNuvem=nuvem;a.ctx.mockLocais=locais;a.ctx.falhaNuvem=falha;a.ctx.inicial=dados;
  a.run(`E=structuredClone(SEED);var obra={id:'o',nome:'Obra sintética',endereco:'Local sintético',area:80,lote:'L',fmPrevisao:{venda:123}};if(inicial)obra.fmImovel=structuredClone(inicial);E.obras=[obra,{id:'outra',nome:'Outra sintética'}];tela=()=>{};arqEsquecerIndice=()=>{};arqIndice=async()=>falhaNuvem?null:new Map(mockNuvem.map(a=>[a.ref,mockNuvem.filter(x=>x.ref===a.ref)]));todosArquivos=async()=>mockLocais;arqUrlDe=async id=>'https://storage.example/'+id;var painel=fmImovelPainel(obra);document.getElementById('main').appendChild(painel)`);
  return {...a,storage};
}
const tick=async()=>{for(let i=0;i<14;i++)await Promise.resolve()};
const arquivo=(id='a',ref='obra:o',tipo='image/jpeg')=>({id,ref,nome:'Imagem '+id+'.jpg',tipo,tam:123,em:'2026-10-14'});
const botao=(a,texto)=>[...a.document.querySelectorAll('button')].find(b=>b.textContent===texto);
function preencher(a,nome,valor){const c=a.document.querySelector('.fmim-editor [name='+nome+']')||a.document.querySelector('[name='+nome+']');assert.ok(c,nome);if(c.tagName==='SELECT'){for(const op of c.options)op.removeAttribute('selected');[...c.options].find(op=>op.value===valor)?.setAttribute('selected','')}else c.value=valor;c.dispatchEvent(new a.document.defaultView.Event('input',{bubbles:true}))}
function enviar(a){const f=a.document.querySelector('form.fmim-editor');assert.ok(f);f.onsubmit({preventDefault(){}})}

test('Imóvel: cadastro complementa a mesma obra, mantém financeiro e recarrega dados salvos',async()=>{
  const a=app();await tick();const antes=a.run('JSON.stringify(obra.fmPrevisao)');botao(a,'Editar características').click();preencher(a,'responsavel','Responsável sintético');preencher(a,'suites','0');preencher(a,'descricaoComercial','Descrição sintética');assert.equal(a.run('painel._fmDirty'),true);enviar(a);
  assert.equal(a.run('obra.fmImovel.suites'),0);assert.equal(a.run('obra.fmImovel.quartos'),undefined);assert.equal(a.run('JSON.stringify(obra.fmPrevisao)'),antes);assert.equal(a.run('obra.endereco'),'Local sintético');assert.equal(a.run('E.obras[1].fmImovel'),undefined);assert.equal(a.run('painel._fmDirty'),false);assert.match(a.run('painel.textContent'),/neste navegador/);
  a.run('document.getElementById("main").replaceChildren();painel=fmImovelPainel(obra);document.getElementById("main").appendChild(painel)');await tick();assert.match(a.run('painel.textContent'),/Descrição sintética/);assert.ok([...a.storage.values()].some(v=>v.includes('Descrição sintética')));
});
test('Imóvel: falha local restaura campo e timestamp preservando rascunho',async()=>{
  const a=app();await tick();a.run('E._mt=111');botao(a,'Editar características').click();preencher(a,'acabamentos','Rascunho');a.ctx.localStorage.setItem=()=>{throw Error('quota')};enviar(a);
  assert.equal(a.run('obra.fmImovel'),undefined);assert.equal(a.run('E._mt'),111);assert.equal(a.document.querySelector('[name=acabamentos]').value,'Rascunho');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.document.querySelector('form [role=alert]').textContent,/Não foi possível salvar/);
});
for(const caso of ['objeto','mutacao','estado','obra','identidade'])test('Imóvel: conflito '+caso+' preserva rascunho sem substituir dados recebidos',async()=>{
  const a=app({dados:{versao:1,responsavel:'Antes'}});await tick();botao(a,'Editar características').click();preencher(a,'responsavel','Rascunho');
  a.run(caso==='objeto'?"obra.fmImovel={versao:1,responsavel:'Outro acesso'}":caso==='mutacao'?"obra.fmImovel.responsavel='Outro acesso'":caso==='estado'?"E={...E}":caso==='identidade'?"obra.id='nova-identidade'":"E.obras=[{...obra}]");enviar(a);
  assert.equal(a.document.querySelector('[name=responsavel]').value,'Rascunho');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.document.querySelector('form [role=alert]').textContent,/atualizada/);assert.notEqual(a.run('obra.fmImovel.responsavel'),'Rascunho');
});
test('Imóvel: galeria deduplica imagens seguras e não inclui filhos nem outras obras',async()=>{
  const a=app({nuvem:[arquivo(),arquivo('b','obra:o:demanda:d'),arquivo('c','obra:outra'),arquivo('d','obra:o','image/svg+xml'),arquivo('e','obra:o','text/html')],locais:[{...arquivo(),blob:'bytes'},{...arquivo('fila'),blob:'bytes'}]});await tick();
  assert.equal(a.document.querySelectorAll('.fmim-foto').length,2);assert.equal(a.document.querySelectorAll('.fmim-foto img').length,2);assert.match(a.run('painel.textContent'),/neste aparelho/);
});
test('Imóvel: consulta incompleta não é reportada como zero fotos',async()=>{
  const a=app({falha:true});await tick();assert.match(a.run('painel.textContent'),/consulta incompleta|consulta está incompleta/i);assert.doesNotMatch(a.run('painel.textContent'),/Nenhuma imagem anexada/);
  a.run('todosArquivos=async()=>{throw Error("falha local")};falhaNuvem=false');await a.run('painel.atualizar()');assert.match(a.run('painel.textContent'),/somente os arquivos da nuvem/);
});
test('Imóvel: classificação, capa e arquivamento preservam bytes e permitem reversão',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();a.run('arqAdd=()=>{throw Error("não enviar")};arqDel=()=>{throw Error("não excluir")}');botao(a,'Classificar').click();preencher(a,'legenda','Fachada sintética');preencher(a,'tipo','projeto');preencher(a,'uso','interno');preencher(a,'data','2026-10-01');preencher(a,'etapa','Estrutura');enviar(a);botao(a,'Usar como capa').click();
  assert.equal(a.run('obra.fmImovel.capaId'),'a');assert.equal(a.run('obra.fmImovel.fotos.a.tipo'),'projeto');assert.equal(a.run('obra.fmImovel.fotos.a.uso'),'interno');botao(a,'Arquivar').click();assert.equal(a.run('obra.fmImovel.capaId'),undefined);assert.equal(a.document.querySelectorAll('.fmim-foto').length,0);botao(a,'Arquivadas').click();botao(a,'Desarquivar').click();botao(a,'Ativas').click();assert.equal(a.document.querySelectorAll('.fmim-foto').length,1);assert.equal(a.run('obra.fmImovel.fotos.a.legenda'),'Fachada sintética');
});
test('Imóvel: upload usa ID original e escopo canônico com tipo e uso separados',async()=>{
  const a=app();await tick();preencher(a,'tipoUpload','real');preencher(a,'usoUpload','divulgacao');a.ctx.file={name:'Original.jpg',type:'image/jpeg',size:12};
  a.run("var envios=[];arqAdd=async(ref,file)=>{envios.push([ref,file]);const r={id:'original',ref,nome:file.name,tipo:file.type,tam:file.size};mockNuvem.push(r);return r}");await a.run('painel.receber([file])');await tick();
  assert.equal(a.run('envios[0][0]'),'obra:o');assert.equal(a.run('envios[0][1]===file'),true);assert.equal(a.run('obra.fmImovel.fotos.original.tipo'),'real');assert.equal(a.run('obra.fmImovel.fotos.original.uso'),'divulgacao');assert.equal(a.run('painel._fmDirty'),false);assert.equal(a.document.querySelectorAll('.fmim-foto').length,1);
});
test('Imóvel: falha ao classificar upload mantém bytes e rascunho até nova tentativa',async()=>{
  const a=app();await tick();preencher(a,'tipoUpload','projeto');a.ctx.file={name:'Original.jpg',type:'image/jpeg',size:12};a.run("arqAdd=async(ref,file)=>{const r={id:'original',ref,nome:file.name,tipo:file.type};mockNuvem.push(r);return r}");const set=a.ctx.localStorage.setItem;a.ctx.localStorage.setItem=()=>{throw Error('quota')};await a.run('painel.receber([file])');
  assert.equal(a.run('obra.fmImovel'),undefined);assert.equal(a.run('mockNuvem.length'),1);assert.equal(a.document.querySelectorAll('.fmim-foto').length,1);assert.match(a.run('painel.textContent'),/Envio a conferir/);assert.equal(a.run('painel._fmDirty'),true);assert.match(a.run('painel.textContent'),/Classificação das imagens pendente/);a.ctx.localStorage.setItem=set;botao(a,'Tentar salvar classificação').click();await tick();assert.equal(a.run('obra.fmImovel.fotos.original.tipo'),'projeto');assert.equal(a.run('painel._fmDirty'),false);
});
test('Imóvel: conflito durante upload não sobrescreve alterações recebidas',async()=>{
  const a=app();await tick();a.ctx.file={name:'Original.jpg',type:'image/jpeg',size:12};a.run("arqAdd=async(ref,file)=>{obra.fmImovel={versao:1,responsavel:'Outro acesso'};const r={id:'original',ref,nome:file.name,tipo:file.type};mockNuvem.push(r);return r}");await a.run('painel.receber([file])');
  assert.equal(a.run('obra.fmImovel.responsavel'),'Outro acesso');assert.equal(a.run('painel._fmDirty'),true);botao(a,'Tentar salvar classificação').click();await tick();assert.equal(a.run('obra.fmImovel.responsavel'),'Outro acesso');assert.match(a.document.querySelector('.fmim-edicao [role=alert]').textContent,/atualizada/);
});
test('Imóvel: SVG e arquivo acima do limite são recusados antes do upload',async()=>{
  const a=app();await tick();a.run('var envios=0;arqAdd=async()=>{envios++}');a.ctx.files=[{name:'Svg.svg',type:'image/svg+xml',size:12},{name:'Grande.jpg',type:'image/jpeg',size:25*1024*1024+1}];await a.run('painel.receber(files)');assert.equal(a.run('envios'),0);assert.equal(a.run('obra.fmImovel'),undefined);assert.match(a.run('painel.textContent'),/limite é 25 MB/);assert.equal(a.run('painel._fmDirty'),false);
});
test('Imóvel: URL executável e HTML em legenda não entram na galeria',async()=>{
  const a=app({nuvem:[{...arquivo(),nome:'<script>arquivo.jpg'}],dados:{versao:1,fotos:{a:{legenda:'<img src=x onerror=alert(1)>'}}}});a.run("arqUrlDe=async()=> 'javascript:alert(1)'");await tick();assert.equal(a.document.querySelectorAll('.fmim-foto img').length,0);assert.equal(a.document.querySelectorAll('.fmim-foto script').length,0);assert.match(a.run('painel.textContent'),/<img src=x/);
  a.ctx.janela={close(){this.fechada=true}};a.ctx.window.open=()=>a.ctx.janela;await botao(a,'Abrir').onclick();assert.equal(a.ctx.janela.location,undefined);assert.equal(a.ctx.janela.fechada,true);
});
test('Imóvel: atualização bloqueada conserva rascunho e editar cadastro chama cadastro existente',async()=>{
  const a=app();await tick();a.run('var editou=null;fmObraEditar=o=>editou=o');botao(a,'Editar cadastro da obra').click();assert.equal(a.run('editou===obra'),true);botao(a,'Editar características').click();preencher(a,'ambientes','Rascunho');await a.run('painel.atualizar()');assert.equal(a.document.querySelector('[name=ambientes]').value,'Rascunho');assert.equal(a.run('painel._fmDirty'),true);assert.match(a.run('painel.textContent'),/Salve ou cancele/);
});
test('Imóvel: nova aba e download preservam a navegação e isolamento',async()=>{
  const a=app({nuvem:[arquivo()]});await tick();a.ctx.window.open=()=>null;a.run('var urlsConsultadas=0;arqUrlDe=async()=>{urlsConsultadas++;return "https://storage.example/foto.jpg"}');await botao(a,'Abrir').onclick();assert.equal(a.run('urlsConsultadas'),0);assert.match(a.document.querySelector('.fmim-painel>[role=alert]').textContent,/nova aba/);
  let link;const append=a.document.body.appendChild.bind(a.document.body);a.document.body.appendChild=n=>{if(n.tagName==='A')link=n;return append(n)};await botao(a,'Baixar original').onclick();assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);assert.equal(link.getAttribute('download'),'Imagem a.jpg');
});

test('Imóvel: descarte libera URLs locais e invalida prévias assíncronas',async()=>{
  const a=app({nuvem:[arquivo()]});const revogadas=[];a.ctx.URL=class extends URL{static revokeObjectURL(url){revogadas.push(url)}};a.run("arqUrlDe=async()=> 'blob:foto-sintetica'");await tick();assert.equal(a.document.querySelectorAll('.fmim-foto img').length,1);assert.equal(a.run('painel._fmDispose===painel.descartar'),true);a.run('painel._fmDispose()');assert.deepEqual(revogadas,['blob:foto-sintetica']);
  a.run('var resolverImagem;arqUrlDe=()=>new Promise(r=>resolverImagem=r)');await a.run('painel.atualizar()');a.run('painel._fmDispose();resolverImagem("blob:foto-atrasada")');await tick();assert.equal(a.document.querySelectorAll('.fmim-foto img').length,0);assert.ok(revogadas.includes('blob:foto-atrasada'));
});
test('Imóvel: composição compacta conserva todos os campos e devolve o foco após salvar',async()=>{
  const a=app();await tick();let foco;a.document.defaultView.HTMLElement.prototype.focus=function(){foco=this};botao(a,'Editar características').click();
  assert.deepEqual([...a.document.querySelectorAll('.fmim-numeros input')].map(i=>i.name),['quartos','suites','banheiros','vagas']);
  for(const [nome,valor] of Object.entries({responsavel:'Responsável sintético',quartos:'3',suites:'1',banheiros:'2',vagas:'0',ambientes:'Sala e cozinha',acabamentos:'Acabamento sintético',diferenciais:'Descrição sintética',descricaoComercial:'Descrição pública sintética',observacoesInternas:'Observação interna sintética'}))preencher(a,nome,valor);
  enviar(a);assert.equal(foco.textContent,'Editar características');assert.equal(foco.isConnected,true);assert.equal(a.run('obra.fmImovel.vagas'),0);assert.equal(a.run('obra.fmImovel.observacoesInternas'),'Observação interna sintética');assert.equal(a.run('obra.fmImovel.descricaoComercial'),'Descrição pública sintética');
});
test('Imóvel: classificar volta para a imagem certa e erro de salvamento preserva a legenda',async()=>{
  const a=app({nuvem:[arquivo(),arquivo('b')]});await tick();let foco;a.document.defaultView.HTMLElement.prototype.focus=function(){foco=this};
  a.document.querySelector('[data-foto-id=b] .fmim-classificar').click();preencher(a,'legenda','Imagem sintética B');enviar(a);
  assert.equal(foco.closest('[data-foto-id]')?.dataset.fotoId,'b');assert.equal(foco.textContent,'Classificar');assert.equal(foco.isConnected,true);
  foco.click();preencher(a,'legenda','Rascunho conservado');a.ctx.localStorage.setItem=()=>{throw Error('quota')};enviar(a);
  assert.equal(foco.getAttribute('role'),'alert');assert.equal(foco.hidden,false);assert.equal(a.document.querySelector('[name=legenda]').value,'Rascunho conservado');assert.equal(a.run('obra.fmImovel.fotos.b.legenda'),'Imagem sintética B');
});
test('Imóvel: envio de fotos indica progresso e impede envio duplo até terminar',async()=>{
  const a=app();await tick();a.ctx.file={name:'Original.jpg',type:'image/jpeg',size:12};a.run("var resolverEnvio;var totalEnvios=0;arqAdd=(ref,file)=>{totalEnvios++;return new Promise(r=>resolverEnvio=()=>{const reg={id:'novo',ref,nome:file.name,tipo:file.type,tam:file.size};mockNuvem.push(reg);r(reg)})};var enviandoFoto=painel.receber([file])");
  const enviar=botao(a,'Enviando imagens…');assert.ok(enviar);assert.equal(enviar.disabled,true);assert.equal(enviar.getAttribute('aria-busy'),'true');await a.run('painel.receber([file])');assert.equal(a.run('totalEnvios'),1);
  await a.run('resolverEnvio();enviandoFoto');assert.equal(enviar.textContent,'Adicionar imagens');assert.equal(enviar.disabled,false);assert.equal(enviar.getAttribute('aria-busy'),'false');assert.equal(a.run('obra.fmImovel.fotos.novo.tipo'),undefined);assert.equal(a.document.querySelectorAll('[data-foto-id=novo]').length,1);
});
