/* Biblioteca de saúde: leitura do original e conferência MANUAL, sem OCR.
 * Integração: quadroDocumentosSaude() -> HTMLElement (carga assíncrona);
 * saudeCatalogoDocumentos() -> Promise<{documentos, falhas}>.
 * CSS do controlador: sdoc, sdoc-filtros/acoes/linha (flex com wrap), sdoc-lista,
 * sdoc-card/item (borda e padding), sdoc-leitor (altura responsiva),
 * sdoc-viewport (overflow auto), sdoc-imagem (max-width:100%), sdoc-form
 * (grid responsivo), sdoc-erro (contraste de erro), sdoc-nota, sdoc-status.
 * iframe dentro de sdoc-viewport deve ocupar 100% de largura e >= 55vh.
 */
(function(root){
 'use strict';
 const copia=x=>JSON.parse(JSON.stringify(x));
 const tem=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 const idSeguro=v=>typeof v==='string'&&!!v.trim()&&!['__proto__','prototype','constructor'].includes(v)&&!/[\u0000-\u001f]/.test(v);
 const tipoArquivo=a=>a.tipo==='application/pdf'?'pdf':/^image\/(png|jpeg|webp|gif|bmp)$/i.test(a.tipo||'')?'imagem':'outro';
 const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const refs=()=>SaudePainelModelo.documentosRefs(E);
 const meta=id=>tem(E.saudeDocumentos,id)?E.saudeDocumentos[id]:{};
 const msg=(box,texto)=>{box.textContent=texto};
 function urlSegura(valor){
  const u=new URL(String(valor));
  if(u.username||u.password)throw Error('O endereço do arquivo não é seguro.');
  if(u.protocol==='https:')return u.href;
  if(u.protocol==='blob:'&&/^blob:(https?:\/\/|null\/)/.test(u.href))return u.href;
  throw Error('Não foi recebido um endereço seguro para o arquivo.');
 }
 async function catalogo(){
  const documentos=new Map(),falhas=[];
  // Os serviços existentes resolvem nuvem/local. Não copiamos o blob nem
  // criamos outra referência para um arquivo já anexado a uma ficha.
  const origens=refs();
  for(const origem of origens){
   try{for(const a of await arqPor(origem.ref)){
    if(!a||!idSeguro(a.id))continue;
    if(!documentos.has(a.id))documentos.set(a.id,{...a,ref:a.ref||origem.ref,origem:origens.find(r=>r.ref===a.ref)||origem,meta:meta(a.id)});
   }}catch(e){falhas.push({ref:origem.ref,titulo:origem.titulo,erro:String(e.message||e)})}
  }
  return {documentos:[...documentos.values()],falhas};
 }
 function leitor(anexo){
  const box=el('<section class="sdoc-leitor"><p class="sdoc-status" role="status" aria-live="polite">Carregando original…</p><div class="sdoc-acoes"></div><div class="sdoc-viewport"></div></section>');
  const aviso=box.querySelector('.sdoc-status'),acoes=box.querySelector('.sdoc-acoes'),area=box.querySelector('.sdoc-viewport');
  let url='',fechado=false;
  const liberar=()=>{fechado=true;if(url.startsWith('blob:'))URL.revokeObjectURL(url)};
  const carregar=async()=>{
   acoes.replaceChildren();area.replaceChildren();aviso.textContent='Carregando original…';
   const tipo=tipoArquivo(anexo);
   if(tipo==='outro'){aviso.textContent='Visualização disponível para PDF e imagens PNG, JPEG, WebP, GIF ou BMP. Confira o tipo do arquivo.';return}
   try{
    if(!idSeguro(anexo.id))throw Error('Identificador de arquivo inválido.');
    const obtida=urlSegura(await arqUrlDe(anexo.id,false));
    if(fechado){if(obtida.startsWith('blob:'))URL.revokeObjectURL(obtida);return}
    if(url.startsWith('blob:'))URL.revokeObjectURL(url);url=obtida;
    const link=el('<a class="sdoc-abrir" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Abrir original em outra aba</a>');link.href=url;acoes.appendChild(link);
    const campos=el('<div class="sdoc-linha"><label>Página <input data-sdoc="pagina" type="number" min="1" max="10000" value="1" step="1"></label><label>Zoom <select data-sdoc="zoom"><option value="75">75%</option><option value="100" selected>100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label></div>');acoes.appendChild(campos);
    const pagina=campos.querySelector('input'),zoom=campos.querySelector('select');
    const view=tipo==='pdf'?el('<iframe title="Original do documento de saúde" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>'):el('<img class="sdoc-imagem" alt="Original do documento de saúde" referrerpolicy="no-referrer">');area.appendChild(view);
    const atualizar=()=>{const p=Math.max(1,Math.min(10000,Math.trunc(+pagina.value)||1)),z=[75,100,125,150,200].includes(+zoom.value)?+zoom.value:100;pagina.value=String(p);if(tipo==='pdf')view.src=url.split('#')[0]+'#page='+p+'&zoom='+z;else{view.src=url;view.style.width=z+'%';view.style.maxWidth='none'}};
    pagina.disabled=tipo!=='pdf';pagina.onchange=atualizar;zoom.onchange=atualizar;atualizar();
    aviso.textContent='Original disponível. '+(tipo==='pdf'?'Página e zoom dependem do leitor PDF do navegador; se necessário, abra em outra aba.':'Imagem de uma página.');
   }catch(e){if(fechado)return;aviso.textContent='Não foi possível abrir o original: '+(e.message||e);acoes.appendChild(acao('Tentar abrir novamente',carregar))}
  };
  carregar();return {box,liberar};
 }
 function abrir(anexo){
  let l;abrirModal('Original do documento',esc(anexo.nome||'Arquivo'),c=>{l=leitor(anexo);c.appendChild(l.box)},()=>l?.liberar(),{recarregar:false});
 }
 function campo(nome,titulo,tipo='text',valor=''){
  const c=el('<label>'+esc(titulo)+(tipo==='textarea'?'<textarea></textarea>':'<input type="'+tipo+'">')+'</label>'),i=c.querySelector('input,textarea');i.name=nome;i.value=String(valor??'');return c;
 }
 function revisar(anexo,ref){
  if(!idSeguro(anexo.id))throw Error('Identificador de arquivo inválido.');
  const salvo=meta(anexo.id),refOriginal=salvo.origem?.ref||anexo.ref||ref;
  if(!refs().some(x=>x.ref===refOriginal))throw Error('A referência deste documento não está disponível na Saúde.');
  const rascunho=copia({...salvo,origem:salvo.origem||{anexoId:anexo.id,ref:refOriginal,nome:anexo.nome||'',tipo:anexo.tipo||'',em:anexo.em||''},itens:Array.isArray(salvo.itens)?salvo.itens:[]});
  let l,ocupado=false;
  abrirModal('Conferência manual do documento',esc(anexo.nome||'Arquivo'),(c,fechar)=>{
   c.classList.add('sdoc');c.appendChild(el('<p class="sdoc-nota">Não há extração automática neste painel. Transcreva e confira cada item no original. Confirmar aqui registra sua conferência; não altera resultados nem tratamentos.</p>'));
   l=leitor(anexo);c.appendChild(l.box);
   const form=el('<div class="sdoc-form"></div>');c.appendChild(form);
   const adicionarCampo=(nome,titulo,tipo,valor)=>{const w=campo(nome,titulo,tipo,valor);w.querySelector('input,textarea').setAttribute('data-sdoc',nome);form.appendChild(w);return w.querySelector('input,textarea')};
   const titulo=adicionarCampo('titulo','Título','text',rascunho.titulo||anexo.nome),data=adicionarCampo('dataDocumento','Data do documento','date',rascunho.dataDocumento||''),texto=adicionarCampo('textoOriginal','Texto original transcrito manualmente','textarea',rascunho.textoOriginal||''),paginas=adicionarCampo('paginasRevisadas','Páginas conferidas (ex.: 1, 2)','text',rascunho.paginasRevisadas||'');
   const cobertura=el('<label>Cobertura da conferência <select data-sdoc="cobertura"><option value="nao-iniciada">Não iniciada</option><option value="parcial">Parcial</option><option value="completa">Documento inteiro conferido</option></select></label>');form.appendChild(cobertura);const coberturaInput=cobertura.querySelector('select');coberturaInput.value=rascunho.cobertura||'nao-iniciada';
   const naoReconhecidos=adicionarCampo('naoReconhecidos','Itens não reconhecidos / trechos ilegíveis ou ainda não transcritos','textarea',rascunho.naoReconhecidos||'');
   c.appendChild(el('<h4>Itens transcritos para conferência</h4><p class="sdoc-nota">Cada item começa pendente. Edite os campos antes de marcar como confirmado; a cobertura é declarada por você.</p>'));
   const lista=el('<div class="sdoc-itens"></div>');c.appendChild(lista);const linhas=[];
   const adicionarItem=(item={})=>{
    const linha=el('<article class="sdoc-item"></article>'),campos={};
    for(const [nome,titulo,tipo]of[['descricao','Item / marcador','text'],['valor','Valor / conteúdo','text'],['unidade','Unidade','text'],['referencia','Referência do original','text'],['pagina','Página','number'],['observacao','Observação','text']]){
     const w=campo(nome,titulo,tipo,item[nome]||'');const i=w.querySelector('input');if(nome==='pagina'){i.min='1';i.max='10000';i.step='1'}linha.appendChild(w);campos[nome]=i;
    }
    const estado=el('<label>Conferência <select name="estado"><option value="pendente">Pendente</option><option value="confirmado">Confirmado manualmente</option></select></label>');linha.appendChild(estado);campos.estado=estado.querySelector('select');campos.estado.value=item.estado==='confirmado'?'confirmado':'pendente';
    const registro={linha,campos};linhas.push(registro);linha.appendChild(acao('Remover item do rascunho',()=>{linhas.splice(linhas.indexOf(registro),1);linha.remove()}));lista.appendChild(linha);
   };
   rascunho.itens.forEach(adicionarItem);c.appendChild(acao('Adicionar item',()=>adicionarItem()));
   if(typeof saudeEditarRegistro==='function'&&refOriginal!=='saude:documentos')c.appendChild(acao('Abrir registro de origem',()=>{
    const p=refOriginal.indexOf(':'),tipo={exame:'exames',tratamento:'tratamentos',consulta:'consultas',queixa:'queixas',vacina:'vacinas',peso:'peso',vitais:'vitais',fisio:'fisio'}[refOriginal.slice(0,p)],id=refOriginal.slice(p+1),registro=tipo&&Array.isArray(E[tipo])?E[tipo].find(r=>r.id===id):null;
    if(!registro){erro.textContent='O registro de origem não está mais disponível.';return}saudeEditarRegistro(tipo,registro);
   }));
   const erro=el('<p class="sdoc-erro" role="alert"></p>'),status=el('<p class="sdoc-status" role="status" aria-live="polite"></p>');c.append(erro,status);
   const salvarBotao=acao('Salvar revisão',async()=>{
    if(ocupado)return;erro.textContent='';
    const itens=linhas.map(({campos})=>Object.fromEntries(Object.entries(campos).map(([k,v])=>[k,v.value.trim()])));
    if(itens.some(i=>!i.descricao)){erro.textContent='Preencha o item / marcador de cada linha ou remova a linha vazia.';return}
    if(itens.some(i=>i.pagina&&(!/^\d+$/.test(i.pagina)||+i.pagina<1||+i.pagina>10000))){erro.textContent='Confira a página dos itens (1 a 10000).';return}
    if(coberturaInput.value==='completa'&&!paginas.value.trim()){erro.textContent='Indique as páginas conferidas antes de declarar o documento inteiro conferido.';return}
    if(coberturaInput.value==='completa'&&itens.some(i=>i.estado!=='confirmado')){erro.textContent='Há itens pendentes. Confira todos ou mantenha a cobertura parcial.';return}
    if(coberturaInput.value==='completa'&&naoReconhecidos.value.trim()){erro.textContent='Há trechos não reconhecidos. Confira esses trechos ou mantenha a cobertura parcial.';return}
    if(data.value&&!SaudePainelModelo.data(data.value)){erro.textContent='Confira a data do documento.';return}
    const antes=E.saudeDocumentos,mt=E._mt,tinhaMt=tem(E,'_mt');ocupado=true;salvarBotao.disabled=true;
    try{
     const novo={...rascunho,titulo:titulo.value.trim(),dataDocumento:data.value,textoOriginal:texto.value,paginasRevisadas:paginas.value.trim(),cobertura:coberturaInput.value,naoReconhecidos:naoReconhecidos.value,itens,atualizadoEm:new Date().toISOString()};
     E.saudeDocumentos={...(antes||{}),[anexo.id]:novo};await salvar();Object.assign(rascunho,copia(novo));
     status.textContent='Revisão salva. '+itens.filter(i=>i.estado==='pendente').length+' item(ns) pendente(s), '+itens.filter(i=>i.estado==='confirmado').length+' confirmado(s). O envio do anexo é conferido separadamente.';
    }catch(e){if(antes===undefined)delete E.saudeDocumentos;else E.saudeDocumentos=antes;if(tinhaMt)E._mt=mt;else delete E._mt;erro.textContent='Não foi possível salvar a revisão: '+(e.message||e)}
    finally{ocupado=false;salvarBotao.disabled=false}
   });c.appendChild(salvarBotao);c.appendChild(acao('Fechar revisão',fechar));
  },()=>l?.liberar(),{recarregar:false,antesFechar:()=>!ocupado});
 }
 function quadro(){
  const box=el('<section class="sdoc"><h3>Documentos de saúde</h3><p class="sdoc-nota">Biblioteca dos anexos já vinculados aos registros. Leitura e conferência manual, sem extração automática.</p><div class="sdoc-filtros"><label>Vínculo <select data-sdoc="ref"><option value="">Todos os registros</option></select></label><label>Buscar <input type="search" data-sdoc="busca" placeholder="Arquivo, registro ou transcrição"></label><label>Tipo <select data-sdoc="tipo"><option value="">Todos</option><option value="pdf">PDF</option><option value="imagem">Imagens</option><option value="outro">Outros</option></select></label><label>De <input type="date" data-sdoc="de"></label><label>Até <input type="date" data-sdoc="ate"></label></div><div class="sdoc-acoes"></div><p class="sdoc-status" role="status" aria-live="polite">Carregando anexos…</p><div class="sdoc-lista"></div></section>');
  const acoes=box.querySelector('.sdoc-acoes'),status=box.querySelector('.sdoc-status'),lista=box.querySelector('.sdoc-lista'),busca=box.querySelector('[data-sdoc="busca"]'),tipo=box.querySelector('[data-sdoc="tipo"]'),de=box.querySelector('[data-sdoc="de"]'),ate=box.querySelector('[data-sdoc="ate"]');
  const filtroRef=box.querySelector('[data-sdoc="ref"]');for(const r of refs()){const o=el('<option></option>');o.value=r.ref;o.textContent=r.titulo;filtroRef.appendChild(o)}
  let arquivos=[],falhas=[],geracao=0;
  const pintar=()=>{
   lista.replaceChildren();const vistos=arquivos.filter(a=>{const m=meta(a.id),data=m.dataDocumento||a.em||a.origem.data||'';return(!filtroRef.value||a.ref===filtroRef.value)&&(!tipo.value||tipoArquivo(a)===tipo.value)&&(!de.value||!!data&&data>=de.value)&&(!ate.value||!!data&&data<=ate.value)&&(!busca.value||normal([a.nome,a.origem.titulo,m.titulo,m.textoOriginal].join(' ')).includes(normal(busca.value)))});
   for(const a of vistos){const m=meta(a.id),itens=Array.isArray(m.itens)?m.itens:[],pendentes=itens.filter(i=>i.estado!=='confirmado').length,confirmados=itens.length-pendentes;
    const card=el('<article class="sdoc-card"><h4>'+esc(m.titulo||a.nome)+'</h4><p>'+esc(a.origem.titulo)+' · '+esc(m.dataDocumento||a.em||'Data não informada')+'</p><p class="sdoc-nota">Arquivo: '+(a.nuvem?'na nuvem':a.pendente?'neste aparelho · envio pendente':'situação a conferir')+' · Revisão: '+(tem(E.saudeDocumentos,a.id)?pendentes+' pendente(s), '+confirmados+' confirmado(s)':'não iniciada')+'</p><div class="sdoc-acoes"></div></article>');
    const buttons=card.querySelector('.sdoc-acoes');buttons.append(acao('Ler original',()=>abrir(a)),acao('Conferir documento',()=>revisar(a,a.ref)));lista.appendChild(card);
   }
   if(!vistos.length)lista.appendChild(el('<p class="sdoc-nota">Nenhum documento encontrado para estes filtros.</p>'));
   status.textContent=vistos.length+' documento(s).'+(falhas.length?' Não foi possível conferir '+falhas.length+' referência(s): '+falhas.map(f=>f.titulo).join(', ')+'. Tente atualizar.':'');
  };
  const carregar=async()=>{const g=++geracao;status.textContent='Carregando anexos…';try{const r=await catalogo();if(g!==geracao)return;arquivos=r.documentos;falhas=r.falhas;pintar()}catch(e){status.textContent='Não foi possível carregar a biblioteca: '+(e.message||e)}};
  busca.oninput=pintar;for(const x of[tipo,de,ate,filtroRef])x.onchange=pintar;
  acoes.appendChild(acao('Atualizar biblioteca',carregar));
  const referencia=el('<label>Anexar ao registro <select aria-label="Registro de origem do anexo"></select></label>'),select=referencia.querySelector('select');for(const r of refs()){const o=el('<option></option>');o.value=r.ref;o.textContent=r.titulo;select.appendChild(o)}acoes.appendChild(referencia);
  const input=el('<input type="file" multiple hidden accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp">');acoes.appendChild(input);const anexar=acao('Anexar documento',()=>input.click());acoes.appendChild(anexar);
  input.onchange=async()=>{if(anexar.disabled)return;const ref=select.value,files=[...input.files];if(!refs().some(r=>r.ref===ref))return;anexar.disabled=true;const erros=[];try{for(const f of files){try{await arqAdd(ref,f)}catch(e){erros.push(f.name+': '+(e.message||e))}}await carregar();if(erros.length)status.textContent+=' Falha ao anexar: '+erros.join('; ')}finally{anexar.disabled=false;input.value=''}};
  const enviar=acao('Tentar enviar anexos deste registro',async()=>{if(enviar.disabled)return;enviar.disabled=true;try{const r=await arqSubirPendentes(false,select.value);await carregar();status.textContent+=' Envio: '+r.subiu+' enviado(s), '+r.falhou+' falha(s). Confira a situação de cada arquivo.'}catch(e){status.textContent='Não foi possível enviar: '+(e.message||e)}finally{enviar.disabled=false}});acoes.appendChild(enviar);
  carregar();return box;
 }
 root.saudeCatalogoDocumentos=catalogo;root.saudeAbrirDocumento=abrir;root.saudeRevisarDocumento=revisar;root.quadroDocumentosSaude=quadro;
})(globalThis);
