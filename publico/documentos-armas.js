/* Registros documentais privados. Nenhum dado real faz parte deste módulo. */
const DocumentosArmas = (() => {
  const tipos = ['arma','cr','clube','guia'];
  const ehRegistro = d => d?.grupo === 'armas' && tipos.includes(d.tipoRegistro);
  const lista = () => E.documentos.filter(ehRegistro);
  const titulos = {arma:'Arma',cr:'CR pessoal',clube:'Clube de tiro',guia:'Guia de trânsito'};
  const camposEndereco=[['enderecoDocumentado','Endereço como consta no documento','textarea'],['enderecoContexto','Contexto do endereço (ex.: alternativo ou histórico)'],['enderecoData','Data do documento de endereço','date'],['enderecoValidade','Validade informada no documento de endereço','date']];
  const classificacoesGuia={'':'Situação a conferir','atual-a-conferir':'Atual · conferir no emissor',historico:'Histórico documental'};
  const campos = {
    guia:[['nome','Identificação da guia',true],['dono','Titular no documento',true],['armaId','Arma vinculada',true],['classificacao','Classificação do documento'],['numero','Número da guia'],['orgao','Órgão emissor'],['emissao','Emissão','date'],['inicio','Início da validade','date'],['validade','Vencimento da guia','date'],['prazoTexto','Prazo conforme escrito no documento']],
    arma:[['nome','Identificação da arma',true],['dono','Titular',true],['marca','Fabricante'],['modelo','Modelo identificado'],['modeloNota','Modelo na nota fiscal'],['tipo','Tipo'],['calibre','Calibre'],['serie','Número de série'],['numero','Número do registro'],['sinarm','SINARM / SIGMA'],['orgao','Órgão emissor'],['emissao','Emissão','date'],['validade','Validade impressa no documento','date'],['compra','Data da compra','date'],['fornecedor','Fornecedor'],['notaFiscal','Referência da nota fiscal']],
    cr:[['nome','Nome do documento',true],['dono','Titular',true],['numero','Número do CR'],['orgao','Órgão emissor'],['unidade','Unidade de vinculação'],['atividade','Atividade descrita no documento'],['emissao','Emissão','date'],['validade','Validade impressa no documento','date']],
    clube:[['nome','Nome do clube',true],['dono','Pessoa filiada',true],['numero','Matrícula / número de associado'],['filiacao','Data da filiação','date'],['validade','Validade informada da filiação','date'],['renovacaoDia','Dia da renovação anual','number'],['renovacaoMes','Mês da renovação anual','number'],['contato','Contato no clube'],['telefone','Telefone'],['email','E-mail'],['site','Site do clube','url']]
  };
  for(const tipo of ['arma','cr','clube'])campos[tipo].push(...camposEndereco);
  function urlSegura(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
  function dataValida(v){if(!v)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v}
  function diaMesRenovacao(d){
    const dia=String(d.renovacaoDia??'').trim(),mes=String(d.renovacaoMes??'').trim();
    if(!/^\d{1,2}$/.test(dia)||!/^\d{1,2}$/.test(mes))return '';
    const sufixo=mes.padStart(2,'0')+'-'+dia.padStart(2,'0');
    return dataValida('2000-'+sufixo)?sufixo:'';
  }
  function proximaRenovacao(d,referencia=hoje()){
    const sufixo=diaMesRenovacao(d);
    if(d.tipoRegistro!=='clube'||!sufixo||!referencia||!dataValida(referencia))return '';
    const ano=Number(referencia.slice(0,4));
    for(let n=ano;n<=Math.min(ano+8,9999);n++){const data=String(n).padStart(4,'0')+'-'+sufixo;if(data>=referencia&&dataValida(data))return data}
    return '';
  }
  function resumoRenovacao(d){
    const sufixo=diaMesRenovacao(d),proxima=proximaRenovacao(d);
    if(!sufixo)return String(d.renovacaoDia??'').trim()||String(d.renovacaoMes??'').trim()?'Data anual a conferir':'Não informada';
    return 'Todo ano em '+sufixo.slice(3)+'/'+sufixo.slice(0,2)+(proxima?' · Próxima: '+fmtDataAno(proxima):'');
  }
  function urlFotoSegura(v){
    if(typeof v!=='string')return '';
    if(/^assets\/armas\/[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp|avif)$/i.test(v))return v;
    return urlSegura(v);
  }
  function anexosPrivados(d){return [...new Set([...(Array.isArray(d.anexosIds)?d.anexosIds:[]),d.anexoComprovanteId].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))]}
  function totalFontes(d){return new Set((Array.isArray(d.fontes)?d.fontes:[]).map(f=>urlSegura(f?.url)).filter(Boolean)).size+anexosPrivados(d).length}
  function pendencias(d){
    const req=d.tipoRegistro==='guia'?[['armaId','Arma vinculada'],['numero','Número da guia'],['emissao','Emissão']]:d.tipoRegistro==='arma'?[['marca','Fabricante'],['modelo','Modelo'],['serie','Série'],['numero','Registro']]:d.tipoRegistro==='cr'?[['numero','Número do CR']]:[['numero','Matrícula'],['contato','Contato do clube']];
    const p=req.filter(([k])=>!String(d[k]||'').trim()).map(([,label])=>label);
    if(!d.validade)p.push(d.tipoRegistro==='guia'&&d.classificacao==='historico'?'Vencimento não transcrito':'Validade');else if(!dataValida(d.validade))p.push('Data inválida');
    if(!totalFontes(d))p.push('Documento-fonte');
    if(d.tipoRegistro==='clube'&&(String(d.renovacaoDia??'').trim()||String(d.renovacaoMes??'').trim())&&!diaMesRenovacao(d))p.push('Renovação anual');
    return p;
  }
  function validar(v,tipo){
    if(!tipos.includes(tipo))throw Error('Tipo de registro inválido.');
    if(!v.nome?.trim()||!v.dono?.trim())throw Error('Informe a identificação e o titular.');
    for(const [k,label,t] of campos[tipo])if(t==='date'&&!dataValida(v[k]))throw Error('Confira a data de '+label.toLowerCase()+'.');
    if(v.site&&!urlSegura(v.site))throw Error('Use um site que comece com https://.');
    if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw Error('Confira o e-mail do clube.');
    if(v.emissao&&v.validade&&v.validade<v.emissao)throw Error('A validade não pode ser anterior à emissão.');
    if(tipo==='guia'&&!E.documentos.some(d=>d.id===v.armaId&&ehRegistro(d)&&d.tipoRegistro==='arma'))throw Error('Selecione uma arma cadastrada para vincular esta guia.');
    if(v.inicio&&v.validade&&v.validade<v.inicio)throw Error('O vencimento não pode ser anterior ao início da validade.');
    if(v.filiacao&&v.validade&&v.validade<v.filiacao)throw Error('A validade não pode ser anterior à filiação.');
    if(tipo!=='guia'&&v.enderecoData&&v.enderecoValidade&&v.enderecoValidade<v.enderecoData)throw Error('A validade do documento de endereço não pode ser anterior à sua data.');
    if(tipo==='guia'&&!Object.hasOwn(classificacoesGuia,v.classificacao||''))throw Error('Selecione uma classificação válida para a guia.');
    if(tipo==='clube'&&(String(v.renovacaoDia??'').trim()||String(v.renovacaoMes??'').trim())&&!diaMesRenovacao(v))throw Error('Informe dia e mês válidos para a renovação anual.');
  }
  function atualizar(id,base,valores,tipo){
    validar(valores,tipo);
    const atual=id?E.documentos.find(d=>d.id===id&&ehRegistro(d)):null;
    if(id&&!atual)throw Error('Este registro mudou ou foi removido. Feche e abra a ficha novamente.');
    const permitidos=[...campos[tipo].map(c=>c[0]),'onde','obs'];
    const alterados=permitidos.filter(k=>!atual||String(valores[k]??'')!==String(base[k]??''));
    if(atual&&alterados.some(k=>String(atual[k]??'')!==String(base[k]??'')))throw Error('Esta ficha foi atualizada em outra sessão. Feche e abra novamente para conferir antes de salvar.');
    const candidato={...(atual||base),...Object.fromEntries(alterados.map(k=>[k,String(valores[k]??'').trim()]))};
    validar(candidato,tipo);
    const d=atual?structuredClone(atual):{id:uid(),grupo:'armas',tipoRegistro:tipo,fontes:[]};
    const antes=Object.fromEntries(alterados.map(k=>[k,d[k]??'']));
    alterados.forEach(k=>{d[k]=String(valores[k]??'').trim()});
    if(alterados.length){d.historico=Array.isArray(d.historico)?d.historico:[];d.historico.push({data:new Date().toISOString(),acao:atual?'Dados atualizados':'Registro criado',antes});d.atualizadoEm=new Date().toISOString()}
    persistir(d);return d;
  }
  function persistir(d){
    const anterior=E.documentos,mt=E._mt;
    E.documentos=anterior.some(x=>x.id===d.id)?anterior.map(x=>x.id===d.id?d:x):[...anterior,d];
    try{salvar()}catch(e){E.documentos=anterior;E._mt=mt;throw Error('Não foi possível salvar neste navegador. Seus dados anteriores foram preservados; mantenha a ficha aberta e tente novamente.')}
  }
  function adicionarFonte(id,titulo,url){
    const atual=E.documentos.find(x=>x.id===id&&ehRegistro(x));if(!atual)throw Error('Registro não encontrado. Reabra a ficha.');
    const d=structuredClone(atual);
    const seguro=urlSegura(url);if(!titulo.trim()||!seguro)throw Error('Informe o título e um link https:// válido.');
    if(!Array.isArray(d.fontes))d.fontes=[];
    if(d.fontes.some(f=>urlSegura(f.url)===seguro))throw Error('Este documento já está vinculado à ficha.');
    d.fontes.push({id:uid(),titulo:titulo.trim(),url:seguro,adicionadoEm:hoje()});d.atualizadoEm=new Date().toISOString();if(!Array.isArray(d.historico))d.historico=[];d.historico.push({data:d.atualizadoEm,acao:'Documento vinculado: '+titulo.trim()});persistir(d);
  }
  function prazoGuia(d){
    if(d.classificacao==='historico')return '📁 Documento histórico';
    if(!d.validade)return '◷ Vencimento pendente';
    if(!dataValida(d.validade))return '⚠ Data a conferir';
    if(d.validade<hoje())return '⚠ Prazo vencido';
    if(d.inicio&&d.inicio>hoje())return '◷ Validade ainda não iniciada';
    const dias=Math.round((new Date(d.validade+'T12:00:00Z')-new Date(hoje()+'T12:00:00Z'))/864e5);
    return dias===0?'◷ Vence hoje':dias<=30?'◷ Vence em '+dias+' dias':'📅 Vencimento informado';
  }
  function guiasDaArma(id){return lista().filter(d=>d.tipoRegistro==='guia'&&d.armaId===id).sort((a,b)=>(a.validade||'9999').localeCompare(b.validade||'9999'))}
  function linhaGuia(d){
    const arma=lista().find(x=>x.id===d.armaId&&x.tipoRegistro==='arma');
    const historica=d.classificacao==='historico';
    const row=el('<article class="da-guia'+(historica?' da-guia-historica':'')+'"><div><b>'+esc(d.nome||'Guia de trânsito')+'</b><span>'+esc(arma?.nome||'Vínculo a conferir')+' · '+esc(d.numero||'Número pendente')+'</span>'+(historica?'<span>Arquivo histórico · não confirma autorização atual</span>':'')+(d.prazoTexto?'<span>Prazo no documento: '+esc(d.prazoTexto)+'</span>':'')+'</div><div><span class="da-status">'+esc(prazoGuia(d))+'</span><b>'+esc(d.validade&&dataValida(d.validade)?fmtDataAno(d.validade):'Vencimento não informado')+'</b></div></article>');
    row.appendChild(acao('Abrir guia →',()=>editar(d.id),'ghost'));return row;
  }
  function secaoGuias(){
    const s=el('<section class="da-section da-guias"><div class="da-section-head"><h2>📋 Guias de trânsito</h2></div><p class="da-note">Uma ficha por guia, vinculada à arma, com arquivo e prazo próprios. As guias anteriores permanecem no histórico.</p></section>');
    s.querySelector('.da-section-head').appendChild(acao('+ Nova guia',()=>editar(null,'guia'),'ghost'));
    const guias=lista().filter(d=>d.tipoRegistro==='guia').sort((a,b)=>(a.validade||'9999').localeCompare(b.validade||'9999'));
    if(!guias.length)s.appendChild(el('<p class="da-empty">Nenhuma guia cadastrada. Adicione o documento e copie o vencimento informado nele.</p>'));
    guias.forEach(d=>s.appendChild(linhaGuia(d)));return s;
  }
  function nav(ativa,onChange){
    const n=el('<nav class="da-tabs" aria-label="Seções de documentos"></nav>');
    for(const [id,nome,emoji,qtd] of [['documentos','Documentos','📁',E.documentos.filter(d=>!ehRegistro(d)).length],['armas','Armas','🗂️',lista().filter(d=>d.tipoRegistro==='arma').length]]){
      const b=acao('',()=>onChange(id),'ghost');b.innerHTML='<span aria-hidden="true">'+emoji+'</span> '+nome+' <span class="da-count">'+qtd+'</span>';b.setAttribute('aria-pressed',String(ativa===id));n.appendChild(b);
    }return n;
  }
  function link(titulo,url){const a=el('<a target="_blank" rel="noopener noreferrer"></a>');a.textContent=titulo+' ↗';a.href=url;return a}
  function galeria(d,limite=2){
    const fotos=(Array.isArray(d.fotos)?d.fotos:[]).filter(f=>f&&urlFotoSegura(f.url)).slice(0,limite);
    if(d.tipoRegistro!=='arma'||!fotos.length)return null;
    const gal=el('<div class="da-galeria'+(limite===1?' da-galeria-card':'')+'" aria-label="Fotos de referência do modelo"></div>');
    for(const f of fotos){
      const fig=el('<figure class="da-foto"></figure>'),img=document.createElement('img');
      img.src=urlFotoSegura(f.url);img.alt=String(f.legenda||'Foto de referência do modelo');img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.width=1200;img.height=1200;
      const legenda=el('<figcaption><b>Referência do modelo</b><span></span></figcaption>');legenda.querySelector('span').textContent=String(f.legenda||'Não é a foto do exemplar cadastrado.');
      const fonte=urlSegura(f.fonte);if(fonte)legenda.appendChild(link('Fonte da foto',fonte));
      fig.append(img,legenda);gal.appendChild(fig);
    }return gal;
  }
  function referencias(d){
    const refs=(Array.isArray(d.referencias)?d.referencias:[]).filter(r=>r&&urlSegura(r.url));
    if(!refs.length)return null;
    const sec=el('<section class="secao da-referencias"><h4>🔗 Referências úteis</h4><p class="da-note">Fabricante, manual e assistência. Referências gerais não substituem os documentos do seu exemplar.</p><div class="da-referencias-links"></div></section>');
    refs.forEach(r=>sec.querySelector('.da-referencias-links').appendChild(link(String(r.titulo||'Abrir referência'),urlSegura(r.url))));return sec;
  }
  function detalhes(d){
    const box=el('<div class="da-dados"></div>');
    const linhas=d.tipoRegistro==='arma'?[['Tipo',d.tipo],['Calibre',d.calibre],['Titular',d.dono]]:d.tipoRegistro==='clube'?[['Pessoa filiada',d.dono],['Matrícula',d.numero],['Contato',d.contato]]:[['Titular',d.dono],['Órgão',d.orgao]];
    for(const [r,v] of linhas)box.appendChild(el('<div><span>'+esc(r)+'</span><b>'+esc(v||'Pendente')+'</b></div>'));
    const validade=d.validade&&dataValida(d.validade)?d.validade:'',passou=validade&&validade<hoje();
    const banda=el('<div class="da-validade'+(!validade?' da-validade-pendente':passou?' da-validade-vencida':'')+'"><span>📅 '+(d.tipoRegistro==='clube'?'Validade informada da filiação':'Validade impressa no documento')+'</span>'+(validade?'<time datetime="'+validade+'">'+esc(fmtDataAno(validade))+'</time>':'<b>Data a confirmar</b>')+'<small>'+(validade?(passou?'Prazo impresso ultrapassado · conferir no emissor':'Situação atual a conferir no emissor'):'A data será destacada quando o documento for conferido.')+'</small></div>');box.appendChild(banda);
    if(d.tipoRegistro==='clube'){
      const sufixo=diaMesRenovacao(d),proxima=proximaRenovacao(d);
      const renovacao=el('<div class="da-renovacao-card"><span>🔄 Renovação anual · acompanhamento</span><b>'+esc(sufixo?sufixo.slice(3)+'/'+sufixo.slice(0,2):'Data a confirmar')+'</b><small>'+esc(proxima?'Próxima: '+fmtDataAno(proxima):'Dia e mês ainda não confirmados')+'</small></div>');box.appendChild(renovacao);
    }
    return box;
  }
  function card(d){
    const p=pendencias(d),c=el('<article class="da-card da-card-'+d.tipoRegistro+'"></article>');
    const h=el('<div class="da-card-top"><span class="da-symbol" aria-hidden="true">'+({arma:'🗂️',cr:'📜',clube:'🏅'}[d.tipoRegistro])+'</span><div><span class="da-kicker">'+esc(titulos[d.tipoRegistro])+'</span><h3>'+esc(d.nome||titulos[d.tipoRegistro])+'</h3></div><span class="da-status">'+(p.length?'◷ '+p.length+' pendências':'◷ Conferir situação atual')+'</span></div>');
    c.appendChild(h);const fotos=galeria(d,1);if(fotos)c.appendChild(fotos);c.appendChild(detalhes(d));
    const anexos=anexosPrivados(d).length;
    const rodape=el('<div class="da-card-footer"><span>'+totalFontes(d)+' documento(s)-fonte'+(anexos?' · '+anexos+' arquivo(s) privado(s)':'')+'</span></div>');
    const abrir=acao('Abrir ficha →',()=>editar(d.id),'ghost');rodape.appendChild(abrir);c.appendChild(rodape);
    return c;
  }
  function render(m){
    m.classList.add('da-workspace');
    const regs=lista(),armas=regs.filter(d=>d.tipoRegistro==='arma');
    const intro=el('<div class="da-intro"><div><h2>Armas e documentos</h2><p>Identificação, registros e filiação, com os originais sempre à mão.</p></div><span class="da-pill">'+armas.length+' ficha(s) · '+armas.filter(d=>!totalFontes(d)).length+' sem documento-fonte</span></div>');m.appendChild(intro);
    const filtros=el('<div class="da-filtros"><input type="search" placeholder="Buscar arma, modelo ou titular…" aria-label="Buscar arma"></div>');m.appendChild(filtros);
    const grid=el('<div class="da-grid" aria-label="Fichas das armas"></div>');m.appendChild(grid);
    const busca=filtros.querySelector('input');busca.value=filtro.armasBusca||'';
    function pintar(){grid.replaceChildren();const q=normaliza(busca.value);const itens=armas.filter(d=>normaliza([d.nome,d.modelo,d.marca,d.dono].join(' ')).includes(q));itens.forEach(d=>grid.appendChild(card(d)));if(!itens.length)grid.appendChild(el('<p class="da-empty">'+(armas.length?'Nenhuma arma neste filtro.':'Cadastre uma arma e vincule seus documentos.')+'</p>'))}
    busca.oninput=()=>{filtro.armasBusca=busca.value;pintar()};pintar();
    m.appendChild(secaoGuias());
    const apoio=el('<div class="da-grid da-apoio"></div>');m.appendChild(apoio);
    for(const tipo of ['cr','clube']){
      const sec=el('<section class="da-section"><div class="da-section-head"><h2>'+({cr:'📜 CR pessoal',clube:'🏅 Clube de tiro'}[tipo])+'</h2></div></section>');
      const rs=regs.filter(d=>d.tipoRegistro===tipo);sec.querySelector('.da-section-head').appendChild(acao('+ Adicionar',()=>editar(null,tipo),'ghost'));rs.forEach(d=>sec.appendChild(card(d)));
      if(!rs.length)sec.appendChild(el('<p class="da-empty">'+(tipo==='clube'?'Filiação pendente. Adicione clube, matrícula, contato e comprovante.':'Nenhum CR pessoal cadastrado.')+'</p>'));
      apoio.appendChild(sec);
    }
    m.appendChild(el('<p class="da-note">ⓘ Datas transcritas dos documentos. A situação atual precisa ser conferida no emissor. CR pessoal e filiação ao clube são registros separados.</p>'));
  }
  function organizarFormulario(form,tipo){
    const principal=form.querySelector('.campos');
    const grupos=tipo==='arma'?[['Registro e validade',['serie','numero','sinarm','orgao','emissao','validade']],['Compra e nota fiscal',['modeloNota','compra','fornecedor','notaFiscal']]]:tipo==='cr'?[['Detalhes do CR',['unidade','atividade']]]:tipo==='clube'?[['Canais do clube',['telefone','email','site']]]:[];
    if(tipo!=='guia')grupos.push(['Endereço no documento',camposEndereco.map(c=>c[0])]);
    grupos.push(['Observações e local do original',['onde','obs']]);
    for(const [titulo,keys] of grupos){const endereco=keys.includes('enderecoDocumentado');const det=el('<details class="da-form-group'+(endereco?' da-endereco':'')+'"><summary>'+titulo+'</summary>'+(endereco?'<p class="da-note">Transcrição do documento identificado abaixo. Este registro não confirma o endereço atual do titular.</p>':'')+'<div class="campos"></div></details>');for(const key of keys){const campo=principal.querySelector('[name="'+key+'"]')?.closest('.campo');if(campo)det.querySelector('.campos').appendChild(campo)}form.insertBefore(det,form.querySelector('[role=alert]'))}
  }
  function editar(id,tipo='arma',armaId=''){
    const encontrado=id?E.documentos.find(d=>d.id===id&&ehRegistro(d)):null;
    if(id&&!encontrado){alert('Registro não encontrado. Atualize a tela.');return}
    const base=structuredClone(encontrado||{nome:tipo==='cr'?'Certificado de Registro (CR)':tipo==='guia'?'Guia de trânsito':'',dono:lista().find(x=>x.id===armaId)?.dono||'Léo',armaId});tipo=encontrado?.tipoRegistro||tipo;
    abrirModal(esc(encontrado?.nome||'Novo registro · '+titulos[tipo]),'Informações e documentos para consulta.',(c,fechar)=>{
      c.classList.add('da-modal');
      if(encontrado){const p=pendencias(encontrado);if(p.length)c.appendChild(el('<p class="da-warning">◷ A completar: '+esc(p.join(' · '))+'.</p>'))}
      const fotos=galeria(base);if(fotos)c.appendChild(fotos);
      const refs=referencias(base);if(refs)c.appendChild(refs);
      if(tipo==='clube')c.appendChild(el('<p class="da-note da-renovacao-resumo">'+esc(resumoRenovacao(base))+'. A data anual serve para acompanhamento; não confirma renovação concluída nem altera a validade informada.</p>'));
      if(tipo==='guia')c.appendChild(el('<p class="da-note da-guia-contexto">'+(base.classificacao==='historico'?'Arquivo histórico: preserva o documento e seu titular original. Não representa uma autorização atual.':'Confira a situação atual no emissor.')+' Copie a data de vencimento da própria guia; um prazo em texto não gera vencimento automaticamente.</p>'));
      const body=el('<div class="secao"></div>');
      const defs=campos[tipo].map(([k,t,req])=>({k,t,req:req===true,tipo:typeof req==='string'?req:undefined,...(k==='armaId'?{opcoes:['',...lista().filter(x=>x.tipoRegistro==='arma').map(x=>x.id)]}:k==='classificacao'?{opcoes:Object.keys(classificacoesGuia)}:{}),...(k==='enderecoDocumentado'||k==='enderecoContexto'||k==='prazoTexto'?{full:true}:{})}));defs.push({k:'onde',t:'Local do original',full:true},{k:'obs',t:'Observações e pontos a conferir',tipo:'textarea',full:true});
      const dados=devFormulario(body,defs,base,'Salvar ficha',v=>{atualizar(id,base,v,tipo);fechar();rr('documentos')()});organizarFormulario(dados,tipo);if(tipo==='clube'){for(const [k,max] of [['renovacaoDia',31],['renovacaoMes',12]]){const campo=dados.querySelector('[name='+k+']');campo.min='1';campo.max=String(max);campo.step='1';campo.inputMode='numeric'}}if(tipo==='guia'){for(const o of dados.querySelector('[name=armaId]').options)o.textContent=o.value?(lista().find(x=>x.id===o.value)?.nome||'Vínculo a conferir'):'Selecione a arma';for(const o of dados.querySelector('[name=classificacao]').options)o.textContent=classificacoesGuia[o.value]||'Classificação a conferir';}c.appendChild(body);
      if(!id){c.appendChild(el('<p class="da-note">Salve a ficha para vincular os documentos e anexos.</p>'));return}
      const fontes=el('<section class="secao da-fontes"><h4>📎 Documentos-fonte</h4><p class="da-note">Os links abrem os originais. O acesso do Drive é mantido pela sua conta.</p><div class="da-fontes-links"></div></section>');
      const links=fontes.querySelector('.da-fontes-links');
      const pintarFontes=()=>{links.replaceChildren();const atual=E.documentos.find(d=>d.id===id);const fs=(atual?.fontes||[]).filter(f=>urlSegura(f.url));fs.forEach(f=>{const row=el('<div class="da-fonte"></div>');row.appendChild(link(f.titulo||'Abrir documento',urlSegura(f.url)));if(f.conferidoEm||f.adicionadoEm)row.appendChild(el('<small>'+(f.conferidoEm?'Leitura: ':'Adicionado em: ')+esc(fmtDataAno(f.conferidoEm||f.adicionadoEm))+'</small>'));links.appendChild(row)});if(!fs.length)links.textContent=anexosPrivados(atual||{}).length?'Os documentos privados estão em “Arquivos anexados à Central”.':'Nenhum documento-fonte vinculado.'};pintarFontes();
      const add=el('<details><summary>Vincular documento por link</summary></details>');
      const form=devFormulario(add,[{k:'titulo',t:'Nome do documento',req:true},{k:'url',t:'Link do documento (https://)',req:true,tipo:'url'}],{},'Vincular documento',v=>{adicionarFonte(id,v.titulo,v.url);pintarFontes();form.reset();const erro=form.querySelector('[role=alert]');erro.hidden=true});fontes.appendChild(add);c.insertBefore(fontes,body);
      if(tipo==='arma'){const g=el('<section class="secao da-guias"><div class="da-section-head"><h4>📋 Guias desta arma</h4></div></section>');g.querySelector('.da-section-head').appendChild(acao('+ Nova guia',()=>{fechar();editar(null,'guia',id)},'ghost'));const gs=guiasDaArma(id);gs.forEach(d=>g.appendChild(linhaGuia(d)));if(!gs.length)g.appendChild(el('<p class="da-note">Nenhuma guia vinculada.</p>'));c.appendChild(g);}
      const anexos=el('<details class="secao da-anexos"><summary>Arquivos anexados à Central</summary></details>');let carregado=false;anexos.ontoggle=()=>{if(anexos.open&&!carregado){carregado=true;anexos.appendChild(areaArquivos('documento:'+id,'PDF ou imagem do registro e comprovantes'))}};const qtdAnexos=anexosPrivados(base).length;if(qtdAnexos){const aviso=el('<div class="da-comprovante"><span>📎 '+qtdAnexos+' arquivo(s) privado(s)'+(String(base.anexoComprovanteId||'').trim()?' · Comprovante anexado':'')+'</span></div>');aviso.appendChild(acao('Ver arquivos anexados',()=>{anexos.open=true;anexos.scrollIntoView?.({block:'nearest'})},'ghost'));c.appendChild(aviso)}c.appendChild(anexos);
      if(base.tipoRegistro==='clube'){
        const contatos=el('<div class="da-contact"></div>');if(base.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(base.email))contatos.appendChild(link(base.email,'mailto:'+base.email));if(base.telefone){const tel=base.telefone.replace(/[^\d+]/g,'');if(tel)contatos.appendChild(link('Ligar para o clube','tel:'+tel))}if(urlSegura(base.site))contatos.appendChild(link('Site do clube',urlSegura(base.site)));c.appendChild(contatos);
      }
      const hist=Array.isArray(base.historico)?base.historico:[];if(hist.length){const h=el('<details class="secao"><summary>Histórico de alterações ('+hist.length+')</summary></details>');hist.slice().reverse().forEach(x=>{const row=el('<details class="da-historico"><summary>'+esc(x.acao+' · '+new Date(x.data).toLocaleString('pt-BR'))+'</summary></details>');const prev=el('<dl></dl>');for(const [k,v] of Object.entries(x.antes||{})){const label=defs.find(f=>f.k===k)?.t||k;prev.appendChild(el('<dt>'+esc(label)+' · antes</dt><dd>'+esc(String(v)||'Não informado')+'</dd>'))}row.appendChild(prev);h.appendChild(row)});c.appendChild(h)}
      c.appendChild(el('<p class="da-note">Validade informada no documento; situação atual a conferir.</p>'));
    },rr('documentos'));
  }
  return {ehRegistro,lista,nav,render,editar,pendencias,urlSegura,urlFotoSegura,dataValida,validar,atualizar,adicionarFonte,prazoGuia,guiasDaArma,proximaRenovacao,anexosPrivados,totalFontes};
})();
