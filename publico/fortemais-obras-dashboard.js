/* Acompanhamento operacional da obra. Somente leitura; financeiro mantém sua fonte. */
function fmDashboardResumo(o){
  const d=FortemaisDemandasModelo.dados(o),tarefas=d.itens||[],abertas=tarefas.filter(t=>t.situacao!=='Resolvida');
  return {d,tarefas,abertas,atrasadas:abertas.filter(t=>t.prazo&&t.prazo<hoje()),
    compras:FortemaisComprasModelo.resumo(o.fmCompras,hoje()),imovel:fmImovelResumo(o),
    previsao:FortemaisFinance.previsao(fmPrevDados(o))};
}
function fmDashboardMetrica(titulo,valor,nota){
  const c=el('<div class="fmhub-metrica"><span></span><strong></strong><small></small></div>');
  c.children[0].textContent=titulo;c.children[1].textContent=valor;c.children[2].textContent=nota;return c;
}
function fmDashboardCarteira(obras){
  const c=el('<section class="fmhub-carteira" aria-label="Resumo das obras filtradas"></section>');
  c.atualizar=()=>{
    const atuais=obras.filter(o=>E.obras.includes(o)),rs=atuais.map(fmDashboardResumo),somar=fn=>rs.reduce((s,x)=>s+fn(x),0);
    c.replaceChildren(fmDashboardMetrica('Obras nesta visão',atuais.length,atuais.filter(o=>['Em andamento','Em obra'].includes(o.status)).length+' em andamento'),
      fmDashboardMetrica('Demandas abertas',somar(x=>x.abertas.length),somar(x=>x.atrasadas.length)+' com prazo vencido'),
      fmDashboardMetrica('Compras pendentes',somar(x=>x.compras.pendentes),somar(x=>x.compras.atrasadas)+' com prazo vencido'),
      fmDashboardMetrica('Previsões preenchidas',somar(x=>Number(x.previsao.ok))+' / '+atuais.length,'Financeiro completo dentro de cada obra'));
  };c.atualizar();return c;
}
function fmObrasAtualizarResumo(){
  document.querySelectorAll('.fmhub-carteira').forEach(c=>c.atualizar?.());
  document.querySelectorAll('.fmhub[data-fm-pagina]').forEach(c=>{if(!c.hidden)c.atualizar?.()});
}

