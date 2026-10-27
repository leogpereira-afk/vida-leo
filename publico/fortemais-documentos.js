/* O arquivo mantém seu ID/ref. A organização mora na própria obra, sem copiar bytes. */
function fmDocumentosBase(o){return {estado:E,referencia:o.fmArquivosMetadados,texto:JSON.stringify(o.fmArquivosMetadados),tinha:Object.hasOwn(o,'fmArquivosMetadados')}}
function fmDocumentosGravar(o,id,patch,base=fmDocumentosBase(o)){
  if(E!==base.estado||!E.obras.includes(o)||o.fmArquivosMetadados!==base.referencia||JSON.stringify(o.fmArquivosMetadados)!==base.texto)
    throw Error('Os documentos foram atualizados enquanto você editava. Seu rascunho foi mantido; confira os dados e reabra a edição.');
  const novos=FortemaisDocumentosModelo.salvar(o.fmArquivosMetadados,id,patch),mt=E._mt,tinhaMt=Object.hasOwn(E,'_mt');
  o.fmArquivosMetadados=novos;
  try{salvar()}catch(e){if(base.tinha)o.fmArquivosMetadados=base.referencia;else delete o.fmArquivosMetadados;if(tinhaMt)E._mt=mt;else delete E._mt;throw Error('Não foi possível salvar a classificação. Os dados anteriores e seu rascunho foram mantidos.')}
  return novos;
}
function fmDocumentosBotao(texto,click,classe='ghost'){
  const b=el('<button type="button" class="btn"></button>');b.textContent=texto;if(classe)b.classList.add(classe);b.onclick=click;return b;
}
function fmDocumentosCampo(nome,rotulo,valor='',tipo='text'){
  const campo=el('<label class="fmdoc-campo"><span></span></label>');campo.firstElementChild.textContent=rotulo;
  const input=tipo==='textarea'?el('<textarea rows="3"></textarea>'):el('<input>');input.name=nome;if(tipo!=='textarea')input.type=tipo;input.value=valor||'';
  if(FortemaisDocumentosModelo.LIMITES[nome])input.maxLength=FortemaisDocumentosModelo.LIMITES[nome];campo.appendChild(input);return campo;
}
function fmDocumentosSugestoes(campo,mapa){
  const lista=el('<datalist></datalist>');lista.id=uid();for(const categoria of FortemaisDocumentosModelo.categorias(mapa)){const opcao=el('<option></option>');opcao.value=categoria;lista.appendChild(opcao)}
  campo.querySelector('input').setAttribute('list',lista.id);campo.appendChild(lista);
}
function fmDocumentosCategoriaRapida(campo){
  const grupo=el('<details class="fmdoc-categorias-rapidas"><summary>Categorias rápidas</summary><div></div></details>');
  for(const categoria of FortemaisDocumentosModelo.PADRAO){const b=fmDocumentosBotao(categoria,()=>{const input=campo.querySelector('input');input.value=categoria;input.dispatchEvent(new document.defaultView.Event('input',{bubbles:true}));grupo.open=false});grupo.lastElementChild.appendChild(b)}
  return grupo;
}
function fmDocumentosPainel(o){
  const M=FortemaisDocumentosModelo,sec=el('<section class="fmdoc-painel" aria-label="Projetos e documentos da obra"></section>');sec._fmDirty=false;
  const cab=el('<header class="fmdoc-cab"><div><h3>Projetos e documentos</h3><p>Arquivos da obra, classificados por área.</p></div><div class="fmdoc-acoes"></div></header>');
  const aviso=el('<p class="fmdoc-aviso" role="status" hidden></p>'),falha=el('<p class="fmdoc-erro" role="alert" hidden></p>');
  const filtros=el('<div class="fmdoc-filtros"></div>'),busca=el('<input type="search" aria-label="Buscar documentos" placeholder="Buscar nome, revisão ou descrição">');
  const chips=el('<div class="fmdoc-chips" role="group" aria-label="Categorias dos documentos"></div>'),situacoes=el('<div class="fmdoc-situacoes" role="group" aria-label="Estado dos documentos"></div>');
  const corpo=el('<div class="fmdoc-lista" aria-live="polite"><p>Carregando…</p></div>'),edicao=el('<div class="fmdoc-edicao"></div>'),contador=el('<p class="fmdoc-contador" role="status"></p>');
  const upload=el('<div class="fmdoc-upload"><div class="fmdoc-upload-campos"></div><button type="button" class="btn ghost fmdoc-solta">Adicionar arquivos</button><input type="file" name="arquivos" multiple hidden><small>Até 25 MB por arquivo. PDF e imagens podem ser abertos; outros formatos ficam disponíveis para baixar.</small></div>');
  const categoriaUpload=fmDocumentosCampo('categoriaUpload','Categoria dos novos arquivos');categoriaUpload.querySelector('input').maxLength=80;
  let arquivos=[],visiveis=[],nuvemDisponivel=false,localDisponivel=true,geracao=0,carregando=true,enviando=false,editor=null;
  filtro.fmDocumentos=filtro.fmDocumentos||Object.create(null);
  const filtrosAtuais=Object.hasOwn(filtro.fmDocumentos,o.id)?filtro.fmDocumentos[o.id]:{categoria:'',busca:'',arquivados:false};
  Object.defineProperty(filtro.fmDocumentos,o.id,{value:filtrosAtuais,writable:true,enumerable:true,configurable:true});busca.value=filtrosAtuais.busca||'';
  const notificar=texto=>{aviso.textContent=texto;aviso.hidden=!texto};
  const erro=texto=>{falha.textContent=texto;falha.hidden=!texto};
  const salvarMensagem='Classificação salva neste navegador. Acompanhe a sincronização no topo da Central.';
  function origem(a){const sufixo=String(a.ref||'').slice(('obra:'+o.id).length);if(!sufixo)return 'Obra';if(sufixo.startsWith(':demanda:')){const id=sufixo.slice(9),d=(o.fmDemandas?.itens||[]).find(x=>x.id===id);return 'Demanda: '+(d?.titulo||id)}if(sufixo.startsWith(':compra:')){const id=sufixo.slice(8),c=(o.fmCompras?.listas||[]).find(x=>x.id===id);return 'Compra: '+(c?.titulo||id)}return 'Obra · vínculo anterior'}
  function mapa(){M.validar(o.fmArquivosMetadados);return o.fmArquivosMetadados}
  function atualizarChips(){
    chips.replaceChildren();for(const categoria of ['',...M.categorias(mapa())]){const b=fmDocumentosBotao(categoria||'Todas',()=>{filtrosAtuais.categoria=categoria;pintar()},'');b.setAttribute('aria-pressed',String(categoria===filtrosAtuais.categoria));chips.appendChild(b)}
    situacoes.replaceChildren();for(const [valor,titulo] of [[false,'Em acompanhamento'],[true,'Arquivados']]){const b=fmDocumentosBotao(titulo,()=>{filtrosAtuais.arquivados=valor;pintar()},'');b.setAttribute('aria-pressed',String(valor===filtrosAtuais.arquivados));situacoes.appendChild(b)}
  }
  function conferirObra(){if(!E.obras.includes(o))throw Error('Esta obra foi atualizada. Reabra a ficha para continuar.')}
  function editar(a){
    if(editor){notificar('Salve ou cancele a classificação em edição.');return}
    const base=fmDocumentosBase(o),meta=M.metadados(mapa(),a.id),form=el('<form class="fmdoc-editor"></form>');
    form.appendChild(el('<h4>Classificar arquivo</h4>'));const nome=el('<p class="fmdoc-editor-nome"></p>');nome.textContent=a.nome;form.appendChild(nome);
    const grade=el('<div class="fmdoc-editor-grade"></div>');const categoria=fmDocumentosCampo('categoria','Categoria',meta.categoria);fmDocumentosSugestoes(categoria,mapa());
    grade.append(categoria,fmDocumentosCampo('titulo','Título de exibição',meta.titulo),fmDocumentosCampo('revisao','Revisão',meta.revisao),fmDocumentosCampo('dataDocumento','Data do documento',meta.dataDocumento,'date'));
    const anterior=el('<label class="fmdoc-campo"><span>Versão anterior deste documento</span><select name="versaoAnteriorId"></select></label>'),seletor=anterior.querySelector('select');
    const opVazio=el('<option value="">Sem vínculo com versão anterior</option>');seletor.appendChild(opVazio);
    const candidatos=arquivos.filter(x=>x.id!==a.id);for(const x of candidatos){const op=el('<option></option>');op.value=x.id;op.textContent=(M.metadados(mapa(),x.id).titulo||x.nome)+' · '+(M.metadados(mapa(),x.id).revisao||'Sem revisão');if(x.id===meta.versaoAnteriorId)op.setAttribute('selected','');seletor.appendChild(op)}
    if(meta.versaoAnteriorId&&!candidatos.some(x=>x.id===meta.versaoAnteriorId)){const op=el('<option selected></option>');op.value=meta.versaoAnteriorId;op.textContent='Versão anterior indisponível nesta consulta';seletor.appendChild(op)}else if(!meta.versaoAnteriorId)opVazio.setAttribute('selected','');
    grade.appendChild(anterior);form.append(fmDocumentosCategoriaRapida(categoria),grade,fmDocumentosCampo('descricao','Descrição',meta.descricao,'textarea'));const notaVersoes=el('<p class="fmdoc-versao-nota">Cada versão mantém seu arquivo original. O vínculo organiza a sequência sem substituir conteúdo.</p>');form.appendChild(notaVersoes);const e=el('<p class="fmdoc-erro" role="alert" hidden></p>'),acoes=el('<div class="fmdoc-acoes"></div>');
    const submit=el('<button type="submit" class="btn">Salvar classificação</button>');
    const ler=()=>Object.fromEntries(['categoria','titulo','descricao','revisao','dataDocumento','versaoAnteriorId'].map(k=>[k,form.querySelector('[name='+k+']').value]));const inicial=JSON.stringify(ler());
    const fechar=()=>{sec._fmDirty=false;editor=null;edicao.replaceChildren();pintar()};
    acoes.append(submit,fmDocumentosBotao('Cancelar',()=>{if(!sec._fmDirty||confirm('Descartar a classificação não salva?'))fechar()}));form.append(e,acoes);
    const marcou=()=>{sec._fmDirty=JSON.stringify(ler())!==inicial};form.addEventListener('input',marcou);form.addEventListener('change',marcou);
    form.onsubmit=evento=>{evento.preventDefault();e.hidden=true;try{fmDocumentosGravar(o,a.id,ler(),base)}catch(ex){e.textContent=ex.message;e.hidden=false;sec._fmDirty=true;return}fechar();notificar(salvarMensagem)};
    editor=form;edicao.replaceChildren(form);form.querySelector('[name=categoria]').focus();pintar();
  }
  async function abrir(a,baixar){
    let janela;if(!baixar){janela=window.open('','_blank');if(!janela){erro('Permita a abertura de uma nova aba no navegador e tente abrir o arquivo novamente. Seu rascunho continua aqui.');return}janela.opener=null}
    try{const url=await arqUrlDe(a.id,baixar),u=new URL(url);if(!['https:','http:','blob:'].includes(u.protocol)||u.username||u.password)throw Error('Endereço de arquivo inválido.');
      if(baixar){const link=el('<a target="_blank" rel="noopener noreferrer"></a>');link.href=u.href;link.download=a.nome;document.body.appendChild(link);link.click();link.remove()}else janela.location=u.href}
    catch(e){if(janela)janela.close();erro('Não foi possível '+(baixar?'baixar':'abrir')+' este arquivo. Confira a conexão e tente novamente.')}
  }
  function pintar(){
    let m;try{m=mapa()}catch(e){erro('Não foi possível ler a classificação dos documentos. Os arquivos anteriores foram preservados.');solta.disabled=true;pdf.disabled=true;return}
    atualizarChips();visiveis=M.filtrar(arquivos,m,filtrosAtuais);corpo.replaceChildren();
    if(!visiveis.length){const vazio=el('<p class="fmdoc-vazio"></p>');vazio.textContent=carregando?'Carregando…':(!nuvemDisponivel||!localDisponivel)?'Os arquivos disponíveis aparecerão aqui quando a consulta puder ser concluída.':arquivos.length?'Nenhum arquivo corresponde aos filtros.':'Nenhum arquivo anexado à obra ainda.';corpo.appendChild(vazio)}
    for(const a of visiveis){
      const meta=a.meta,item=el('<article class="fmdoc-item"><div class="fmdoc-item-texto"><h4></h4><p class="fmdoc-item-nome"></p><p class="fmdoc-item-meta"></p><p class="fmdoc-item-descricao"></p></div><div class="fmdoc-item-acoes"></div></article>');item.dataset.arquivoId=a.id;
      item.querySelector('h4').textContent=meta.titulo||a.nome;const nome=item.querySelector('.fmdoc-item-nome');nome.textContent=meta.titulo?a.nome:'';nome.hidden=!meta.titulo;
      item.querySelector('.fmdoc-item-meta').textContent=[meta.categoria||'Sem categoria',meta.revisao?'Revisão '+meta.revisao:'',meta.dataDocumento?'Documento de '+fmtDataAno(meta.dataDocumento):'',a.em?'Anexado em '+fmtDataAno(a.em):'',a.origem,tamanho(a.tam||0),a.tipo||'Tipo não informado',a.pendente?'Pendente · neste aparelho':'Na nuvem'].filter(Boolean).join(' · ');
      const descricao=item.querySelector('.fmdoc-item-descricao');descricao.textContent=meta.descricao||'';descricao.hidden=!meta.descricao;
      const acoes=item.querySelector('.fmdoc-item-acoes');const podeAbrir=/^(application\/pdf|image\/(png|jpeg|webp|gif|bmp))$/i.test(a.tipo||'');
      if(podeAbrir){const b=fmDocumentosBotao('Abrir',()=>abrir(a,false));b.classList.add('fmdoc-abrir');b.setAttribute('aria-label','Abrir '+a.nome);acoes.appendChild(b)}
      else{const nota=el('<small class="fmdoc-formato"></small>');nota.textContent='Disponível para baixar';acoes.appendChild(nota)}
      const baixar=fmDocumentosBotao('Baixar',()=>abrir(a,true));baixar.classList.add('fmdoc-baixar');baixar.setAttribute('aria-label','Baixar '+a.nome);
      const classificar=fmDocumentosBotao('Classificar',()=>editar(a));classificar.setAttribute('aria-label','Classificar '+a.nome);classificar.disabled=!!editor||enviando;
      const arquivar=fmDocumentosBotao(meta.arquivado?'Desarquivar':'Arquivar',()=>{try{conferirObra();fmDocumentosGravar(o,a.id,{arquivado:!meta.arquivado});notificar(salvarMensagem);pintar()}catch(e){erro(e.message)}});arquivar.setAttribute('aria-label',(meta.arquivado?'Desarquivar ':'Arquivar ')+a.nome);arquivar.disabled=!!editor||enviando;
      acoes.append(baixar,classificar,arquivar);
      if(meta.versaoAnteriorId){const anterior=arquivos.find(x=>x.id===meta.versaoAnteriorId),nota=el('<p class="fmdoc-versao-nota"></p>');nota.textContent=anterior?'Versão anterior: '+(M.metadados(m,anterior.id).titulo||anterior.nome):'Versão anterior indisponível nesta consulta';item.querySelector('.fmdoc-item-texto').appendChild(nota);if(anterior){const abre=/^(application\/pdf|image\/(png|jpeg|webp|gif|bmp))$/i.test(anterior.tipo||'');acoes.appendChild(fmDocumentosBotao(abre?'Abrir versão anterior':'Baixar versão anterior',()=>abrir(anterior,!abre)))}}
      corpo.appendChild(item);
    }
    pdf.disabled=carregando||!!editor||enviando||!visiveis.length;refresh.disabled=enviando||!!editor;solta.disabled=enviando||!!editor;inp.disabled=solta.disabled;categoriaUpload.querySelector('input').disabled=solta.disabled;
    pendentes.hidden=!arquivos.some(a=>a.pendente);pendentes.disabled=enviando||!!editor||carregando;
    contador.textContent=visiveis.length+' arquivo(s) nesta visão'+(filtrosAtuais.arquivados?' · arquivados':'');
  }
  async function atualizar(){
    if(editor){notificar('Salve ou cancele a classificação antes de atualizar.');return}
    const g=++geracao;carregando=true;pdf.disabled=true;refresh.disabled=true;pendentes.disabled=true;solta.disabled=true;inp.disabled=true;corpo.replaceChildren(el('<p>Carregando…</p>'));erro('');
    arqEsquecerIndice();let idx=null,locais=[];localDisponivel=true;
    const leituras=await Promise.allSettled([arqIndice(),todosArquivos()]);if(g!==geracao)return;
    if(leituras[0].status==='fulfilled')idx=leituras[0].value;
    if(leituras[1].status==='fulfilled')locais=leituras[1].value;else localDisponivel=false;
    nuvemDisponivel=!!idx;
    arquivos=M.agrupar(idx?[...idx.values()].flat():[],locais,o.id).map(a=>({...a,origem:origem(a)}));carregando=false;
    if(!nuvemDisponivel)erro('Não foi possível conferir os arquivos na nuvem. A lista mostra somente o que está disponível neste aparelho.');
    else if(!localDisponivel)erro('Não foi possível conferir os arquivos deste aparelho. A lista mostra somente os arquivos da nuvem.');
    pintar();return {arquivos,nuvemDisponivel};
  }
  async function receber(files){
    if(enviando||editor||!files.length)return;
    try{conferirObra();mapa()}catch(e){notificar(e.message);return}
    const categoria=categoriaUpload.querySelector('input').value.trim();if(categoria.length>80){notificar('A categoria deve ter até 80 caracteres.');return}
    enviando=true;sec._fmDirty=true;pintar();solta.setAttribute('aria-busy','true');solta.textContent='Enviando…';let enviados=0,semCategoria=0;const erros=[];
    for(const file of files){
      try{conferirObra();const reg=await arqAdd('obra:'+o.id,file);enviados++;if(categoria&&categoria!=='Sem categoria')try{fmDocumentosGravar(o,reg.id,{categoria})}catch(e){semCategoria++}}
      catch(e){erros.push(e.message||'Não foi possível anexar '+file.name)}
    }
    enviando=false;sec._fmDirty=false;solta.removeAttribute('aria-busy');solta.textContent='Adicionar arquivos';
    filtrosAtuais.categoria='';filtrosAtuais.busca='';filtrosAtuais.arquivados=false;busca.value='';
    await atualizar();notificar([enviados?enviados+' arquivo(s) anexado(s). Confira o estado de envio em cada arquivo.':'',categoria&&enviados&&!semCategoria?'Categoria salva neste navegador; acompanhe a sincronização no topo.':'',semCategoria?semCategoria+' arquivo(s) ficaram sem categoria porque não foi possível salvar a classificação. Classifique-os novamente.':'',erros.length?'Não foi possível anexar: '+erros.join(' · '):''].filter(Boolean).join(' '));
  }
  function exportar(){
    if(carregando||enviando){notificar('Aguarde: os documentos ainda estão carregando ou sendo enviados.');return false}
    if(editor){notificar('Salve ou cancele a classificação antes de gerar o índice.');return false}
    if(!visiveis.length){notificar('Nenhum documento disponível nesta visão para exportar.');return false}
    if(typeof fmPdfDocumentos!=='function'){erro('O índice PDF não está disponível. Atualize a página e tente novamente.');return false}
    return fmPdfDocumentos(o,visiveis,{nuvemDisponivel,localDisponivel,categoria:filtrosAtuais.categoria,busca:filtrosAtuais.busca,escopo:filtrosAtuais.arquivados?'Documentos arquivados':'Documentos em acompanhamento',filtro:[filtrosAtuais.categoria||'Todas as categorias',filtrosAtuais.busca?'Busca: '+filtrosAtuais.busca:''].filter(Boolean).join(' · ')});
  }
  const refresh=fmDocumentosBotao('Atualizar',()=>atualizar()),pdf=fmDocumentosBotao('Índice em PDF',exportar);
  const pendentes=fmDocumentosBotao('Enviar pendentes desta obra',async()=>{
    if(editor||enviando)return;enviando=true;sec._fmDirty=true;pintar();let falhaEnvio='';
    try{const r=await arqSubirPendentes(false,'obra:'+o.id);if(r.falhou)falhaEnvio='Alguns arquivos desta obra continuam pendentes neste aparelho. Tente novamente.';else notificar('Confira a lista atualizada para confirmar quais arquivos chegaram à nuvem.')}
    catch(e){falhaEnvio='Não foi possível concluir o envio dos arquivos pendentes desta obra.'}
    finally{enviando=false;sec._fmDirty=false;await atualizar();if(falhaEnvio)erro(falhaEnvio)}
  });pendentes.hidden=true;pendentes.title='Envia somente os anexos desta obra pendentes neste aparelho.';
  cab.querySelector('.fmdoc-acoes').append(refresh,pendentes,pdf);filtros.append(busca,situacoes,chips);
  upload.querySelector('.fmdoc-upload-campos').append(categoriaUpload,fmDocumentosCategoriaRapida(categoriaUpload));try{fmDocumentosSugestoes(categoriaUpload,mapa())}catch(e){}
  const solta=upload.querySelector('.fmdoc-solta'),inp=upload.querySelector('[name=arquivos]');solta.onclick=()=>inp.click();inp.onchange=()=>{receber([...inp.files]);inp.value=''};
  solta.addEventListener('dragover',e=>{e.preventDefault();solta.classList.add('fmdoc-sobre')});solta.addEventListener('dragleave',()=>solta.classList.remove('fmdoc-sobre'));solta.addEventListener('drop',e=>{e.preventDefault();solta.classList.remove('fmdoc-sobre');if(!solta.disabled)receber([...e.dataTransfer.files])});
  busca.oninput=()=>{filtrosAtuais.busca=busca.value;pintar()};
  sec.append(cab,aviso,falha,filtros,upload,edicao,contador,corpo);sec.atualizar=atualizar;sec.exportar=exportar;pdf.disabled=true;atualizar();return sec;
}
