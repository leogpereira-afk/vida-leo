/* Biblioteca de saúde: leitura do original e conferência MANUAL, sem OCR.
 * Integração: quadroDocumentosSaude() -> HTMLElement (carga assíncrona);
 * saudeCatalogoDocumentos() -> Promise<{documentos, falhas}>.
 * CSS do controlador: sdoc, sdoc-filtros/acoes/linha (flex com wrap), sdoc-lista,
 * sdoc-card/item (borda e padding), sdoc-leitor (altura responsiva),
 * sdoc-viewport (overflow auto), sdoc-imagem (max-width:100%), sdoc-form
 * (grid responsivo), sdoc-erro (contraste de erro), sdoc-nota, sdoc-status.
 * Canvas em sdoc-viewport: não fixar altura; texto acessível em sdoc-texto-pdf.
 * PDF.js/worker/recursos são locais, versão fixa 6.4.299 (vendor com licença).
 */
(function(root){
 'use strict';
 const copia=x=>JSON.parse(JSON.stringify(x));
 const tem=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 const idSeguro=v=>typeof v==='string'&&!!v.trim()&&!['__proto__','prototype','constructor'].includes(v)&&!/[\u0000-\u001f]/.test(v);
 const tipoArquivo=a=>a.tipo==='application/pdf'?'pdf':/^image\/(png|jpeg|webp|gif|bmp)$/i.test(a.tipo||'')?'imagem':'outro';
 const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const refs=()=>SaudePainelModelo.documentosRefs(E);
 const objeto=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const meta=id=>tem(E.saudeDocumentos,id)&&objeto(E.saudeDocumentos[id])?E.saudeDocumentos[id]:{};
 const itensDe=m=>Array.isArray(m.itens)?m.itens.filter(objeto):[];
 function resumoConferencia(m){const itens=itensDe(m),pendentes=itens.filter(i=>i.estado!=='confirmado').length,ilegivel=!!String(m.naoReconhecidos||'').trim();const cobertura=m.cobertura==='completa'?pendentes||ilegivel?'Parcial (há pendências)':'Completa':m.cobertura==='parcial'?'Parcial':'Não iniciada';return cobertura+' · '+pendentes+' pendente(s), '+(itens.length-pendentes)+' confirmado(s)'+(ilegivel?' · Há trechos não reconhecidos':'')}
 const dia=v=>{const s=String(v||'').slice(0,10);return SaudePainelModelo.data(s)?s:''};
 const dataBR=v=>{const d=dia(v);return d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'Data não informada'};
 const pdfBase=new URL('vendor/pdfjs-6.4.299/',document.currentScript?.src||document.baseURI).href;
 let motorPdf;
 const carregarMotorPdf=()=>motorPdf||(motorPdf=import(pdfBase+'pdf.min.mjs').catch(e=>{motorPdf=null;throw e}));
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
  let url='',fechado=false,tarefaPdf=null,desenho=null,geracao=0;
  const pararPdf=()=>{geracao++;desenho?.cancel();desenho=null;const tarefa=tarefaPdf;tarefaPdf=null;if(tarefa)Promise.resolve(tarefa.destroy()).catch(()=>{})};
  const liberar=()=>{fechado=true;pararPdf();if(url.startsWith('blob:'))URL.revokeObjectURL(url);url=''};
  const falha=e=>{if(fechado||e?.name==='RenderingCancelledException')return;aviso.textContent='Não foi possível ler o original: '+(e.message||e)+'. O link do original continua disponível quando o endereço é seguro.';if(!acoes.querySelector('[data-sdoc="repetir"]')){const repetir=acao('Tentar abrir novamente',carregar);repetir.setAttribute('data-sdoc','repetir');acoes.appendChild(repetir)}};
  const carregar=async()=>{
   pararPdf();acoes.replaceChildren();area.replaceChildren();aviso.textContent='Carregando original…';
   const tipo=tipoArquivo(anexo);
   if(tipo==='outro'){aviso.textContent='Visualização disponível para PDF e imagens PNG, JPEG, WebP, GIF ou BMP. Confira o tipo do arquivo.';return}
   try{
    if(!idSeguro(anexo.id))throw Error('Identificador de arquivo inválido.');
    const obtida=urlSegura(await arqUrlDe(anexo.id,false));
    if(fechado){if(obtida.startsWith('blob:'))URL.revokeObjectURL(obtida);return}
    if(url.startsWith('blob:'))URL.revokeObjectURL(url);url=obtida;
    const link=el('<a class="sdoc-abrir" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Abrir original em outra aba</a>');link.href=url;acoes.appendChild(link);
    const campos=el('<div class="sdoc-linha"><label>Página <input data-sdoc="pagina" type="number" min="1" value="1" step="1"></label><span class="sdoc-paginas"></span><label>Zoom <select data-sdoc="zoom"><option value="75">75%</option><option value="100" selected>100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label></div>');acoes.appendChild(campos);
    const pagina=campos.querySelector('input'),zoom=campos.querySelector('select');
    if(tipo==='imagem'){
     const imagem=el('<img class="sdoc-imagem" alt="Original do documento de saúde" referrerpolicy="no-referrer">');area.appendChild(imagem);imagem.src=url;pagina.disabled=true;
     const atualizar=()=>{imagem.style.width=zoom.value+'%';imagem.style.maxWidth='none'};zoom.onchange=atualizar;atualizar();aviso.textContent='Imagem de uma página. Nenhum reconhecimento de texto é realizado.';return;
    }
    pagina.disabled=true;zoom.disabled=true;
    const pdfjs=await carregarMotorPdf();if(fechado)return;
    pdfjs.GlobalWorkerOptions.workerSrc=pdfBase+'pdf.worker.min.mjs';
    const tarefa=pdfjs.getDocument({url,cMapUrl:pdfBase+'cmaps/',cMapPacked:true,standardFontDataUrl:pdfBase+'standard_fonts/',wasmUrl:pdfBase+'wasm/',iccUrl:pdfBase+'iccs/',isEvalSupported:false,enableXfa:false,disableWorkerRendering:true,withCredentials:false});tarefaPdf=tarefa;
    const pdf=await tarefa.promise;if(fechado||tarefaPdf!==tarefa)return;
    pagina.max=String(pdf.numPages);pagina.disabled=false;zoom.disabled=false;campos.querySelector('.sdoc-paginas').textContent='de '+pdf.numPages;
    const texto=el('<details open class="sdoc-texto-pdf"><summary>Texto embutido da página (sem OCR)</summary><pre tabindex="0"></pre></details>');
    const atualizar=async()=>{
     const pedido=++geracao;desenho?.cancel();desenho=null;
     const n=Math.max(1,Math.min(pdf.numPages,Math.trunc(+pagina.value)||1)),z=[75,100,125,150,200].includes(+zoom.value)?+zoom.value:100;pagina.value=String(n);aviso.textContent='Renderizando página '+n+'…';
     try{
      const page=await pdf.getPage(n);if(fechado||pedido!==geracao)return;
      const original=page.getViewport({scale:1}),ajuste=area.clientWidth>0?Math.min(1,area.clientWidth/original.width):1;
      const viewport=page.getViewport({scale:ajuste*z/100});if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0)throw Error('Dimensões da página inválidas.');
      const escala=Math.min(root.devicePixelRatio||1,2,Math.sqrt(12000000/(viewport.width*viewport.height)),8192/viewport.width,8192/viewport.height);
      const canvas=el('<canvas role="img"></canvas>');canvas.setAttribute('aria-label','Página '+n+' de '+pdf.numPages+' do PDF original');canvas.width=Math.max(1,Math.floor(viewport.width*escala));canvas.height=Math.max(1,Math.floor(viewport.height*escala));canvas.style.width=Math.floor(viewport.width)+'px';canvas.style.height=Math.floor(viewport.height)+'px';
      area.replaceChildren(canvas,texto);texto.querySelector('pre').textContent='Carregando texto embutido…';
      const render=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:escala===1?null:[escala,0,0,escala,0,0]});desenho=render;await render.promise;
      if(fechado||pedido!==geracao)return;desenho=null;
      const conteudo=await page.getTextContent();if(fechado||pedido!==geracao)return;
      texto.querySelector('pre').textContent=conteudo.items.filter(i=>typeof i.str==='string').map(i=>i.str+(i.hasEOL?'\n':' ')).join('').trim()||'Esta página não contém texto embutido disponível. Confira a imagem do original; nenhum OCR foi realizado.';
      aviso.textContent='Página '+n+' de '+pdf.numPages+' · '+z+'%. Renderização local do original; a conferência permanece manual.';
     }catch(e){if(pedido===geracao)falha(e)}
    };
    pagina.onchange=atualizar;zoom.onchange=atualizar;await atualizar();
   }catch(e){falha(e)}
  };
  carregar();return {box,liberar};
 }
 function abrir(anexo){
  let l;abrirModal('Original do documento',esc(anexo.nome||'Arquivo'),c=>{c.classList.add('sdoc');l=leitor(anexo);c.appendChild(l.box)},()=>l?.liberar(),{recarregar:false});
 }
 function campo(nome,titulo,tipo='text',valor=''){
  const c=el('<label>'+esc(titulo)+(tipo==='textarea'?'<textarea></textarea>':'<input type="'+tipo+'">')+'</label>'),i=c.querySelector('input,textarea');i.name=nome;i.value=String(valor??'');return c;
 }
 function revisar(anexo,ref){
  if(!idSeguro(anexo.id))throw Error('Identificador de arquivo inválido.');
  const salvo=meta(anexo.id),refOriginal=salvo.origem?.ref||anexo.ref||ref;
  if(!refs().some(x=>x.ref===refOriginal))throw Error('A referência deste documento não está disponível na Saúde.');
  const rascunho=copia({...salvo,origem:salvo.origem||{anexoId:anexo.id,ref:refOriginal,nome:anexo.nome||'',tipo:anexo.tipo||'',em:anexo.em||''},itens:itensDe(salvo)});
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
    const origem=refs().find(r=>r.ref===refOriginal),tipo=origem?.tipo,id=origem?.registroId,registro=tipo&&Array.isArray(E[tipo])?E[tipo].find(r=>r.id===id):null;
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
     status.textContent='Revisão salva. '+resumoConferencia(novo)+'. O envio do anexo é conferido separadamente.';
    }catch(e){if(antes===undefined)delete E.saudeDocumentos;else E.saudeDocumentos=antes;if(tinhaMt)E._mt=mt;else delete E._mt;erro.textContent='Não foi possível salvar a revisão: '+(e.message||e)}
    finally{ocupado=false;salvarBotao.disabled=false}
   });c.appendChild(salvarBotao);c.appendChild(acao('Fechar revisão',fechar));
  },()=>l?.liberar(),{recarregar:false,antesFechar:()=>!ocupado});
 }
 function buscaVinculo(select,rotulo){
  const campo=el('<label class="sdoc-busca-vinculo">'+esc(rotulo)+'<input type="search" placeholder="Nome, área ou data do registro"><small role="status"></small></label>'),input=campo.querySelector('input'),estado=campo.querySelector('small');
  const opcoes=[...select.options].map(o=>({valor:o.value,texto:o.textContent}));
  const pintar=()=>{const atual=select.value,termo=normal(input.value),encontrados=opcoes.filter(o=>!o.valor||normal(o.texto).includes(termo));select.replaceChildren();const selecionado=opcoes.find(o=>o.valor===atual);if(selecionado&&!encontrados.includes(selecionado))encontrados.unshift(selecionado);for(const item of encontrados){const o=el('<option></option>');o.value=item.valor;o.textContent=item.texto;o.selected=item.valor===atual;select.append(o)}select.value=atual;const total=opcoes.filter(o=>o.valor&&normal(o.texto).includes(termo)).length;estado.textContent=total+' registros encontrados'+(selecionado&&termo&&!normal(selecionado.texto).includes(termo)?' · vínculo selecionado mantido':'');};
  input.oninput=pintar;select.parentElement.before(campo);pintar();
 }
 function tituloRef(r){const tipos={tratamentos:'Tratamentos',exames:'Exames',consultas:'Consultas',peso:'Medidas',vitais:'Sinais vitais',queixas:'Sintomas',fisio:'Fisioterapia',vacinas:'Vacinas',histFamiliar:'Família',rastreios:'Prevenção'};return r.titulo+' · '+(tipos[r.tipo]||r.tipo)}
 function quadro(){
  const box=el('<section class="sdoc"><h3>Documentos de saúde</h3><p class="sdoc-nota">Biblioteca dos anexos já vinculados aos registros. Leitura e conferência manual, sem extração automática.</p><div class="sdoc-filtros"><label>Vínculo <select data-sdoc="ref"><option value="">Todos os registros</option></select></label><label>Buscar <input type="search" data-sdoc="busca" placeholder="Arquivo, registro ou transcrição"></label><label>Tipo <select data-sdoc="tipo"><option value="">Todos</option><option value="pdf">PDF</option><option value="imagem">Imagens</option><option value="outro">Outros</option></select></label><label>De <input type="date" data-sdoc="de"></label><label>Até <input type="date" data-sdoc="ate"></label></div><div class="sdoc-acoes"></div><p class="sdoc-status" role="status" aria-live="polite">Carregando anexos…</p><div class="sdoc-lista"></div></section>');
  const acoes=box.querySelector('.sdoc-acoes'),status=box.querySelector('.sdoc-status'),lista=box.querySelector('.sdoc-lista'),busca=box.querySelector('[data-sdoc="busca"]'),tipo=box.querySelector('[data-sdoc="tipo"]'),de=box.querySelector('[data-sdoc="de"]'),ate=box.querySelector('[data-sdoc="ate"]');
  const filtroRef=box.querySelector('[data-sdoc="ref"]');for(const r of refs()){const o=el('<option></option>');o.value=r.ref;o.textContent=tituloRef(r);filtroRef.appendChild(o)}
  buscaVinculo(filtroRef,'Localizar vínculo');
  let arquivos=[],falhas=[],geracao=0;
  const pintar=()=>{
   lista.replaceChildren();const vistos=arquivos.filter(a=>{const m=meta(a.id),data=dia(m.dataDocumento||a.em||a.origem.data);return(!filtroRef.value||a.ref===filtroRef.value)&&(!tipo.value||tipoArquivo(a)===tipo.value)&&(!de.value||!!data&&data>=de.value)&&(!ate.value||!!data&&data<=ate.value)&&(!busca.value||normal([a.nome,a.origem.titulo,a.origem.tipo,m.titulo,m.textoOriginal,m.dataDocumento,a.origem.data,dataBR(m.dataDocumento||a.em||a.origem.data)].join(' ')).includes(normal(busca.value)))});
   for(const a of vistos){const m=meta(a.id);
    const card=el('<article class="sdoc-card"><h4>'+esc(m.titulo||a.nome)+'</h4><p>'+esc(a.origem.titulo)+' · '+esc(dataBR(m.dataDocumento||a.em||a.origem.data))+'</p><p class="sdoc-nota">Arquivo: '+(a.nuvem?'na nuvem':a.pendente?'neste aparelho · envio pendente':'situação a conferir')+' · Revisão: '+(objeto(E.saudeDocumentos?.[a.id])?resumoConferencia(m):'Não iniciada')+'</p><div class="sdoc-acoes"></div></article>');
    const buttons=card.querySelector('.sdoc-acoes');buttons.append(acao('Ler original',()=>abrir(a)),acao('Conferir documento',()=>revisar(a,a.ref)));lista.appendChild(card);
   }
   if(!vistos.length)lista.appendChild(el('<p class="sdoc-nota">Nenhum documento encontrado para estes filtros.</p>'));
   status.textContent=vistos.length+' documento(s).'+(falhas.length?' Não foi possível conferir '+falhas.length+' referência(s): '+falhas.map(f=>f.titulo).join(', ')+'. Tente atualizar.':'');
  };
  const carregar=async()=>{const g=++geracao;status.textContent='Carregando anexos…';try{const r=await catalogo();if(g!==geracao)return;arquivos=r.documentos;falhas=r.falhas;pintar()}catch(e){status.textContent='Não foi possível carregar a biblioteca: '+(e.message||e)}};
  busca.oninput=pintar;for(const x of[tipo,de,ate,filtroRef])x.onchange=pintar;
  acoes.appendChild(acao('Atualizar biblioteca',carregar));
  const referencia=el('<label>Anexar ao registro <select aria-label="Registro de origem do anexo"></select></label>'),select=referencia.querySelector('select');for(const r of refs()){const o=el('<option></option>');o.value=r.ref;o.textContent=tituloRef(r);select.appendChild(o)}acoes.appendChild(referencia);buscaVinculo(select,'Localizar registro para anexar');
  const input=el('<input type="file" multiple hidden accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp">');acoes.appendChild(input);const anexar=acao('Anexar documento',()=>input.click());acoes.appendChild(anexar);
  input.onchange=async()=>{if(anexar.disabled)return;const ref=select.value,files=[...input.files];if(!refs().some(r=>r.ref===ref))return;anexar.disabled=true;const erros=[];try{for(const f of files){try{await arqAdd(ref,f)}catch(e){erros.push(f.name+': '+(e.message||e))}}await carregar();if(erros.length)status.textContent+=' Falha ao anexar: '+erros.join('; ')}finally{anexar.disabled=false;input.value=''}};
  const enviar=acao('Tentar enviar anexos deste registro',async()=>{if(enviar.disabled)return;enviar.disabled=true;try{const r=await arqSubirPendentes(false,select.value);await carregar();status.textContent+=' Envio: '+r.subiu+' enviado(s), '+r.falhou+' falha(s). Confira a situação de cada arquivo.'}catch(e){status.textContent='Não foi possível enviar: '+(e.message||e)}finally{enviar.disabled=false}});acoes.appendChild(enviar);
  carregar();return box;
 }
 root.saudeCatalogoDocumentos=catalogo;root.saudeAbrirDocumento=abrir;root.saudeRevisarDocumento=revisar;root.quadroDocumentosSaude=quadro;
})(globalThis);