function fmObrasDashboard(o,abrir){
  const sec=el('<section class="fmhub" aria-label="Dashboard da obra"></section>');let rodada=0,urlCapa=null;
  const liberar=()=>{if(urlCapa?.startsWith('blob:')&&typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(urlCapa);urlCapa=null};
  function atalho(id,titulo,icone,valor,nota){
    const b=el('<button type="button" class="fmhub-atalho"><span class="fmhub-icone" aria-hidden="true"></span><span class="fmhub-atalho-texto"><strong></strong><b></b><small></small></span><span aria-hidden="true">↗</span></button>');
    b.dataset.fmAtalho=id;b.querySelector('.fmhub-icone').textContent=icone;b.querySelector('strong').textContent=titulo;b.querySelector('b').textContent=valor;b.querySelector('small').textContent=nota;b.onclick=()=>abrir(id);return b;
  }
  function atualizar(){
    if(!E.obras.includes(o))return;const r=++rodada;liberar();sec.replaceChildren();const x=fmDashboardResumo(o);
    const intro=el('<div class="fmhub-intro"><div><span class="fmhub-eyebrow">Visão geral da obra</span><h3></h3><p></p></div><div class="fmhub-acoes"></div></div>');
    intro.querySelector('h3').textContent=o.nome||'Obra sem nome';intro.querySelector('p').textContent=[o.status||'Em planejamento',x.imovel.responsavel?'Responsável: '+x.imovel.responsavel:'Responsável a informar',o.fim?'Conclusão prevista: '+fmtDataAno(o.fim):'Conclusão a informar'].join(' · ');
    intro.querySelector('.fmhub-acoes').append(acao('Editar cadastro',()=>fmObraEditar(o),'ghost'),acao('PDF do dashboard',()=>fmDashboardPdf(o),'ghost'));
    sec.appendChild(intro);
    const acessos=el('<div class="fmhub-acessos" aria-label="Áreas da obra"></div>');
    const doc=atalho('documentos','Documentos','▤','Consultar arquivos','Projetos, contratos e versões');
    acessos.append(atalho('financeiro','Financeiro','◈',x.previsao.ok?brl(x.previsao.lucro)+' de lucro previsto':'Previsão a preencher','Previsão, realizado, sócios, ROI e TIR'),
      atalho('compras','Compras','▣',x.compras.pendentes+' lista(s) pendente(s)','Solicitantes, preços e recebimentos'),doc,
      atalho('imovel','Fotos e descrição','⌂',x.imovel.preenchidos+' de '+x.imovel.totalCampos+' campos preenchidos','Imóvel, galeria e capa da obra'));
    sec.appendChild(acessos);
    const grade=el('<div class="fmhub-grade"></div>'),pend=el('<section class="fmhub-bloco"><div class="fmhub-cab"><h4>O que precisa de atenção</h4></div><div class="fmhub-pendencias"></div></section>');
    pend.querySelector('.fmhub-cab').appendChild(acao('Demandas e etapas →',()=>abrir('demandas'),'ghost'));
    const lista=pend.querySelector('.fmhub-pendencias');
    const add=(titulo,nota,id)=>{const b=el('<button type="button" class="fmhub-pendencia"><strong></strong><small></small><span aria-hidden="true">→</span></button>');b.querySelector('strong').textContent=titulo;b.querySelector('small').textContent=nota;b.onclick=()=>abrir(id);lista.appendChild(b)};
    if(x.compras.pendentes)add(x.compras.pendentes+' lista(s) de compras a acompanhar',x.compras.atrasadas+' atrasada(s) · '+x.compras.parciais+' com recebimento parcial','compras');
    const ordenadas=[...x.abertas].sort((a,b)=>String(a.prazo||'9999').localeCompare(String(b.prazo||'9999')));
    for(const t of ordenadas.slice(0,4))add(t.titulo,[t.situacao,t.responsavel||'Responsável a informar',t.prazo?fmtDataAno(t.prazo)+(t.prazo<hoje()?' · Atrasada':''):'Sem prazo',t.proximaAcao].filter(Boolean).join(' · '),'demandas');
    if(ordenadas.length>4)add('Ver todas as '+ordenadas.length+' demandas abertas','Nenhuma demanda foi ocultada na área completa','demandas');
    if(!lista.children.length)lista.appendChild(el('<p class="fm-nota">Nenhuma pendência registrada. Cadastre demandas ou listas de compras para acompanhar.</p>'));
    const ficha=el('<section class="fmhub-bloco"><div class="fmhub-cab"><h4>O imóvel</h4></div><div class="fmhub-imovel"><div class="fmhub-capa"></div><div><p class="fmhub-endereco"></p><p class="fmhub-descricao"></p></div></div></section>');
    ficha.querySelector('.fmhub-cab').appendChild(acao('Ver fotos e descrição →',()=>abrir('imovel'),'ghost'));
    ficha.querySelector('.fmhub-endereco').textContent=fmObraDescricao(o)||'Endereço e áreas a informar';ficha.querySelector('.fmhub-descricao').textContent=x.imovel.descricaoComercial||'Adicione características, ambientes e descrição do imóvel.';
    const capa=ficha.querySelector('.fmhub-capa');capa.innerHTML='<img src="./fortemais-3d/nav-obras.webp" alt="Ilustração de uma obra"><small>Foto de capa a escolher</small>';
    if(x.imovel.capaId)arqPor('obra:'+o.id).then(arquivos=>{const a=arquivos.find(a=>a.id===x.imovel.capaId&&a.ref==='obra:'+o.id&&/^image\/(jpeg|png|webp|gif|bmp)$/i.test(a.tipo||''));if(!a)throw Error('Capa sem vínculo válido com esta obra');return arqUrlDe(a.id,false)}).then(url=>{const u=new URL(url);if(!['https:','http:','blob:'].includes(u.protocol)||u.username||u.password)throw Error('URL inválida');if(r!==rodada||!sec.isConnected){if(url.startsWith('blob:')&&typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(url);return}urlCapa=url;const img=el('<img alt="Foto de capa da obra" decoding="async" loading="lazy">');img.src=url;img.onerror=()=>{capa.textContent='Capa indisponível. Consulte a galeria.'};capa.replaceChildren(img)}).catch(()=>{if(r===rodada)capa.textContent='Capa indisponível. Consulte a galeria.'});
    grade.append(pend,ficha);sec.appendChild(grade);
    const etapas=el('<section class="fmhub-bloco"><div class="fmhub-cab"><h4>Acompanhamento por etapa</h4></div><div class="fmhub-etapas"></div><p class="fm-nota">Conclusão das demandas cadastradas; não representa medição física da obra.</p></section>');
    etapas.querySelector('.fmhub-cab').appendChild(acao('Organizar etapas →',()=>abrir('demandas'),'ghost'));
    const todas=[...(x.d.etapas||[]),...(x.tarefas.some(t=>!t.etapaId)?[{id:'',nome:'Sem etapa'}]:[])];
    for(const e of todas){const ts=x.tarefas.filter(t=>(t.etapaId||'')===e.id),n=ts.filter(t=>t.situacao==='Resolvida').length;const linha=el('<div class="fmhub-etapa"><strong></strong><span></span><progress max="100"></progress></div>');linha.querySelector('strong').textContent=e.nome;linha.querySelector('span').textContent=ts.length?n+' de '+ts.length+' demandas resolvidas':'Sem demandas registradas';const bar=linha.querySelector('progress');bar.value=ts.length?n/ts.length*100:0;bar.setAttribute('aria-label',e.nome+': '+linha.querySelector('span').textContent);etapas.querySelector('.fmhub-etapas').appendChild(linha)}
    if(!todas.length)etapas.querySelector('.fmhub-etapas').appendChild(el('<p class="fm-nota">Nenhuma etapa cadastrada.</p>'));sec.appendChild(etapas);

  }
  sec.atualizar=atualizar;sec.descartar=()=>{rodada++;liberar()};sec._fmDispose=sec.descartar;atualizar();return sec;
}
function fmDashboardPdf(o){
  if(!fmPodeNavegar())return;const obra=structuredClone(o),x=fmDashboardResumo(obra),texto=fmPdfTexto;
  const ficha=[['Situação',obra.status||'Em planejamento'],['Responsável',x.imovel.responsavel||'Não informado'],['Início',obra.inicio?fmtDataAno(obra.inicio):'Não informado'],['Conclusão prevista',obra.fim?fmtDataAno(obra.fim):'Não informada']];
  const demandas=x.tarefas.map(t=>[texto(t.titulo),texto((x.d.etapas||[]).find(e=>e.id===t.etapaId)?.nome||'Sem etapa'),texto(t.situacao),texto(t.responsavel||'Não informado'),fmPdfData(t.prazo,'Sem prazo'),texto(t.proximaAcao)]);
  const conteudo=fmPdfSecao('Identificação',fmPdfTabela(['Campo','Informação'],ficha.map(row=>row.map(texto))))+
    fmPdfSecao('Resumo financeiro previsto',x.previsao.ok?fmPdfTabela(['Venda prevista','Custo previsto','Lucro previsto'],[[brl(x.previsao.venda),brl(x.previsao.custo),brl(x.previsao.lucro)]]):'<p>Previsão incompleta.</p>')+
    fmPdfSecao('Compras',`<p>${x.compras.totalListas} lista(s) · ${x.compras.pendentes} pendente(s) · ${x.compras.atrasadas} atrasada(s) · ${x.compras.parciais} com recebimento parcial.</p><p>Compras operacionais não geram despesas neste painel. Itens e preços estão no PDF de Compras.</p>`)+
    fmPdfSecao('Todas as demandas e próximas ações',demandas.length?fmPdfTabela(['Demanda','Etapa','Situação','Responsável','Prazo','Próxima ação'],demandas):'<p>Nenhuma demanda registrada.</p>')+
    fmPdfSecao('Descrição do imóvel','<p>'+texto(x.imovel.descricaoComercial||'Não informada')+'</p><p>Projetos, documentos e imagens originais permanecem disponíveis nas áreas próprias da obra.</p>');
  return fmPdfAbrir({obra,geradoEm:hoje(),escopo:'Dashboard da obra',nota:'Resumo operacional. Indicadores financeiros previstos não representam valores realizados.',conteudo});
}
