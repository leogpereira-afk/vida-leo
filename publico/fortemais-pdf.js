/* PDFs privados da Fortemais. Leitura de um retrato único; não grava dados. */
function fmPdfTexto(valor){
  const temporaria=endereco=>{
    let u;try{u=new URL(endereco)}catch(e){return true}
    if(u.username||u.password)return true;
    const temCredencial=params=>[...params.keys()].some(nome=>{
      for(let i=0;i<2;i++){try{const decodificado=decodeURIComponent(nome);if(decodificado===nome)break;nome=decodificado}catch(e){break}}
      return /^(?:token|access_token|sig|signature|secret|api[-_]?key|authorization|credential|password|x-amz-.+|x-goog-.+)$/i.test(nome);
    });
    const fragmento=u.hash.slice(1),parametrosFragmento=fragmento.includes('?')?fragmento.slice(fragmento.indexOf('?')+1):fragmento.replace(/^\?/, '');
    return temCredencial(u.searchParams)||temCredencial(new URLSearchParams(parametrosFragmento));
  };
  return esc(String(valor??'').replace(/https?:\/\/[^\s<>"']+/gi,url=>temporaria(url)?'[link temporário omitido]':url));
}
function fmPdfData(valor,vazio='Não informada'){
  return dataISOValida(valor)?esc(fmtDataAno(valor)):vazio;
}
function fmPdfTabela(cabecalhos,linhas,larguras=[]){
  const cols=larguras.length?'<colgroup>'+larguras.map(n=>'<col style="width:'+n+'%">').join('')+'</colgroup>':'';
  return '<table class="pdf-tabela">'+cols+'<thead><tr>'+cabecalhos.map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+linhas.map(celulas=>'<tr>'+celulas.map(c=>typeof c==='object'?'<td class="'+(c.classe||'')+'">'+c.html+'</td>':'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
const fmPdfNumero=html=>({html,classe:'n'});
function fmPdfSecao(titulo,conteudo,classe=''){
  return '<section class="pdf-secao '+classe+'"><h2>'+titulo+'</h2>'+conteudo+'</section>';
}
function fmPdfBase({obra,escopo,nota,conteudo,logo,geradoEm}){
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fmPdfTexto(escopo)} - ${fmPdfTexto(obra.nome||'Obra')} - Fortemais</title><style>
  *{box-sizing:border-box}body{margin:0;background:#edf0f4;color:#232632;font:12px/1.5 Arial,Helvetica,sans-serif}.pdf-tools{position:sticky;top:0;z-index:2;display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:14px 22px;border-bottom:1px solid #d5d9e2;background:white;font-size:13px}.pdf-tools button{border:0;border-radius:9px;background:#242424;color:white;font:600 13px Arial,sans-serif;padding:11px 16px;cursor:pointer}.pdf-tools button:focus-visible{outline:3px solid #283c81;outline-offset:3px}.pdf-tools button:disabled{opacity:.55;cursor:default}.pdf-tools p{margin:0}.pdf-tools [role=status]{color:#555d6e}.pdf-folha{max-width:1080px;background:white;margin:24px auto;padding:34px 38px;box-shadow:0 6px 26px #27324710}.pdf-cab{display:flex;align-items:center;gap:24px;padding-bottom:18px;margin-bottom:18px;border-bottom:3px solid #d5d9e2;break-inside:avoid}.pdf-logo{flex:0 0 auto;background:#242424;border-radius:8px;padding:12px 16px}.pdf-logo img{display:block;width:150px;height:auto}.pdf-cab>div:last-child{min-width:0}.pdf-cab small{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#626b7e}.pdf-cab h1{font-size:25px;line-height:1.25;margin:5px 0;overflow-wrap:anywhere}.pdf-cab p{margin:4px 0;color:#626b7e;overflow-wrap:anywhere}.pdf-contexto{margin:8px 0 18px;color:#626b7e;overflow-wrap:anywhere}.pdf-nota{padding:11px 14px;background:#f3f5f8;border-left:3px solid #7784a3;color:#485267;margin:12px 0;overflow-wrap:anywhere}.pdf-alerta{background:#fff4e7;border-color:#c58a37;color:#64491d}.pdf-metricas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0 22px;break-inside:avoid}.pdf-metrica{border:1px solid #dde2ea;border-radius:9px;padding:12px 14px}.pdf-metrica span{display:block;font-size:10px;color:#626b7e}.pdf-metrica b{display:block;font-size:18px;margin-top:4px;overflow-wrap:anywhere}.pdf-secao{margin:22px 0}.pdf-secao h2{font-size:16px;line-height:1.3;margin:0 0 10px;color:#303b52;break-after:avoid}.pdf-secao h3{font-size:13px;margin:16px 0 8px;break-after:avoid}.pdf-secao p{margin:8px 0;overflow-wrap:anywhere}.pdf-tabela,.fm-tabela{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;margin:8px 0 12px}.pdf-tabela th,.fm-tabela th{padding:8px 9px;background:#eff2f7;color:#4b576e;border-top:1px solid #dde2ea;border-bottom:1px solid #cdd5e1;text-align:left;font-weight:600;overflow-wrap:anywhere}.pdf-tabela td,.fm-tabela td{padding:7px 9px;border-bottom:1px solid #e0e5ed;vertical-align:top;overflow-wrap:anywhere;word-break:normal;white-space:pre-wrap}.pdf-tabela small,.fm-tabela small{display:block;font-size:9px;line-height:1.4;color:#657087;margin-top:3px;overflow-wrap:anywhere}.pdf-tabela .n,.fm-tabela td:not(:first-child),.fm-tabela th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}.n{white-space:normal!important}.pdf-tabela tbody tr:nth-child(even){background:#fafbfd}.fm-linha-venda{background:#edf3fb}.fm-linha-custo{background:#fff4e4}.fm-linha-lucro{background:#e7f4ee;font-weight:700}.fm-total{font-weight:700}.fm-negativo,.pdf-negativo{color:#232632}.pdf-ficha{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 22px;margin:8px 0}.pdf-ficha>div{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}.pdf-ficha span{color:#626b7e;margin-right:8px}.pdf-rodape{border-top:1px solid #dde2ea;padding-top:12px;margin-top:26px;color:#657087;font-size:10px;overflow-wrap:anywhere}thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid}h2,h3{break-after:avoid}p{orphans:3;widows:3}.pdf-nova-pagina{break-before:page}
  @page{size:A4 landscape;margin:13mm 14mm 17mm;@bottom-left{content:"Fortemais Construtora";font:11px Arial;color:#657087}@bottom-right{content:"Página " counter(page) " de " counter(pages);font:11px Arial;color:#657087}}
  @media print{body{background:white;font-size:12px}.pdf-tools{display:none!important}.pdf-folha{max-width:none;margin:0;padding:0;box-shadow:none}.pdf-cab{padding-bottom:12px;margin-bottom:12px}.pdf-cab h1{font-size:22px}.pdf-cab p{font-size:12px}.pdf-logo img{width:135px}.pdf-secao{margin:16px 0}.pdf-tabela,.fm-tabela{font-size:12px}.pdf-tabela td,.fm-tabela td{padding:6px 8px}.pdf-metrica b{font-size:17px}.pdf-contexto{font-size:12px}.pdf-rodape{font-size:11px;margin-top:8px;padding-top:6px;line-height:1.4;break-inside:avoid}.pdf-cab small,.pdf-tabela small,.fm-tabela small,.pdf-metrica span{font-size:11px}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  @media screen and (max-width:650px){.pdf-folha{margin:12px;padding:20px}.pdf-cab{align-items:flex-start;flex-direction:column;gap:12px}.pdf-cab h1{font-size:22px}.pdf-metricas{grid-template-columns:1fr}.pdf-ficha{grid-template-columns:1fr}.pdf-tabela,.fm-tabela{font-size:10px}.pdf-tabela td,.pdf-tabela th,.fm-tabela td,.fm-tabela th{padding:6px 4px}}
  </style></head><body><div class="pdf-tools"><button type="button" id="fm-pdf-salvar" onclick="window.print()">Salvar em PDF</button><p>Na janela de impressão, selecione <b>Salvar como PDF</b>.</p><span id="fm-pdf-estado" role="status"></span></div><main class="pdf-folha"><header class="pdf-cab"><div class="pdf-logo"><img src="${esc(logo)}" alt="Fortemais Construtora"></div><div><small>${fmPdfTexto(escopo)}</small><h1>${fmPdfTexto(obra.nome||'Obra')}</h1><p>${fmPdfTexto(fmObraDescricao(obra))}</p></div></header><div class="pdf-contexto">Gerado em ${fmPdfData(geradoEm)} · ${fmPdfTexto(nota)}</div>${conteudo}<footer class="pdf-rodape">Fortemais Construtora · ${fmPdfTexto(escopo)} · Gerado em ${fmPdfData(geradoEm)}. As datas dos documentos e dos lançamentos são apresentadas nas respectivas seções.</footer></main></body></html>`;
}
async function fmPdfAbrir(modelo){
  const w=window.open('','_blank');if(!w){alert('Libere o pop-up para salvar o relatório em PDF.');return false}w.opener=null;
  let logo;
  try{
    const resposta=await fetch(new URL('fortemais-logo.png',window.location.href));if(!resposta.ok)throw Error('Logo indisponível');
    const blob=await resposta.blob();
    logo=await new Promise((ok,erro)=>{const leitor=new FileReader();leitor.onload=()=>ok(leitor.result);leitor.onerror=erro;leitor.readAsDataURL(blob)});
  }catch(e){w.close();alert('Não foi possível preparar a logo do PDF. Confira sua conexão e tente novamente.');return false}
  if(w.closed)return false;
  w.document.write(fmPdfBase({...modelo,logo}));w.document.close();
  const imagem=w.document.querySelector('.pdf-logo img');
  const imprimir=()=>setTimeout(()=>{if(!w.closed){w.focus();w.print()}},150);
  const falha=()=>{const aviso=w.document.getElementById('fm-pdf-estado');if(aviso)aviso.textContent='A logo não carregou. Confira sua conexão e tente novamente.';const botao=w.document.getElementById('fm-pdf-salvar');if(botao)botao.disabled=true};
  if(imagem.complete){if(imagem.naturalWidth)imprimir();else falha()}else{imagem.addEventListener('load',imprimir,{once:true});imagem.addEventListener('error',falha,{once:true})}
  return true;
}
async function fmPdfPrevisao(o){
  const obra=structuredClone(o),geradoEm=hoje(),{p,prev,linhas,pct,rateioOk}=fmPrevContas(obra);
  const socios=linhas.map(i=>[fmPdfTexto(i.nome)+'<small>'+fmPdfTexto(i.papel||'Investidor')+'</small>',fmPdfNumero(brl(i.aporte)),fmPdfNumero(fmPrevPct(i.pct)),fmPdfNumero(i.lucro==null?'—':brl(i.lucro))]);
  const roi=linhas.map(i=>{const v=fmRoiValores(i),ok=v.aporte!==''&&v.recebimento!==''&&v.aporte>0;return[fmPdfTexto(i.nome)+'<small>'+fmPdfTexto(v.origem)+'</small>',fmPdfNumero(v.aporte===''?'—':brl(v.aporte)),fmPdfNumero(v.recebimento===''?'—':brl(v.recebimento)),fmPdfNumero(ok?brl(v.recebimento-v.aporte):'—'),fmPdfNumero(ok?fmPrevPct((v.recebimento-v.aporte)/v.aporte*100):'—')]});
  const fluxos=[...(p.fluxos||[])].sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))).map(x=>[fmPdfData(x.data),fmPdfTexto(linhas.find(i=>i.id===x.investidorId)?.nome||'Não encontrado'),fmPdfTexto(x.tipo),fmPdfNumero(brl(x.valor)),fmPdfTexto(x.obs)]);
  const conteudo='<p class="pdf-nota">Data da revisão da previsão: não informada. A data de geração deste relatório não representa a data de revisão das estimativas.</p>'+
    (prev.ok?'':'<p class="pdf-nota pdf-alerta">Previsão incompleta: os campos não preenchidos aparecem como desconhecidos.</p>')+
    fmPdfSecao('Previsão de lucro do imóvel',fmPrevTabelaLucro(obra))+
    fmPdfSecao('Distribuição do lucro previsto','<p>'+ (rateioOk?'Participações: 100%.':'Participações a conferir: '+fmPrevPct(pct)+'. O lucro por sócio só é distribuído quando as participações somam 100%.')+'</p>'+ (socios.length?fmPdfTabela(['Investidor','Aporte previsto','Participação','Lucro previsto'],socios,[35,23,18,24]):'<p>Nenhum sócio cadastrado.</p>'))+
    fmPdfSecao('ROI e TIR previstos','<h3>ROI por sócio</h3><p>Valor a receber inclui a devolução do capital. A origem de cada linha é indicada abaixo do nome do sócio.</p>'+ (roi.length?fmPdfTabela(['Sócio e origem','Investido','A receber','Lucro','ROI previsto'],roi,[28,20,20,20,12]):'<p>Nenhum sócio cadastrado.</p>')+'<h3>TIR dos lançamentos previstos</h3>'+fmPrevTabelaRetorno(obra)+'<p>TIR anual, base de 365 dias. Os fluxos são independentes do orçamento e dos valores próprios da ROI.</p>'+ (fluxos.length?fmPdfTabela(['Data prevista','Investidor','Movimento','Valor','Observações'],fluxos,[12,22,20,18,28]):'<p>Sem lançamentos previstos.</p>'),'pdf-nova-pagina');
  return fmPdfAbrir({obra,geradoEm,escopo:'Previsão financeira',nota:'Valores estimados, sem representar resultado realizado.',conteudo});
}
async function fmPdfRealizado(o,resumo,custos=[]){
  const obra=structuredClone(o),r=resumo?structuredClone(resumo):null,livroDisponivel=Array.isArray(custos),livro=livroDisponivel?structuredClone(custos):[],geradoEm=hoje();
  // Todos os helpers e fontes globais são lidos antes de aguardar a logo.
  const c=contasObra(obra,r),ret=retornoAportes(obra,r),aportes=structuredClone(E.obraAportes.filter(x=>x.obra===obra.id));
  const fimValido=dataISOValida(obra.recebidoEm),confirmado=!c.semDados&&c.podeLucro&&fimValido&&ret.vendida;
  const centros=r?Object.entries(r.centros||{}).sort((a,b)=>b[1].total-a[1].total):[];
  const especialidades={};
  livro.forEach(l=>{const e=especDe(l);if(!e)return;const grupo=especialidades[especLimpa(e)]??={mat:0,mao:0,outros:0},n=naturezaCentro(l.centro);grupo[n==='Material'?'mat':n==='Mão de obra'?'mao':'outros']+=(+l.valor||0)});
  const metricas=[['Custo total',c.semDados?'Desconhecido':brl(c.custo)],['Aportes',brl(c.aporte)],['Venda líquida',c.venda?brl(c.liquido):'Não registrada'],['Lucro',c.podeLucro?brl(c.lucro)+' · '+c.margem.toFixed(1)+'%':'Desconhecido'],...(c.area?[['Custo/m² '+((E.obraM2Fora||[]).length?'(grupos escolhidos)':'(com tudo)'),c.semDados?'Desconhecido':brl(c.porM2)]]:[])];
  const kv=(titulo,valor)=>'<div><span>'+titulo+'</span><b>'+valor+'</b></div>';
  const ficha='<div class="pdf-ficha">'+kv('Empresa',fmPdfTexto(obra.empresa||'Fortemais'))+kv('Situação',fmPdfTexto(obra.status||'Não informada'))+kv('Área construída',c.area?esc(c.area)+' m²':'Não informada')+kv('Área do terreno',+obra.areaTerreno?esc(obra.areaTerreno)+' m²':'Não informada')+kv('Data da venda',fmPdfData(obra.vendaData))+kv(fimValido?'Recebimento concluído':'Recebimento pendente',fimValido?fmPdfData(obra.recebidoEm):'Fim do recebimento não informado')+kv('Comprador',fmPdfTexto(obra.comprador||'Não informado'))+kv('Valor da venda',c.venda?brl(c.venda):'Não registrado')+kv('Imposto pago',brl(c.imposto))+kv('Comissão paga',brl(c.comissao))+kv('Outras deduções',brl(c.outras))+(r?.de?kv('Período dos custos',fmPdfData(r.de)+' - '+fmPdfData(r.ate)):'')+'</div>'+(obra.obs?'<p>'+fmPdfTexto(obra.obs)+'</p>':'');
  let conteudo=(c.semDados?'<p class="pdf-nota pdf-alerta">Custos desconhecidos: a base de custos está indisponível. Custo total, custo/m², lucro e taxas que dependem dessa base não estão confirmados.</p>':'')+'<div class="pdf-metricas">'+metricas.map(([k,v])=>'<div class="pdf-metrica"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div>'+fmPdfSecao('Ficha da obra',ficha);
  if(centros.length)conteudo+=fmPdfSecao('Para onde foi o dinheiro',fmPdfTabela(['Plano de contas','Valor','%','Lançamentos'],[...centros.map(([k,v])=>[fmPdfTexto(k),fmPdfNumero(brl(v.total)),fmPdfNumero(r.total?(v.total/r.total*100).toFixed(1)+'%':'—'),fmPdfNumero(esc(v.n??'—'))]),['<b>Total</b>',fmPdfNumero('<b>'+brl(r.total)+'</b>'),'—',fmPdfNumero(esc(r.n??'—'))]],[52,22,13,13]));
  const esp=Object.entries(especialidades).map(([k,v])=>({k,...v,total:v.mat+v.mao+v.outros})).sort((a,b)=>b.total-a.total);
  if(esp.length)conteudo+=fmPdfSecao('Por especialidade - material e mão de obra',fmPdfTabela(['Especialidade','Material','Mão de obra','Outros','Total'],esp.map(l=>[fmPdfTexto(l.k),fmPdfNumero(l.mat?brl(l.mat):'—'),fmPdfNumero(l.mao?brl(l.mao):'—'),fmPdfNumero(l.outros?brl(l.outros):'—'),fmPdfNumero(brl(l.total))]),[32,17,17,17,17]));
  if(aportes.length){
    conteudo+=fmPdfSecao('Aportes',fmPdfTabela(['Data','Quem','Valor','Observações'],[...aportes.sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))).map(x=>[fmPdfData(x.data),fmPdfTexto(x.quem),fmPdfNumero(brl(+x.valor||0)),fmPdfTexto(x.obs)]),['<b>Total</b>','',fmPdfNumero('<b>'+brl(c.aporte)+'</b>'),'']],[13,25,20,42]));
    const cab=['Quem','Aportou','% do lucro',...(confirmado?['Lucro que lhe cabe','ROI','TIR']:[])];
    const linhas=ret.linhas.map(li=>[fmPdfTexto(li.quem),fmPdfNumero(brl(li.total)),fmPdfNumero((li.fatia*100).toFixed(1)+'%'),...(confirmado?[fmPdfNumero(brl(li.parte)),fmPdfNumero(li.roi==null?'—':li.roi.toFixed(1)+'%'),fmPdfNumero(li.tir==null?'—':li.tir.toFixed(1)+'% a.a.')]:[])]);
    const motivos=[...(c.semDados?['base de custos desconhecida']:[]),...(!fimValido?['fim do recebimento não informado']:[]),...(!c.venda?['venda não registrada']:[])];
    conteudo+=fmPdfSecao('Retorno dos aportes',(!confirmado?'<p class="pdf-nota pdf-alerta">ROI e TIR não confirmados: '+motivos.join('; ')+'. Os aportes e a participação permanecem disponíveis para consulta.</p>':'')+fmPdfTabela(cab,linhas,confirmado?[24,19,13,20,11,13]:[50,30,20])+(ret.usaManual&&Math.abs(ret.somaManual-100)>.01?'<p class="pdf-nota pdf-alerta">As porcentagens somam '+ret.somaManual.toFixed(1)+'%, não 100%.</p>':'')+'<p>'+ (ret.usaManual?'Divisão pela porcentagem combinada entre as partes.':'Divisão pelo tempo que o dinheiro de cada um ficou na obra (nenhuma porcentagem foi definida).')+(confirmado?' ROI é o rendimento total; TIR é o rendimento por ano, pelas datas dos aportes até '+fmPdfData(obra.recebidoEm)+'.':'')+'</p>');
  }else if(!confirmado)conteudo+='<p class="pdf-nota">ROI e TIR pendentes: registre os aportes, a venda, o fim do recebimento e uma base de custos conhecida.</p>';
  if(livro.length)conteudo+=fmPdfSecao('Livro-caixa - todos os lançamentos ('+livro.length+')',fmPdfTabela(['Data','O que','Plano de contas','Fornecedor','Valor'],livro.sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))).map(l=>[fmPdfData(l.data),fmPdfTexto(l.nome),fmPdfTexto(l.centro),fmPdfTexto(l.fornecedor),fmPdfNumero(brl(l.valor))]),[12,30,20,22,16]),'pdf-nova-pagina');
  else conteudo+=fmPdfSecao('Livro-caixa',livroDisponivel?'<p>Nenhum lançamento retornado nesta consulta.</p>':'<p class="pdf-nota pdf-alerta">Não foi possível consultar o livro-caixa. O resumo disponível da obra permanece neste relatório, mas a lista de lançamentos não foi confirmada.</p>');
  return fmPdfAbrir({obra,geradoEm,escopo:'Realizado e histórico',nota:'Cadastro da obra, aportes e livro-caixa. Previsões financeiras são exportadas em outro relatório.',conteudo});
}
async function fmPdfDocumentos(o,lista=[],opcoes={}){
  const obra=structuredClone(o),documentos=structuredClone(lista),op=structuredClone(opcoes),geradoEm=hoje();
  const referencia=v=>/^[\w.:-]{1,200}$/.test(String(v||''))?fmPdfTexto(v):'Identificador não informado';
  const rows=documentos.map(a=>{const m=a.meta||a,situacao=a.pendente?'Pendente de sincronização':a.nuvem?'Na nuvem':'Neste aparelho';return[
    fmPdfTexto(m.titulo||a.nome||'Documento sem título')+'<small>Arquivo: '+fmPdfTexto(a.nome||'Nome não informado')+'</small>'+(m.descricao?'<small>'+fmPdfTexto(m.descricao)+'</small>':'')+'<small>ID: '+referencia(a.id)+'</small>',
    fmPdfTexto(m.categoria||'Sem categoria')+'<small>'+fmPdfTexto(a.origem||'Origem não informada')+'</small>',
    fmPdfData(m.dataDocumento,'Data do documento não informada')+'<small>Incluído em: '+fmPdfData(a.em)+'</small>',
    fmPdfTexto(m.revisao||'Não informada'),
    situacao+(m.arquivado?'<small>Arquivado</small>':'')+'<small>'+fmPdfTexto(a.tipo||'Tipo não informado')+' · '+fmPdfTexto(tamanho(Number(a.tam)||0))+'</small><small>Vínculo: '+referencia(a.ref)+'</small>'
  ]});
  const pendentes=documentos.filter(a=>a.pendente).length,nuvem=documentos.filter(a=>a.nuvem&&!a.pendente).length;
  const filtros=[op.escopo,...(op.categoria!=null?['Categoria: '+(op.categoria||'Todas')]:[]),...(op.busca!=null?['Busca: '+(op.busca||'Sem busca')]:[])].filter(Boolean);
  if(!filtros.length&&op.filtro)filtros.push(op.filtro);
  const conteudo='<div class="pdf-metricas"><div class="pdf-metrica"><span>Documentos nesta seleção</span><b>'+documentos.length+'</b></div><div class="pdf-metrica"><span>Na nuvem</span><b>'+nuvem+'</b></div><div class="pdf-metrica"><span>Pendentes de sincronização</span><b>'+pendentes+'</b></div></div>'+
    (op.nuvemDisponivel===false?'<p class="pdf-nota pdf-alerta">A consulta à nuvem está indisponível. Este índice contém os documentos disponíveis nesta seleção; a lista remota pode estar incompleta.</p>':'')+
    (op.localDisponivel===false?'<p class="pdf-nota pdf-alerta">A consulta local está indisponível. A lista de arquivos neste aparelho pode estar incompleta.</p>':'')+
    (filtros.length?'<p class="pdf-nota">Seleção: '+filtros.map(fmPdfTexto).join(' · ')+'.</p>':'')+
    fmPdfSecao('Índice de projetos e documentos',rows.length?fmPdfTabela(['Documento e arquivo','Categoria e origem','Datas','Revisão','Situação e referência'],rows,[32,20,18,10,20]):'<p>Nenhum documento nesta seleção.</p>')+
    '<p class="pdf-nota">A data de inclusão identifica quando o arquivo foi adicionado. A data do documento só aparece quando foi informada. O índice permite localizar os arquivos pelo nome e pelo identificador; os arquivos anexados não são incorporados a este relatório.</p>';
  return fmPdfAbrir({obra,geradoEm,escopo:'Projetos e documentos',nota:'Índice dos arquivos selecionados, com fontes e datas registradas.',conteudo});
}
