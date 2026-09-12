/* Pacotes extraídos fora do site público. Nada é aplicado sem revisão por item. */
function docTexto(v,max=30000){return String(v??'').slice(0,max).trim()}
function docFonteChave(f){const raw=devURL(f.url);if(!raw)return 'id:'+docTexto(f.id);const u=new URL(raw),google=['drive.google.com','docs.google.com'].includes(u.hostname),id=google&&(u.pathname.match(/\/(?:d|folders)\/([^/?#]+)/)?.[1]||u.searchParams.get('id'));return id?'drive:'+id:u.origin+u.pathname+u.search}
function docValorChave(v){const t=docTexto(v,120);return /^[+-]?\d+(?:[.,]\d+)?$/.test(t)?String(Number(t.replace(',','.'))):normaliza(t)}
function docPacote(p){
  if(!p||p.schema!=='central-leo.documentos.v1'||!Array.isArray(p.fontes)||!Array.isArray(p.itens))throw Error('Este arquivo não é uma revisão de documentos da Central.');
  if(p.fontes.length>500||p.itens.length>3000)throw Error('Divida a revisão em arquivos menores.');
  const ids=new Set(),fontes=p.fontes.map(f=>{
    if(!f||!['saude','comportamento'].includes(f.grupo)||!docTexto(f.id)||!docTexto(f.titulo))throw Error('Há uma fonte sem identificação.');
    if(String(f.id).length>160||ids.has(docTexto(f.id)))throw Error('Há fontes com identificação inválida ou repetida.');ids.add(docTexto(f.id));
    if(f.url&&!devURL(f.url))throw Error('A fonte deve ter um link HTTPS válido.');
    if(f.dataDocumento&&!dataISOValida(f.dataDocumento))throw Error('Confira a data da fonte '+f.titulo+'.');
    const x={id:docTexto(f.id,160),grupo:f.grupo,titulo:docTexto(f.titulo,300),tipo:docTexto(f.tipo,100),url:devURL(f.url)||'',dataDocumento:docTexto(f.dataDocumento,10),atualizadoEm:docTexto(f.atualizadoEm,40),resumo:docTexto(f.resumo),limites:docTexto(f.limites),lido:f.lido===true,paginas:docTexto(f.paginas,100),versao:docTexto(f.versao,120),metodoLeitura:docTexto(f.metodoLeitura,500),hashTexto:docTexto(f.hashTexto,128)};
    for(const k of ['disc','lideranca'])if(f[k]&&typeof f[k]==='object'&&!Array.isArray(f[k])){
      const dados=JSON.parse(JSON.stringify(f[k]));if(JSON.stringify(dados).length>5000)throw Error('Avaliação muito extensa.');x[k]=dados;
    }
    if(x.disc){if(Object.keys(x.disc).some(k=>!['natural','adaptado'].includes(k)))throw Error('Perfil DISC inválido.');for(const [perfil,dados] of Object.entries(x.disc)){if(!dados||typeof dados!=='object'||Array.isArray(dados)||!Object.keys(dados).length)throw Error('Perfil DISC inválido.');for(const [k,n] of Object.entries(dados))if(!['D','I','S','C'].includes(k)||!Number.isFinite(n)||n<0||n>100)throw Error('Pontuação DISC inválida.')}}
    if(x.lideranca)for(const [k,n] of Object.entries(x.lideranca))if(!['Executivo','Metódico','Motivador','Sistemático'].includes(k)||!Number.isFinite(n)||n<0||n>100)throw Error('Pontuação de liderança inválida.');
    return x;
  });
  const vistos=new Set();const itens=p.itens.map(i=>{
    if(!i||!['exame','peso','leitura','registroSaude'].includes(i.tipo)||!docTexto(i.id)||String(i.id).length>180||vistos.has(docTexto(i.id)))throw Error('Há itens sem identificação ou repetidos.');vistos.add(docTexto(i.id));
    const fonte=fontes.find(f=>f.id===docTexto(i.fonteId));if(!fonte||!fonte.lido)throw Error('Todo item precisa de uma fonte que foi lida.');
    if((i.tipo==='leitura')!==(fonte.grupo==='comportamento'))throw Error('O destino do item não corresponde à fonte.');
    if(i.data&&(!dataISOValida(i.data)||i.data>hoje()))throw Error('Confira a data do registro '+(i.titulo||i.exame||i.id)+'.');
    const x={id:docTexto(i.id,180),tipo:i.tipo,fonteId:fonte.id,pagina:docTexto(i.pagina,100),data:docTexto(i.data,10),titulo:docTexto(i.titulo||i.exame,300),texto:docTexto(i.texto),limites:docTexto(i.limites)};
    if(['exame','peso'].includes(i.tipo)){
      if(!x.data||i.valor==null||docTexto(i.valor)==='')throw Error('Medições precisam de data e resultado.');
      if(!['string','number'].includes(typeof i.valor)||typeof i.valor==='number'&&!Number.isFinite(i.valor))throw Error('Resultado inválido.');
      Object.assign(x,{exame:docTexto(i.exame||i.titulo,180),valor:docTexto(i.valor,120),unidade:docTexto(i.unidade,80),referencia:docTexto(i.referencia,1000)});
      if(i.tipo==='peso'&&(!Number.isFinite(numeroResultadoSaude(x.valor))||numeroResultadoSaude(x.valor)<=0||normaliza(x.unidade)!=='kg'))throw Error('Peso precisa de número positivo e unidade kg.');
      if(i.tipo==='exame'&&!x.exame)throw Error('Identifique o marcador do exame.');
    }else if(!x.titulo||!x.texto)throw Error('Complete o título e o conteúdo da leitura.');
    if(i.tipo==='leitura')Object.assign(x,{area:docTexto(i.area,100)||'Pessoal',tipoLeitura:docTexto(i.tipoLeitura,100)||'Leitura documental',pergunta:docTexto(i.pergunta,2000),passo:docTexto(i.passo,3000),medida:docTexto(i.medida,2000)});
    return x;
  });
  return {schema:p.schema,geradoEm:docTexto(p.geradoEm,40),fontes,itens};
}
function docPlano(p,estado=E){
  const acervo=estado.acervoDocumental||[],dev=estado.desenvolvimento||{},fontes=p.fontes.map(f=>{
    const existe=acervo.find(a=>a.pacoteFonteId===f.id&&a.versao===f.versao)&&(f.grupo!=='comportamento'||(dev.fontes||[]).some(x=>docFonteChave(x)===docFonteChave(f)));
    return {key:'fonte:'+f.id,tipo:'fonte',dado:f,status:existe?'existente':'novo',motivo:existe?'Esta leitura da fonte já está guardada.':f.lido?(f.grupo==='comportamento'&&(dev.fontes||[]).some(x=>docFonteChave(x)===docFonteChave(f))?'Guardar esta revisão, completar campos vazios da fonte e marcar como lida. Suas anotações atuais serão preservadas.':'Guardar referência e leitura do documento.'):'Guardar somente referência: conteúdo ainda não lido.'};
  });
  const assinaturas=new Set(),valoresDoPacote=new Map();
  const chaveMedicao=i=>[i.tipo,i.data,normaliza(i.tipo==='peso'?'peso':i.exame),normaliza(i.tipo==='peso'?'kg':i.unidade)].join('|');
  for(const i of p.itens.filter(i=>['exame','peso'].includes(i.tipo))){const k=chaveMedicao(i);if(!valoresDoPacote.has(k))valoresDoPacote.set(k,new Set());valoresDoPacote.get(k).add(docValorChave(i.valor))}
  const itens=p.itens.map(i=>{
    let status='novo',motivo='Incluir após sua confirmação.';
    const antigos=i.tipo==='exame'?estado.exames||[]:i.tipo==='peso'?estado.peso||[]:i.tipo==='leitura'?dev.leituras||[]:acervo.flatMap(f=>f.registros||[]);
    const igualId=antigos.find(x=>x.origemDocumental?.itemId===i.id);
    let assinatura=i.tipo+':'+i.id;
    if(igualId){status='existente';motivo='Este item já foi importado; a edição atual será preservada.'}
    if(!igualId&&['exame','peso'].includes(i.tipo)){
      const nome=i.tipo==='exame'?i.exame:'peso',unidade=i.tipo==='exame'?i.unidade:'kg';
      assinatura=[i.tipo,i.data,normaliza(nome),normaliza(unidade),docValorChave(i.valor)].join('|');
      const chave=[i.tipo,i.data,normaliza(nome),normaliza(unidade)].join('|');
      const comparaveis=antigos.filter(x=>x.data===i.data&&(i.tipo==='peso'||normaliza(x.exame)===normaliza(nome))&&(i.tipo==='peso'||normaliza(unidadeSaude(x))===normaliza(unidade)));
      if(comparaveis.some(x=>docValorChave(i.tipo==='peso'?x.kg:x.valor)===docValorChave(i.valor))){status='existente';motivo='Já existe a mesma medição, data e unidade.'}
      else if(comparaveis.length){status='conflito';motivo='Há outro valor nesta data. Confira o laudo e o cadastro; nenhum deles será substituído.'}
      else if(valoresDoPacote.get(chave)?.size>1){status='conflito';motivo='Dois documentos desta revisão têm valores diferentes para a mesma data e unidade. Confira os originais.'}

    }
    if(status==='novo'&&assinaturas.has(assinatura)){status='existente';motivo='Repetido nesta revisão. A primeira ocorrência pode ser selecionada.'}assinaturas.add(assinatura);
    return {key:'item:'+i.id,tipo:i.tipo,dado:i,status,motivo};
  });
  return [...fontes,...itens];
}
function docAplicar(p,selecionados,estadoInicial,versaoInicial){
  if(E!==estadoInicial||E._mt!==versaoInicial)throw Error('Os dados mudaram enquanto você revisava. Reabra o arquivo para comparar com a versão atual.');
  const pacote=docPacote(p),plano=docPlano(pacote),set=new Set(selecionados),linhas=plano.filter(x=>set.has(x.key));
  if(!linhas.length)throw Error('Selecione pelo menos uma informação.');
  if(linhas.length!==set.size||linhas.some(x=>x.status!=='novo'))throw Error('A seleção mudou. Reabra a revisão antes de aplicar.');
  for(const x of linhas.filter(x=>x.tipo!=='fonte')){
    const fonte=plano.find(f=>f.key==='fonte:'+x.dado.fonteId);
    if(fonte.status==='novo'&&!set.has(fonte.key))throw Error('Selecione também a fonte do item.');
  }
  const novo=structuredClone(E);novo.acervoDocumental||=[];const dev=prepararDesenvolvimento(novo),agora=new Date().toISOString();
  const fonteDev=new Map();
  for(const f of pacote.fontes){const existente=dev.fontes.find(x=>docFonteChave(x)===docFonteChave(f));if(existente)fonteDev.set(f.id,existente.id)}
  for(const {dado:f} of linhas.filter(x=>x.tipo==='fonte')){
    if(!novo.acervoDocumental.some(a=>a.pacoteFonteId===f.id&&a.versao===f.versao))novo.acervoDocumental.push({...f,id:uid(),pacoteFonteId:f.id,revisadoEm:agora,registros:[]});
    if(f.grupo==='comportamento'){
      const existente=dev.fontes.find(x=>x.id===fonteDev.get(f.id));
      if(!existente){const id=uid();dev.fontes.push({...f,id,revisado:f.lido,pendente:!f.lido,importadoEm:agora,origem:'Revisão de documento'});fonteDev.set(f.id,id)}
      else if(f.lido){for(const campo of ['dataDocumento','tipo','paginas','resumo','limites','disc','lideranca'])if((existente[campo]===undefined||existente[campo]===null||existente[campo]==='')&&f[campo]!==undefined)existente[campo]=structuredClone(f[campo]);existente.revisado=true;existente.pendente=false;existente.ultimaRevisaoDocumental={versao:f.versao,revisadoEm:agora}}
    }
  }
  for(const {dado:i} of linhas.filter(x=>x.tipo!=='fonte')){
    const fonte=pacote.fontes.find(f=>f.id===i.fonteId),origemDocumental={itemId:i.id,fonteId:i.fonteId,titulo:fonte.titulo,url:fonte.url,pagina:i.pagina,versao:fonte.versao,revisadoEm:agora};
    const obs=[i.texto,i.limites,i.referencia?'Referência do laudo: '+i.referencia:'',fonte.titulo+(i.pagina?' · p. '+i.pagina:''),fonte.url].filter(Boolean).join('\n');
    if(i.tipo==='exame')novo.exames.push({id:uid(),data:i.data,exame:i.exame,valor:i.valor,unidade:i.unidade,referenciaLaudo:i.referencia,resultado:'',obs,origemDocumental});
    else if(i.tipo==='peso')novo.peso.push({id:uid(),data:i.data,kg:numeroResultadoSaude(i.valor),obs,origemDocumental});
    else if(i.tipo==='leitura')dev.leituras.push({id:uid(),titulo:i.titulo,texto:i.texto,limites:i.limites,data:i.data,pagina:i.pagina,tipo:i.tipoLeitura,area:i.area,pergunta:i.pergunta,passo:i.passo,medida:i.medida,status:'A conferir',fontes:[fonteDev.get(i.fonteId)].filter(Boolean),origemDocumental});
    else{const guardada=novo.acervoDocumental.find(f=>f.pacoteFonteId===i.fonteId&&f.versao===fonte.versao);if(!guardada)throw Error('Fonte ausente. Reabra a revisão.');guardada.registros.push({id:uid(),...i,origemDocumental})}
  }
  validarBackup(novo);E=novo;salvar();return linhas.length;
}
function docAvaliacaoTexto(f){return [f.disc?'Avaliação incluída nesta fonte: '+Object.entries(f.disc).map(([perfil,notas])=>(perfil==='natural'?'Natural':'Adaptado')+' — '+Object.entries(notas).map(([k,v])=>k+' '+v).join(' · ')).join(' / '):'',f.lideranca?'Liderança incluída: '+Object.entries(f.lideranca).map(([k,v])=>k+' '+v).join(' · '):''].filter(Boolean).join('\n')}
function docAbrirRevisao(){
  abrirModal('Revisar documentos','Carregue a revisão preparada a partir dos seus arquivos. Você escolhe o que entra na Central.',(c,fechar)=>{
    const b=el('<div class="secao doc-revisao-upload"><label>Arquivo da revisão<input type="file" accept=".json,application/json" aria-label="Arquivo da revisão"></label><p class="workspace-note">A revisão mantém a fonte de cada informação. Os PDFs originais continuam no seu Drive.</p><details><summary>Colar conteúdo da revisão</summary><label>Conteúdo da revisão<textarea rows="5" aria-label="Conteúdo da revisão" spellcheck="false"></textarea></label><button type="button" class="btn ghost">Conferir conteúdo</button></details><p role="alert" class="form-erro"></p></div>');
    const ler=texto=>{try{if(texto.length>5e6)throw Error('O arquivo ultrapassa 5 MB.');const p=docPacote(JSON.parse(texto));fechar();docMostrarRevisao(p)}catch(e){b.querySelector('[role=alert]').textContent=e.message}};
    b.querySelector('input').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>5e6)throw Error('O arquivo ultrapassa 5 MB.');ler(await f.text())}catch(err){b.querySelector('[role=alert]').textContent=err.message}};
    b.querySelector('button').onclick=()=>ler(b.querySelector('textarea').value);c.appendChild(b);
  });
}
function docMostrarRevisao(p){
  const plano=docPlano(p),estado=E,versao=E._mt,marcados=new Set();
  abrirModal('Escolher informações','Tudo começa desmarcado. Cópias e valores conflitantes ficam identificados.',(c,fechar)=>{
    const corpo=el('<div class="secao doc-revisao"><div class="doc-revisao-filtros"><label>Buscar na revisão<input type="search" aria-label="Buscar na revisão" placeholder="Documento, marcador ou assunto"></label><label>Área<select aria-label="Área da revisão"><option value="todas">Todas</option><option value="saude">Saúde</option><option value="comportamento">Comportamento</option></select></label></div><div class="doc-revisao-selecao"></div><p role="status"></p><div class="doc-revisao-lista"></div><p role="alert" class="form-erro"></p></div>');
    const rodape=el('<div class="secao modal-acoes"></div>'),aplicar=acao('Guardar selecionados',()=>{try{docAplicar(p,marcados,estado,versao);fechar();tela()}catch(e){corpo.querySelector('[role=alert]').textContent=e.message}});aplicar.disabled=true;rodape.append(acao('Cancelar',fechar,'ghost'),aplicar);const caixas=new Map();
    const atualiza=()=>{for(const [key,input] of caixas)input.checked=marcados.has(key);const fontes=plano.filter(x=>marcados.has(x.key)&&x.tipo==='fonte').length,itens=marcados.size-fontes,ocultos=[...caixas].filter(([k,input])=>marcados.has(k)&&input.closest('[hidden]')).length;corpo.querySelector('[role=status]').textContent=fontes+' fonte(s) + '+itens+' informação(ões) selecionadas · '+plano.filter(x=>x.status==='conflito').length+' conflitos'+(ocultos?' · '+ocultos+' selecionado(s) fora do filtro':'');aplicar.disabled=!marcados.size;aplicar.textContent='Guardar '+marcados.size+' selecionado(s)'};
    const lista=corpo.querySelector('.doc-revisao-lista');
    for(const fonte of p.fontes){
      const grupo=el('<section class="doc-revisao-grupo"></section>');grupo.dataset.grupo=fonte.grupo;
      for(const x of plano.filter(x=>x.tipo==='fonte'?x.dado.id===fonte.id:x.dado.fonteId===fonte.id)){
        const d=x.dado,linha=el('<article class="doc-revisao-linha"><label><input type="checkbox"><span><strong></strong><small></small></span></label><div class="doc-revisao-detalhe"></div></article>');
        linha.dataset.busca=normaliza([fonte.titulo,d.titulo,d.exame,d.texto].join(' '));const box=linha.querySelector('input');box.disabled=x.status!=='novo';box.setAttribute('aria-label','Selecionar '+(d.titulo||d.exame));caixas.set(x.key,box);
        linha.querySelector('strong').textContent=(x.tipo==='fonte'?'▤ ':'')+(d.titulo||d.exame);linha.querySelector('small').textContent=(x.tipo==='fonte'?fonte.grupo==='saude'?'Fonte de saúde':'Fonte de comportamento':x.tipo==='registroSaude'?'Registro documental':x.tipo==='leitura'?'Leitura para conferir':x.tipo==='peso'?'Pesagem':'Exame')+' · '+(d.data||d.dataDocumento?fmtDataAno(d.data||d.dataDocumento):'Sem data no documento')+(d.pagina?' · p. '+d.pagina:'');
        const detalhe=linha.querySelector('.doc-revisao-detalhe');const texto=el('<p></p>');texto.textContent=x.tipo==='fonte'?d.resumo||'Referência do documento.':['exame','peso'].includes(x.tipo)?d.valor+' '+(d.unidade||'')+(d.referencia?' · referência no laudo: '+d.referencia:''):d.texto;detalhe.appendChild(texto);if(x.tipo==='fonte'&&docAvaliacaoTexto(d)){const notas=el('<p class="doc-revisao-avaliacao"></p>');notas.textContent=docAvaliacaoTexto(d);detalhe.appendChild(notas)}if(d.limites){const limite=el('<p class="workspace-note"></p>');limite.textContent=d.limites;detalhe.appendChild(limite)}const status=el('<p class="workspace-note"></p>');status.textContent=x.motivo;detalhe.appendChild(status);
        if(x.tipo==='fonte'&&fonte.url){const a=el('<a target="_blank" rel="noopener noreferrer">Abrir original no Drive ↗</a>');a.href=fonte.url;detalhe.appendChild(a)}
        box.onchange=()=>{if(box.checked){marcados.add(x.key);const fk='fonte:'+d.fonteId;if(caixas.has(fk)&&!caixas.get(fk).disabled)marcados.add(fk)}else{marcados.delete(x.key);if(x.tipo==='fonte')for(const item of p.itens.filter(i=>i.fonteId===d.id))marcados.delete('item:'+item.id)}atualiza()};grupo.appendChild(linha);
      }lista.appendChild(grupo);
    }
    const filtrar=()=>{const q=normaliza(corpo.querySelector('input[type=search]').value),area=corpo.querySelector('select').value;for(const g of lista.children){let n=0;for(const r of g.children){r.hidden=(area!=='todas'&&g.dataset.grupo!==area)||!r.dataset.busca.includes(q);if(!r.hidden)n++}g.hidden=!n;if(n)g.firstElementChild.hidden=false}atualiza()};
    corpo.querySelector('.doc-revisao-selecao').append(acao('Selecionar novos visíveis',()=>{for(const [key,input] of caixas)if(!input.disabled&&!input.closest('[hidden]')){marcados.add(key);const x=plano.find(x=>x.key===key);if(x.tipo!=='fonte'&&!caixas.get('fonte:'+x.dado.fonteId)?.disabled)marcados.add('fonte:'+x.dado.fonteId)}atualiza()},'ghost'),acao('Desmarcar tudo',()=>{marcados.clear();atualiza()},'ghost'));
    corpo.querySelector('input[type=search]').oninput=filtrar;corpo.querySelector('select').onchange=filtrar;atualiza();c.append(corpo,rodape);
  });
}
function docAbrirAcervo(grupo){
  const fontes=(E.acervoDocumental||[]).filter(f=>f.grupo===grupo).sort((a,b)=>(b.dataDocumento||'').localeCompare(a.dataDocumento||''));
  abrirModal(grupo==='saude'?'Documentos e histórico de saúde':'Leituras dos documentos','Conclusões e orientações são registros datados dos documentos originais.',(c)=>{
    const corpo=el('<div class="secao doc-acervo"></div>');if(!fontes.length)corpo.appendChild(el('<p>Nenhuma revisão de documentos guardada nesta área.</p>'));
    for(const f of fontes){const artigo=el('<article><h4></h4><small></small><p class="doc-acervo-texto"></p></article>');artigo.querySelector('h4').textContent=f.titulo;artigo.querySelector('small').textContent=f.dataDocumento?fmtDataAno(f.dataDocumento):'Sem data identificada no documento';artigo.querySelector('p').textContent=f.resumo;if(f.limites){const p=el('<p class="workspace-note"></p>');p.textContent=f.limites;artigo.appendChild(p)}
      if(docAvaliacaoTexto(f)){const notas=el('<p class="doc-acervo-texto"></p>');notas.textContent=docAvaliacaoTexto(f);artigo.appendChild(notas)}if(devURL(f.url)){const a=el('<a target="_blank" rel="noopener noreferrer">Ver documento original ↗</a>');a.href=devURL(f.url);artigo.appendChild(a)}
      for(const r of f.registros||[]){const div=el('<section><h5></h5><small></small><p class="doc-acervo-texto"></p></section>');div.querySelector('h5').textContent=r.titulo;div.querySelector('small').textContent=(r.data?fmtDataAno(r.data)+' · ':'')+(r.pagina?'p. '+r.pagina:'');div.querySelector('p').textContent=r.texto;if(r.limites){const limite=el('<p class="workspace-note"></p>');limite.textContent=r.limites;div.appendChild(limite)}artigo.appendChild(div)}corpo.appendChild(artigo);
    }c.appendChild(corpo);
  });
}
function docIntegrarTela(pagina,telaId){
  const destinos=telaId==='saude'?[pagina.querySelector('.topo')]:telaId==='guia'?[pagina.querySelector('.dev-acervo-top')]:[];
  const grupo=telaId==='saude'?'saude':'comportamento';
  for(const host of destinos.filter(Boolean)){if(host.querySelector('[data-revisao-documental]'))continue;const b=acao('Revisar documentos',docAbrirRevisao,'ghost');b.dataset.revisaoDocumental='';host.appendChild(b);if((E.acervoDocumental||[]).some(f=>f.grupo===grupo))host.appendChild(acao('Ver leituras dos documentos',()=>docAbrirAcervo(grupo),'ghost'))}
}
