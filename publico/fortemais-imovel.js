/* A ficha complementa a obra. Fotos mantêm ID/ref e os bytes no serviço de anexos. */
function fmImovelBase(o){return {estado:E,obraId:o.id,referencia:o.fmImovel,texto:JSON.stringify(o.fmImovel),tinha:Object.hasOwn(o,'fmImovel')}}
function fmImovelConferir(o,base){
  if(E!==base.estado||o.id!==base.obraId||!E.obras.includes(o)||o.fmImovel!==base.referencia||JSON.stringify(o.fmImovel)!==base.texto)
    throw Error('A ficha foi atualizada enquanto você editava. Seu rascunho foi mantido; confira os dados antes de reabrir a edição.');
}
function fmImovelGravar(o,dados,base=fmImovelBase(o)){
  fmImovelConferir(o,base);FortemaisImovelModelo.validar(dados);
  const mt=E._mt,tinhaMt=Object.hasOwn(E,'_mt');o.fmImovel=FortemaisImovelModelo.dados(dados);
  try{salvar()}catch(e){if(base.tinha)o.fmImovel=base.referencia;else delete o.fmImovel;if(tinhaMt)E._mt=mt;else delete E._mt;throw Error('Não foi possível salvar. Os dados anteriores e seu rascunho foram mantidos. Tente novamente.')}
  return o.fmImovel;
}
/* Resumo síncrono: fotos conta metadados ativos, não o inventário de anexos remoto. */
function fmImovelResumo(o){return FortemaisImovelModelo.resumo(o.fmImovel)}
function fmImovelBotao(texto,fn,classe='ghost'){const b=el('<button type="button" class="btn"></button>');b.textContent=texto;if(classe)b.classList.add(classe);b.onclick=fn;return b}
function fmImovelCampo(nome,rotulo,valor='',tipo='text',opcoes=[]){
  const M=FortemaisImovelModelo,c=el('<label class="fmim-campo"><span></span></label>');c.firstElementChild.textContent=rotulo;
  const i=document.createElement(tipo==='textarea'?'textarea':tipo==='select'?'select':'input');i.name=nome;
  if(tipo==='select')for(const [v,t] of opcoes){const op=document.createElement('option');op.value=v;op.textContent=t;i.appendChild(op)}
  else if(tipo==='textarea')i.rows=3;else i.type=tipo;
  if(tipo==='select'){[...i.options].find(op=>op.value===String(valor??''))?.setAttribute('selected','')}else i.value=valor??'';if(tipo==='number'){i.min='0';i.max='999';i.step='1';i.inputMode='numeric';i.placeholder='Não informado'}
  if(M.TEXTOS[nome]||M.FOTO_TEXTOS[nome])i.maxLength=M.TEXTOS[nome]||M.FOTO_TEXTOS[nome];c.appendChild(i);return c;
}
function fmImovelUrl(url){const u=new URL(url);if(!['http:','https:','blob:'].includes(u.protocol)||u.username||u.password)throw Error('Endereço da imagem inválido.');return u.href}
function fmImovelPainel(o){
  const M=FortemaisImovelModelo,sec=el('<section class="fmim-painel" aria-label="Fotos e descrição do imóvel"></section>');sec._fmDirty=false;
  const rotulos={responsavel:'Responsável pela obra',quartos:'Quartos',suites:'Suítes',banheiros:'Banheiros',vagas:'Vagas',ambientes:'Ambientes',acabamentos:'Acabamentos',diferenciais:'Diferenciais',descricaoComercial:'Descrição comercial',observacoesInternas:'Observações internas'};
  const cab=el('<header class="fmim-cab"><div><h3>Fotos e descrição</h3><p>Cadastro do imóvel e registro visual da obra.</p></div></header>');
  const aviso=el('<p class="fmim-aviso" role="status" hidden></p>'),falha=el('<p class="fmim-erro" role="alert" hidden></p>');
  const cadastro=el('<section class="fmim-cadastro"><div class="fmim-cab"><h3>Características do imóvel</h3><div class="fmim-acoes"></div></div><dl class="fmim-ficha"></dl><details class="fmim-textos"><summary>Descrição e detalhes</summary><dl class="fmim-ficha"></dl></details></section>');
  const edicao=el('<div class="fmim-edicao"></div>');
  const galeria=el('<section class="fmim-galeria"><div class="fmim-cab"><div><h3>Galeria da obra</h3><p>Fotos originais, projetos e material de divulgação.</p></div><div class="fmim-acoes"></div></div></section>');
  const filtros=el('<div class="fmim-filtros" role="group" aria-label="Situação das fotos"></div>');
  const upload=el('<div class="fmim-upload"><div class="fmim-grade"></div><div class="fmim-acoes"></div><input type="file" name="fotosUpload" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" multiple hidden><small class="fmim-nota">JPEG, PNG, WebP, GIF ou BMP. Até 25 MB por arquivo. Os originais são preservados.</small></div>');
  upload.querySelector('.fmim-grade').append(fmImovelCampo('tipoUpload','Tipo das novas imagens','','select',[['','Não informado'],...Object.entries(M.TIPOS)]),fmImovelCampo('usoUpload','Uso das novas imagens','','select',[['','Não informado'],...Object.entries(M.USOS)]));
  const contador=el('<p class="fmim-nota" role="status"></p>'),fotos=el('<div class="fmim-fotos" aria-live="polite"></div>');
  let arquivos=[],carregando=true,enviando=false,editor=null,pendente=null,retornoEditor=null,geracao=0,render=0,arquivados=false,nuvemDisponivel=false,localDisponivel=false;
  const urls=new Set();
  const avisar=t=>{aviso.textContent=t;aviso.hidden=!t},erro=t=>{falha.textContent=t;falha.hidden=!t};
  const salvo='Salvo neste navegador. Acompanhe a sincronização no topo da Central.';
  const ocupado=()=>!!editor||enviando||!!pendente;
  const marcar=()=>{sec._fmDirty=enviando||!!pendente||!!(editor&&editor._alterado)};
  function conferir(){if(!E.obras.includes(o))throw Error('Esta obra foi atualizada. Reabra a ficha para continuar.');return M.dados(o.fmImovel)}
  function liberarUrls(){for(const url of urls){if(url.startsWith('blob:')&&typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(url)}urls.clear()}
  function linha(dl,titulo,valor,largo=false){const c=el('<div><dt></dt><dd></dd></div>');if(largo)c.classList.add('fmim-largo');c.firstElementChild.textContent=titulo;c.lastElementChild.textContent=valor===undefined||valor===null||valor===''?'Não informado':String(valor);dl.appendChild(c)}
  function ficha(){
    let d;try{d=conferir()}catch(e){erro(e.message);return}
    const dl=cadastro.querySelector('dl');dl.replaceChildren();
    linha(dl,'Endereço',o.endereco,true);linha(dl,'Lote',o.lote);linha(dl,'Quadra',o.quadra);
    const metros=v=>v===undefined||v===null||v===''||Number(v)===0?'Não informado':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2})+' m²';
    linha(dl,'Área construída',metros(o.area));linha(dl,'Área do terreno',metros(o.areaTerreno));linha(dl,'Início',o.inicio?fmtDataAno(o.inicio):null);linha(dl,'Conclusão prevista',o.fim?fmtDataAno(o.fim):null);
    const textos=cadastro.querySelector('.fmim-textos dl');textos.replaceChildren();for(const [k,t] of Object.entries(rotulos))linha(k==='responsavel'||M.NUMEROS.includes(k)?dl:textos,t,d[k],!M.NUMEROS.includes(k));
    editarCadastro.disabled=ocupado();editarBase.disabled=ocupado();
  }
  function fecharEditor(){const retorno=retornoEditor;editor=null;retornoEditor=null;edicao.replaceChildren();marcar();ficha();pintar();retorno?.()?.focus({preventScroll:true})}
  function formulario(titulo,campos,ler,gravar){
    if(ocupado()){avisar('Salve ou cancele a edição em andamento.');return null}
    const f=el('<form class="fmim-editor"></form>'),h=el('<h4></h4>'),e=el('<p class="fmim-erro" role="alert" hidden></p>'),ac=el('<div class="fmim-acoes"></div>');h.textContent=titulo;f.append(h,campos,e,ac);
    const salvarBotao=el('<button type="submit" class="btn">Salvar alterações</button>');
    ac.append(salvarBotao,fmImovelBotao('Cancelar',()=>{if(!f._alterado||confirm('Descartar as alterações não salvas?'))fecharEditor()}));
    const inicial=JSON.stringify(ler(f));f._alterado=false;const mudou=()=>{f._alterado=JSON.stringify(ler(f))!==inicial;marcar()};f.addEventListener('input',mudou);f.addEventListener('change',mudou);
    f.onsubmit=ev=>{ev.preventDefault();e.hidden=true;try{gravar(ler(f))}catch(ex){e.textContent=ex.message;e.hidden=false;e.tabIndex=-1;e.focus();f._alterado=true;marcar();return}fecharEditor();avisar(salvo)};
    editor=f;edicao.replaceChildren(f);f.querySelector('input,textarea,select')?.focus();ficha();pintar();return f;
  }
  function editarDados(){
    let d;try{d=conferir()}catch(e){erro(e.message);return}const base=fmImovelBase(o),campos=el('<div class="fmim-grade"></div>');
    const numeros=el('<fieldset class="fmim-numeros"><legend>Composição do imóvel</legend><div></div></fieldset>');
    for(const [k,t] of Object.entries(rotulos)){const c=fmImovelCampo(k,t,d[k],M.NUMEROS.includes(k)?'number':k==='responsavel'?'text':'textarea');if(M.NUMEROS.includes(k))numeros.lastElementChild.appendChild(c);else{if(k==='responsavel')c.classList.add('fmim-largo');campos.appendChild(c);if(k==='responsavel')campos.appendChild(numeros)}}
    if(formulario('Editar características e descrição',campos,f=>Object.fromEntries(Object.keys(rotulos).map(k=>[k,f.querySelector('[name='+k+']').value])),v=>fmImovelGravar(o,M.cadastro(base.referencia,v),base)))retornoEditor=()=>editarCadastro;
  }
  function editarFoto(a){
    let d;try{d=conferir()}catch(e){erro(e.message);return}const m=d.fotos?.[a.id]||{},base=fmImovelBase(o),campos=el('<div class="fmim-grade"></div>');
    const nota=el('<p class="fmim-nota fmim-largo"></p>');nota.textContent=a.nome;campos.appendChild(nota);
    for(const [k,t] of [['legenda','Legenda'],['data','Data da imagem'],['etapa','Etapa'],['ambiente','Ambiente']])campos.appendChild(fmImovelCampo(k,t,m[k],k==='data'?'date':k==='legenda'?'textarea':'text'));
    campos.append(fmImovelCampo('tipo','Tipo da imagem',m.tipo,'select',[['','Não informado'],...Object.entries(M.TIPOS)]),fmImovelCampo('uso','Uso da imagem',m.uso,'select',[['','Não informado'],...Object.entries(M.USOS)]));
    const ler=f=>Object.fromEntries(['legenda','data','etapa','ambiente','tipo','uso'].map(k=>[k,f.querySelector('[name='+k+']').value]));
    if(formulario('Classificar imagem',campos,ler,v=>fmImovelGravar(o,M.foto(base.referencia,a.id,v),base)))retornoEditor=()=>[...fotos.querySelectorAll('[data-foto-id]')].find(x=>x.dataset.fotoId===a.id)?.querySelector('.fmim-classificar');
  }
  async function abrir(a,baixar){
    let janela;if(!baixar){janela=window.open('','_blank');if(!janela){erro('Permita a abertura de uma nova aba e tente novamente. Seu rascunho continua aqui.');return}janela.opener=null}
    try{const u=fmImovelUrl(await arqUrlDe(a.id,baixar));if(baixar){const link=el('<a target="_blank" rel="noopener noreferrer"></a>');link.href=u;link.download=a.nome;document.body.appendChild(link);link.click();link.remove()}else janela.location=u}
    catch(e){if(janela)janela.close();erro('Não foi possível '+(baixar?'baixar':'abrir')+' a imagem. Confira a conexão e tente novamente.')}
  }
  async function miniatura(a,no,g){
    let url;
    try{url=fmImovelUrl(await arqUrlDe(a.id,false));if(g!==render||!no.isConnected){if(url.startsWith('blob:')&&typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(url);return}
      urls.add(url);const img=el('<img loading="lazy" decoding="async">');img.alt=a.meta.legenda||a.nome;img.referrerPolicy='no-referrer';img.onerror=()=>{if(g===render)no.replaceChildren(el('<span>Prévia indisponível. Use Abrir ou Baixar.</span>'))};img.src=url;no.replaceChildren(img);
    }catch(e){if(g===render&&no.isConnected)no.replaceChildren(el('<span>Prévia indisponível. Use Abrir ou Baixar.</span>'))}
  }
  function pintar(){
    let d;try{d=conferir()}catch(e){erro(e.message);adicionar.disabled=true;return}render++;liberarUrls();const g=render;
    const visiveis=arquivos.map(a=>({...a,meta:d.fotos?.[a.id]||{}})).filter(a=>!!a.meta.arquivado===arquivados).sort((a,b)=>(b.id===d.capaId?1:0)-(a.id===d.capaId?1:0));
    filtros.replaceChildren();for(const [v,t] of [[false,'Ativas'],[true,'Arquivadas']]){const b=fmImovelBotao(t,()=>{arquivados=v;pintar()});b.setAttribute('aria-pressed',String(v===arquivados));filtros.appendChild(b)}
    fotos.replaceChildren();
    if(!visiveis.length){const p=el('<p class="fmim-nota"></p>');p.textContent=carregando?'Carregando imagens…':!nuvemDisponivel||!localDisponivel?'A consulta está incompleta. As imagens disponíveis aparecerão aqui.':arquivados?'Nenhuma imagem arquivada.':'Nenhuma imagem anexada à obra ainda.';fotos.appendChild(p)}
    for(const a of visiveis){const m=a.meta,item=el('<article class="fmim-foto"><div class="fmim-miniatura"><span>Carregando prévia…</span></div><div class="fmim-foto-corpo"><h4></h4><p class="fmim-foto-classificacao"></p><p class="fmim-foto-contexto"></p><p class="fmim-foto-estado fmim-nota"></p><div class="fmim-acoes"></div></div></article>');item.dataset.fotoId=a.id;
      item.querySelector('h4').textContent=m.legenda||a.nome;item.querySelector('.fmim-foto-classificacao').textContent=[M.TIPOS[m.tipo]||'Tipo não informado',M.USOS[m.uso]||'Uso não informado'].join(' · ');
      item.querySelector('.fmim-foto-contexto').textContent=[m.data?'Imagem de '+fmtDataAno(m.data):'',m.etapa?'Etapa: '+m.etapa:'',m.ambiente?'Ambiente: '+m.ambiente:''].filter(Boolean).join(' · ');
      item.querySelector('.fmim-foto-estado').textContent=[a.nome,a.em?'Anexada em '+fmtDataAno(a.em):'',a.envioAConferir?'Envio a conferir':a.pendente?'Pendente · neste aparelho':'Na nuvem'].filter(Boolean).join(' · ');
      if(a.id===d.capaId){const selo=el('<span class="fmim-selo">Capa da obra</span>');item.querySelector('.fmim-foto-corpo').prepend(selo)}
      const ac=item.querySelector('.fmim-acoes');for(const [titulo,fn,mutacao] of [['Abrir',()=>abrir(a,false),false],['Baixar original',()=>abrir(a,true),false],['Classificar',()=>editarFoto(a),true],...(!m.arquivado?[[a.id===d.capaId?'Remover capa':'Usar como capa',()=>{try{conferir();fmImovelGravar(o,M.capa(o.fmImovel,a.id===d.capaId?null:a.id));avisar(salvo);pintar()}catch(e){erro(e.message)}},true]]:[]),[m.arquivado?'Desarquivar':'Arquivar',()=>{try{conferir();fmImovelGravar(o,M.foto(o.fmImovel,a.id,{arquivado:!m.arquivado}));avisar(salvo);pintar()}catch(e){erro(e.message)}},true]]){const b=fmImovelBotao(titulo,fn);if(titulo==='Classificar')b.classList.add('fmim-classificar');b.disabled=mutacao&&ocupado();b.setAttribute('aria-label',titulo+' '+a.nome);ac.appendChild(b)}
      fotos.appendChild(item);miniatura(a,item.querySelector('.fmim-miniatura'),g);
    }
    contador.textContent=carregando?'Consultando arquivos…':visiveis.length+' imagem(ns) '+(arquivados?'arquivada(s)':'nesta visão')+(!nuvemDisponivel||!localDisponivel?' · consulta incompleta':'');
    atualizarBotao.disabled=ocupado()||carregando;adicionar.disabled=ocupado()||carregando;adicionar.textContent=enviando?'Enviando imagens…':'Adicionar imagens';adicionar.setAttribute('aria-busy',String(enviando));inp.disabled=adicionar.disabled;for(const i of upload.querySelectorAll('select'))i.disabled=adicionar.disabled;
    enviarPendentes.hidden=!arquivos.some(a=>a.pendente);enviarPendentes.disabled=ocupado()||carregando;ficha();
  }
  async function atualizar(){
    if(ocupado()){avisar('Salve ou cancele a edição em andamento antes de atualizar.');return}
    const g=++geracao;carregando=true;pintar();erro('');arqEsquecerIndice();
    const r=await Promise.allSettled([arqIndice(),todosArquivos()]);if(g!==geracao)return;
    const idx=r[0].status==='fulfilled'?r[0].value:null,locais=r[1].status==='fulfilled'?r[1].value:[];nuvemDisponivel=!!idx;localDisponivel=r[1].status==='fulfilled';
    arquivos=M.agrupar(idx?[...idx.values()].flat():[],locais,o.id);carregando=false;
    if(!nuvemDisponivel)erro('Não foi possível conferir as imagens na nuvem. A galeria mostra somente os arquivos disponíveis neste aparelho.');
    else if(!localDisponivel)erro('Não foi possível conferir as imagens deste aparelho. A galeria mostra somente os arquivos da nuvem.');
    pintar();return {arquivos,nuvemDisponivel,localDisponivel};
  }
  function mostrarPendente(){
    const f=el('<div class="fmim-editor"><h4>Classificação das imagens pendente</h4><p class="fmim-nota"></p><div class="fmim-acoes"></div><p class="fmim-erro" role="alert"></p></div>');
    f.querySelector('.fmim-nota').textContent='Os arquivos anexados foram preservados. '+pendente.ids.length+' imagem(ns) aguardam a classificação escolhida no envio.';f.querySelector('[role=alert]').textContent=pendente.erro;
    f.querySelector('.fmim-acoes').append(fmImovelBotao('Tentar salvar classificação',async()=>{try{fmImovelGravar(o,pendente.dados,pendente.base)}catch(e){f.querySelector('[role=alert]').textContent=e.message;return}pendente=null;edicao.replaceChildren();marcar();await atualizar();avisar(salvo)}),fmImovelBotao('Manter arquivos sem esta classificação',async()=>{if(!confirm('Descartar somente a classificação pendente? Os arquivos originais continuam anexados.'))return;pendente=null;edicao.replaceChildren();marcar();await atualizar();avisar('Arquivos preservados. Classifique cada imagem pela galeria.')}));
    edicao.replaceChildren(f);marcar();pintar();
  }
  async function receber(lista){
    if(ocupado()||carregando||!lista.length)return;
    let base,d;try{d=conferir();base=fmImovelBase(o)}catch(e){erro(e.message);return}
    const tipo=upload.querySelector('[name=tipoUpload]').value,uso=upload.querySelector('[name=usoUpload]').value,ids=[],erros=[];enviando=true;marcar();pintar();
    for(const file of lista){
      try{fmImovelConferir(o,base);if(!M.imagemSegura({tipo:file.type}))throw Error(file.name+': use JPEG, PNG, WebP, GIF ou BMP.');if(file.size>25*1024*1024)throw Error(file.name+': o limite é 25 MB por arquivo.');
        const a=await arqAdd('obra:'+o.id,file);ids.push(a.id);if(!arquivos.some(x=>x.id===a.id))arquivos.push({...a,envioAConferir:true});d=M.foto(d,a.id,{tipo,uso});
      }catch(e){erros.push(e.message||'Não foi possível anexar '+file.name)}
    }
    if(ids.length)try{fmImovelGravar(o,d,base)}catch(e){pendente={dados:d,base,ids,erro:e.message}}
    enviando=false;marcar();arquivados=false;
    if(pendente){mostrarPendente();avisar([ids.length+' arquivo(s) anexado(s). A classificação ainda não foi salva.',...erros].join(' '));return}
    await atualizar();avisar([ids.length?ids.length+' imagem(ns) anexada(s). '+salvo:'',...erros].join(' '));
  }
  const editarCadastro=fmImovelBotao('Editar características',editarDados),editarBase=fmImovelBotao('Editar cadastro da obra',()=>{if(ocupado()){avisar('Salve ou cancele a edição em andamento.');return}fmObraEditar(o)});
  cadastro.querySelector('.fmim-acoes').append(editarCadastro,editarBase);
  const atualizarBotao=fmImovelBotao('Atualizar galeria',()=>atualizar()),enviarPendentes=fmImovelBotao('Enviar pendentes desta obra',async()=>{
    if(ocupado())return;enviando=true;marcar();pintar();let mensagem='';
    try{const r=await arqSubirPendentes(false,'obra:'+o.id);if(r.falhou)mensagem='Alguns arquivos continuam pendentes neste aparelho. Tente novamente.'}
    catch(e){mensagem='Não foi possível concluir o envio dos arquivos pendentes desta obra.'}
    finally{enviando=false;marcar();await atualizar();if(mensagem)erro(mensagem)}
  });enviarPendentes.hidden=true;galeria.querySelector('.fmim-cab>.fmim-acoes').append(atualizarBotao,enviarPendentes);
  const adicionar=fmImovelBotao('Adicionar imagens',()=>inp.click()),inp=upload.querySelector('[name=fotosUpload]');upload.querySelector('.fmim-acoes').appendChild(adicionar);
  inp.onchange=()=>{receber([...inp.files]);inp.value=''};adicionar.addEventListener('dragover',e=>e.preventDefault());adicionar.addEventListener('drop',e=>{e.preventDefault();if(!adicionar.disabled)receber([...e.dataTransfer.files])});
  galeria.append(filtros,upload,contador,fotos);sec.append(cab,aviso,falha,cadastro,edicao,galeria);sec.atualizar=atualizar;sec.receber=receber;sec.descartar=()=>{geracao++;render++;liberarUrls()};sec._fmDispose=sec.descartar;atualizar();return sec;
}
