function fmComprasBase(o){return {estado:E,referencia:o.fmCompras,texto:JSON.stringify(o.fmCompras),tinha:Object.hasOwn(o,'fmCompras')}}
function fmComprasGravar(o,dados,base){
  if(E!==base.estado||!E.obras.includes(o)||o.fmCompras!==base.referencia||JSON.stringify(o.fmCompras)!==base.texto)throw Error('As compras foram atualizadas enquanto você editava. Seu rascunho foi mantido; confira os dados e reabra a edição.');
  FortemaisComprasModelo.validar(dados);const mt=E._mt,tinhaMt=Object.hasOwn(E,'_mt');o.fmCompras=dados;
  try{salvar()}catch(e){if(base.tinha)o.fmCompras=base.referencia;else delete o.fmCompras;if(tinhaMt)E._mt=mt;else delete E._mt;throw Error('Não foi possível salvar a compra. Os dados anteriores e seu rascunho foram mantidos.');}
  return dados;
}
function fmComprasBotao(texto,fn,classe='ghost'){const b=el('<button type="button" class="btn"></button>');b.textContent=texto;if(classe)b.classList.add(classe);b.onclick=fn;return b;}
function fmComprasCampo(nome,rotulo,valor='',tipo='text',opcoes=[]){
  const c=el('<label class="fmc-campo"><span></span></label>');c.firstElementChild.textContent=rotulo;
  const i=document.createElement(tipo==='select'?'select':tipo==='textarea'?'textarea':'input');i.name=nome;
  if(tipo==='select'){for(const [v,t] of opcoes){const op=document.createElement('option');op.value=v;op.textContent=t;op.selected=v===valor;i.appendChild(op);}}
  else{if(tipo==='textarea')i.rows=3;else i.type=tipo;i.value=valor??'';}
  if(FortemaisComprasModelo.LIMITES[nome])i.maxLength=FortemaisComprasModelo.LIMITES[nome];
  c.appendChild(i);return c;
}
function fmComprasDecimal(valor,casas,rotulo,ausente=false){
  const v=String(valor??'').trim();if(!v&&ausente)return null;
  if(!new RegExp('^\\d+(?:[.,]\\d{1,'+casas+'})?$').test(v))throw Error('Confira '+rotulo+': use número não negativo com até '+casas+' casas decimais.');
  const n=Number(v.replace(',','.'));if(!Number.isFinite(n))throw Error('Confira '+rotulo+'.');return n;
}
function fmComprasValor(v){return v==null?'':(v/100).toFixed(2).replace('.',',');}
function fmComprasMoeda(v){return v==null?'Não informado':brl(v/100);}
function fmComprasTotalTexto(t){return t.centavos===null?'Não informado':(t.completo?'':'Parcial: ')+fmComprasMoeda(t.centavos);}
function fmComprasPdf(o,listas){
  if(typeof fmPdfAbrir!=='function')throw Error('O PDF não está disponível. Atualize a página e tente novamente.');
  const obra=structuredClone(o),selecionadas=structuredClone(listas),M=FortemaisComprasModelo;M.validar({versao:1,listas:selecionadas});
  const t=fmPdfTexto,valor=v=>t(fmComprasMoeda(v));
  const conteudo=selecionadas.map(l=>{
    const linhas=l.itens.map(i=>[t(i.descricao)+(i.especificacao?'<small>'+t(i.especificacao)+'</small>':''),t(i.quantidade+' '+i.unidade),t(i.recebido+' '+i.unidade),...M.BASES.map(b=>valor(i[b])+'<small>Total do item: '+valor(M.totalItem(i,b))+'</small>')]);
    const totais=M.BASES.map(b=>{const x=M.totalLista(l,b);return[t(b),valor(x.subtotalCentavos)+'<small>'+x.informados+' de '+x.totalItens+' itens com preço</small>',valor(x.freteCentavos),valor(x.descontoCentavos),t(fmComprasTotalTexto(x))];});
    return fmPdfSecao(t(l.titulo),'<p>'+t([M.ROTULOS[l.situacao],'Solicitante: '+(l.solicitante||'Não informado'),'Solicitação: '+fmtDataAno(l.data),'Prazo: '+(l.prazo?fmtDataAno(l.prazo):'Não informado'),'Prioridade: '+l.prioridade,'Fornecedor: '+(l.fornecedor||'Não informado')].join(' · '))+'</p>'+fmPdfTabela(['Item e especificação','Quantidade','Recebido','Unitário estimado','Unitário cotado','Unitário comprado'],linhas,[29,13,13,15,15,15])+fmPdfTabela(['Base','Subtotal conhecido','Frete (+)','Desconto (−)','Total da base'],totais,[16,24,18,18,24])+(l.obs?'<p>'+t(l.obs)+'</p>':'')+(l.situacao==='cancelado'?'<p>Lista cancelada: excluída dos totais de compras.</p>':''));
  }).join('');
  return fmPdfAbrir({obra,geradoEm:hoje(),escopo:'Conferência de compras',nota:'Preços unitários e totais por base. Valores parciais indicam preços ainda não informados. Este acompanhamento não gera despesas no Financeiro.',conteudo});
}
function fmComprasPainel(o){
  const M=FortemaisComprasModelo,sec=el('<section class="fmc-painel" data-fm-pagina="compras" aria-label="Compras da obra"></section>');sec._fmDirty=false;
  const cab=el('<header class="fmc-cab"><div><h3>Compras da obra</h3><p>Solicite materiais, compare preços e confira a entrega.</p></div><div class="fmc-acoes"></div></header>');
  const nota=el('<p class="fmc-nota">Compras não geram despesas no Financeiro. Registre os pagamentos pelo fluxo financeiro habitual.</p>');
  const aviso=el('<p class="fmc-aviso" role="status" hidden></p>'),falha=el('<p class="fmc-erro" role="alert" hidden></p>');
  const resumos=el('<div class="fmc-resumos"></div>'),filtros=el('<div class="fmc-filtros"></div>');
  const busca=fmComprasCampo('buscaCompras','Buscar lista ou material','','search'),situacao=fmComprasCampo('filtroCompras','Situação','','select',[['','Todas'],...M.SITUACOES.map(s=>[s,M.ROTULOS[s]])]);
  const edicao=el('<div class="fmc-edicao"></div>'),corpo=el('<div class="fmc-listas"></div>');
  let editor=null,enviando=0,visiveis=[];
  const mensagem=txt=>{aviso.textContent=txt;aviso.hidden=!txt;};
  const erro=txt=>{falha.textContent=txt;falha.hidden=!txt;};
  const dados=()=>{M.validar(o.fmCompras);return o.fmCompras||{versao:1,listas:[]};};
  const notificarSalvo=()=>{mensagem('Compra salva neste navegador. Acompanhe a sincronização no topo da Central.');if(typeof fmObrasAtualizarResumo==='function')fmObrasAtualizarResumo(o);};
  function bloqueado(){if(editor||enviando){mensagem('Salve ou cancele a edição e aguarde o envio dos arquivos para continuar.');return true;}return false;}
  function fechar(){editor=null;sec._fmDirty=!!enviando;edicao.replaceChildren();pintar();}
  function nova(){return {titulo:'',solicitante:'',data:hoje(),prioridade:'normal',prazo:'',obs:'',fornecedor:'',situacao:'solicitado',itens:[],ajustes:Object.fromEntries(M.BASES.map(b=>[b,{frete:0,desconto:0}]))};}
  function editar(item,recebimento=false){
    if(bloqueado())return;erro('');const base=fmComprasBase(o),estado=structuredClone(item||nova()),form=el('<form class="fmc-editor"></form>'),titulo=el('<h4></h4>');titulo.textContent=recebimento?'Conferir recebimento':item?'Editar lista':'Nova lista de compras';form.appendChild(titulo);
    const e=el('<p class="fmc-erro" role="alert" hidden></p>');let ler;
    if(recebimento){
      const orientacao=el('<p class="fmc-nota">Informe a quantidade total já recebida de cada item. A situação será atualizada ao salvar.</p>');form.appendChild(orientacao);
      for(const i of estado.itens){const linha=el('<div class="fmc-recebimento"></div>'),nome=el('<p></p>');nome.textContent=i.descricao+' · Solicitado: '+i.quantidade+' '+i.unidade;const campo=fmComprasCampo(i.id,'Total recebido',i.recebido);campo.querySelector('input').inputMode='decimal';linha.append(nome,campo);form.appendChild(linha);}
      ler=()=>Object.fromEntries(estado.itens.map(i=>[i.id,fmComprasDecimal(form.querySelector('[name="'+i.id+'"]').value,3,'a quantidade recebida')]));
    }else{
      const principal=el('<div class="fmc-grade"></div>');
      principal.append(fmComprasCampo('titulo','Título da lista',estado.titulo),fmComprasCampo('solicitante','Solicitante',estado.solicitante),fmComprasCampo('data','Data da solicitação',estado.data,'date'),fmComprasCampo('prazo','Prazo de entrega',estado.prazo,'date'),fmComprasCampo('prioridade','Prioridade',estado.prioridade,'select',M.PRIORIDADES.map(x=>[x,x==='alta'?'Alta':x==='baixa'?'Baixa':'Normal'])),fmComprasCampo('situacao','Situação',estado.situacao,'select',M.SITUACOES.filter(s=>!['parcial','recebido'].includes(s)||s===estado.situacao).map(s=>[s,M.ROTULOS[s]])));
      form.appendChild(principal);const itens=el('<div class="fmc-itens-editor"></div>');form.appendChild(itens);
      const adicionar=(i={id:uid(),descricao:'',especificacao:'',quantidade:1,unidade:'un',recebido:0,estimado:null,cotado:null,comprado:null})=>{
        const linha=el('<fieldset class="fmc-item-editor"><legend>Material</legend><div class="fmc-item-principal"></div><details class="fmc-detalhes"><summary>Especificação e preços opcionais</summary><div class="fmc-item-complemento"></div></details></fieldset>');linha.dataset.id=i.id;linha._recebido=i.recebido;
        linha.querySelector('.fmc-item-principal').append(fmComprasCampo('descricao','Descrição',i.descricao),fmComprasCampo('quantidade','Quantidade',i.quantidade),fmComprasCampo('unidade','Unidade',i.unidade));linha.querySelector('[name=quantidade]').inputMode='decimal';
        const complemento=linha.querySelector('.fmc-item-complemento');complemento.appendChild(fmComprasCampo('especificacao','Especificação',i.especificacao,'textarea'));
        const precos=el('<div class="fmc-precos"></div>');for(const b of M.BASES){const campo=fmComprasCampo(b,'Unitário '+b+' (R$)',fmComprasValor(i[b]));campo.querySelector('input').inputMode='decimal';precos.appendChild(campo);}complemento.appendChild(precos);
        const remover=fmComprasBotao('Remover item',()=>{if(linha._recebido){e.textContent='Este item já tem recebimento. Ajuste a conferência antes de removê-lo.';e.hidden=false;return;}linha.remove();sec._fmDirty=true;});remover.disabled=i.recebido>0;linha.appendChild(remover);itens.appendChild(linha);return linha;
      };
      (estado.itens.length?estado.itens:[undefined]).forEach(i=>adicionar(i));
      form.appendChild(fmComprasBotao('+ Adicionar item',()=>{adicionar().querySelector('input').focus();sec._fmDirty=true;}));
      const extra=el('<details class="fmc-detalhes"><summary>Fornecedor, frete, desconto e observações</summary><div class="fmc-complemento"></div></details>'),ec=extra.querySelector('.fmc-complemento');ec.appendChild(fmComprasCampo('fornecedor','Fornecedor',estado.fornecedor));
      const ajuda=el('<p class="fmc-nota">Cada frete e desconto pertence somente à base indicada. Deixe 0 quando não houver ajuste. Preço em branco significa não informado.</p>');ec.appendChild(ajuda);
      for(const b of M.BASES){const grupo=el('<fieldset class="fmc-ajustes"><legend></legend><div class="fmc-grade"></div></fieldset>');grupo.querySelector('legend').textContent='Base '+b;const grade=grupo.querySelector('.fmc-grade');for(const k of ['frete','desconto']){const c=fmComprasCampo(b+'_'+k,(k==='frete'?'Frete (+)':'Desconto (−)')+' R$',fmComprasValor(estado.ajustes[b][k]));c.querySelector('input').inputMode='decimal';grade.appendChild(c);}ec.appendChild(grupo);}
      ec.appendChild(fmComprasCampo('obs','Observações',estado.obs,'textarea'));form.appendChild(extra);
      ler=()=>{
        const valor=k=>form.querySelector('[name='+k+']').value.trim(),l={};for(const k of ['titulo','solicitante','data','prazo','prioridade','situacao','fornecedor','obs'])l[k]=valor(k);
        l.itens=[...itens.children].map(linha=>{const v=k=>linha.querySelector('[name='+k+']').value.trim(),i={id:linha.dataset.id,descricao:v('descricao'),especificacao:v('especificacao'),quantidade:fmComprasDecimal(v('quantidade'),3,'a quantidade'),unidade:v('unidade'),recebido:linha._recebido};for(const b of M.BASES){const n=fmComprasDecimal(v(b),2,'o preço '+b,true);i[b]=n===null?null:Math.round(n*100);}return i;});
        l.ajustes=Object.fromEntries(M.BASES.map(b=>[b,Object.fromEntries(['frete','desconto'].map(k=>[k,Math.round(fmComprasDecimal(valor(b+'_'+k),2,k+' '+b)*100)]))]));return l;
      };
    }
    const retrato=()=>JSON.stringify([...form.querySelectorAll('input,select,textarea')].map(i=>[i.name,i.value]));const inicial=retrato();
    form.addEventListener('input',()=>{sec._fmDirty=retrato()!==inicial;});form.addEventListener('change',()=>{sec._fmDirty=retrato()!==inicial;});
    const acoes=el('<div class="fmc-acoes"></div>');acoes.append(el('<button type="submit" class="btn">Salvar '+(recebimento?'recebimento':'lista')+'</button>'),fmComprasBotao('Cancelar edição',()=>{if(!sec._fmDirty||confirm('Descartar as alterações não salvas?'))fechar();}));form.append(e,acoes);
    form.onsubmit=evento=>{evento.preventDefault();e.hidden=true;try{const entrada=ler(),novos=recebimento?M.receber(dados(),item.id,entrada):M.salvar(dados(),entrada,item?.id,()=>uid());fmComprasGravar(o,novos,base);}catch(ex){e.textContent=ex.message;e.hidden=false;sec._fmDirty=true;return;}fechar();notificarSalvo();};
    editor=form;edicao.replaceChildren(form);form.querySelector('input')?.focus();pintar();
  }
  function anexos(l){
    const bloco=el('<div class="fmc-anexos"><p class="fmc-nota">Arquivos desta lista. O estado de envio aparece junto ao arquivo.</p><div class="fmc-arquivos"></div><div class="fmc-acoes"></div><input type="file" multiple hidden><p class="fmc-erro" role="alert" hidden></p></div>'),lista=bloco.querySelector('.fmc-arquivos'),input=bloco.querySelector('input'),av=bloco.querySelector('[role=alert]'),ref='obra:'+o.id+':compra:'+l.id;
    function avisar(t){av.textContent=t;av.hidden=!t;}
    async function atualizar(){
      lista.replaceChildren(el('<p class="fmc-nota">Carregando arquivos…</p>'));try{
        const registros=await arqPor(ref);lista.replaceChildren();if(!registros.length)lista.appendChild(el('<p class="fmc-nota">Nenhum arquivo nesta lista.</p>'));
        for(const a of registros){const row=el('<div class="fmc-arquivo"><span></span></div>');row.querySelector('span').textContent=a.nome+(a.pendente?' · Pendente neste aparelho':' · Na nuvem');
          const baixar=fmComprasBotao('Baixar',async()=>{try{const u=new URL(await arqUrlDe(a.id,true));if(!['https:','http:','blob:'].includes(u.protocol)||u.username||u.password)throw Error('Endereço inválido');const link=el('<a target="_blank" rel="noopener noreferrer"></a>');link.href=u.href;link.download=a.nome;document.body.appendChild(link);link.click();link.remove();}catch(e){avisar('Não foi possível baixar o arquivo. Confira a conexão e tente novamente.');}});row.appendChild(baixar);lista.appendChild(row);}
      }catch(e){lista.replaceChildren();avisar('Não foi possível consultar os arquivos desta lista. Tente atualizar.');}
    }
    const adicionar=fmComprasBotao('Adicionar arquivos',()=>{if(!bloqueado())input.click();}),refresh=fmComprasBotao('Atualizar arquivos',()=>atualizar());bloco.querySelector('.fmc-acoes').append(adicionar,refresh);
    input.onchange=async()=>{
      const files=[...(input.files||[])];input.value='';if(!files.length||bloqueado())return;const base=fmComprasBase(o);enviando++;sec._fmDirty=true;adicionar.disabled=true;refresh.disabled=true;novo.disabled=true;pdf.disabled=true;busca.querySelector('input').disabled=true;situacao.querySelector('select').disabled=true;adicionar.textContent='Enviando…';let n=0;const erros=[];
      try{for(const file of files){if(E!==base.estado||!E.obras.includes(o)||o.fmCompras!==base.referencia||JSON.stringify(o.fmCompras)!==base.texto)throw Error('A obra foi atualizada durante o envio. Reabra a lista para anexar os demais arquivos.');try{await arqAdd(ref,file);n++;}catch(e){erros.push(e.message||'Falha ao anexar '+file.name);}}}catch(e){erros.push(e.message);}finally{enviando--;sec._fmDirty=!!editor||!!enviando;adicionar.disabled=false;refresh.disabled=false;novo.disabled=false;pdf.disabled=!visiveis.length;busca.querySelector('input').disabled=false;situacao.querySelector('select').disabled=false;adicionar.textContent='Adicionar arquivos';await atualizar();avisar(erros.join(' · '));if(n)mensagem(n+' arquivo(s) anexado(s). Confira o estado de envio na lista.');}
    };
    atualizar();return bloco;
  }
  function pintar(){
    let d,r;try{d=dados();r=M.resumo(d,hoje());}catch(e){erro('Não foi possível ler as compras: '+e.message);novo.disabled=true;pdf.disabled=true;return;}
    resumos.replaceChildren();for(const [titulo,valor] of [['Pendentes',r.pendentes],['Atrasadas',r.atrasadas],['Estimado',fmComprasTotalTexto(r.estimado)],['Comprado',fmComprasTotalTexto(r.comprado)]]){const c=el('<div class="fmc-resumo"><span></span><b></b></div>');c.firstElementChild.textContent=titulo;c.lastElementChild.textContent=valor;resumos.appendChild(c);}
    const texto=busca.querySelector('input').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),s=situacao.querySelector('select').value;
    visiveis=d.listas.filter(l=>(!s||l.situacao===s)&&(!texto||[l.titulo,l.solicitante,l.fornecedor,...l.itens.map(i=>i.descricao+' '+i.especificacao)].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(texto)));
    corpo.replaceChildren();if(!visiveis.length)corpo.appendChild(el('<p class="fmc-vazio">'+(d.listas.length?'Nenhuma lista corresponde aos filtros.':'Crie uma lista com materiais e quantidades. Os preços podem ser preenchidos depois.')+'</p>'));
    for(const l of visiveis){const base=fmComprasBase(o),card=el('<article class="fmc-lista"><div class="fmc-lista-cab"><div><h4></h4><p class="fmc-meta"></p></div><span class="fmc-status"></span></div><p class="fmc-lista-resumo"></p><div class="fmc-acoes"></div><details class="fmc-detalhes fmc-lista-detalhes"><summary>Itens e arquivos</summary><div class="fmc-detalhes-corpo"></div></details></article>');card.dataset.compraId=l.id;card.querySelector('h4').textContent=l.titulo;card.querySelector('.fmc-meta').textContent=[l.solicitante||'Sem solicitante',l.prazo?'Prazo '+fmtDataAno(l.prazo):'Sem prazo',l.prioridade==='alta'?'Alta prioridade':'',l.fornecedor].filter(Boolean).join(' · ');card.querySelector('.fmc-status').textContent=M.ROTULOS[l.situacao]+(M.atrasada(l,hoje())?' · Atrasada':'');
      card.querySelector('.fmc-lista-resumo').textContent=l.itens.length+' item(ns) · Estimado: '+fmComprasTotalTexto(M.totalLista(l,'estimado'))+' · Cotado: '+fmComprasTotalTexto(M.totalLista(l,'cotado'))+' · Comprado: '+fmComprasTotalTexto(M.totalLista(l,'comprado'));
      const acoes=card.querySelector('.fmc-acoes'),edit=fmComprasBotao('Editar',()=>editar(l)),receber=fmComprasBotao('Conferir recebimento',()=>editar(l,true)),cancelar=fmComprasBotao(l.situacao==='cancelado'?'Reativar lista':'Cancelar lista',()=>{
        if(bloqueado())return;const situacao=l.situacao==='cancelado'?(l.itens.every(i=>i.recebido===i.quantidade)?'recebido':l.itens.some(i=>i.recebido>0)?'parcial':'solicitado'):'cancelado';try{fmComprasGravar(o,M.salvar(dados(),{...l,situacao},l.id,()=>uid()),base);pintar();notificarSalvo();}catch(e){erro(e.message);}
      }),imprimir=fmComprasBotao('PDF da lista',()=>exportar([l]));
      edit.disabled=!!editor||!!enviando;receber.disabled=edit.disabled||l.situacao==='cancelado';cancelar.disabled=edit.disabled;imprimir.disabled=edit.disabled;acoes.append(edit,receber,imprimir,cancelar);
      const detalhes=card.querySelector('details'),dc=card.querySelector('.fmc-detalhes-corpo');for(const i of l.itens){const linha=el('<div class="fmc-item-leitura"><p></p><dl class="fmc-item-valores"></dl></div>');linha.querySelector('p').textContent=i.descricao+' · '+i.quantidade+' '+i.unidade+' · Recebido: '+i.recebido+(i.especificacao?' · '+i.especificacao:'');const valores=linha.querySelector('dl');for(const b of M.BASES){const grupo=el('<div><dt></dt><dd></dd></div>');grupo.querySelector('dt').textContent=b[0].toUpperCase()+b.slice(1);grupo.querySelector('dd').textContent='Unitário: '+fmComprasMoeda(i[b])+' · Total: '+fmComprasMoeda(M.totalItem(i,b));valores.appendChild(grupo);}dc.appendChild(linha);}
      if(l.obs){const p=el('<p class="fmc-nota"></p>');p.textContent=l.obs;dc.appendChild(p);}
      let carregou=false;detalhes.addEventListener('toggle',()=>{if(detalhes.open&&!carregou){carregou=true;dc.appendChild(anexos(l));}});corpo.appendChild(card);
    }
    novo.disabled=!!editor||!!enviando;pdf.disabled=!!editor||!!enviando||!visiveis.length;busca.querySelector('input').disabled=!!enviando;situacao.querySelector('select').disabled=!!enviando;
  }
  function exportar(listas=visiveis){if(bloqueado())return false;if(!listas.length){mensagem('Nenhuma lista nesta visão para exportar.');return false;}try{return fmComprasPdf(o,listas);}catch(e){erro(e.message);return false;}}
  const novo=fmComprasBotao('Nova lista',()=>editar(null),''),pdf=fmComprasBotao('PDF de conferência',()=>exportar());cab.querySelector('.fmc-acoes').append(novo,pdf);
  filtros.append(busca,situacao);busca.querySelector('input').oninput=()=>pintar();situacao.querySelector('select').onchange=()=>pintar();sec.append(cab,nota,aviso,falha,resumos,filtros,edicao,corpo);
  sec.exportar=()=>exportar();sec.atualizar=()=>{if(!bloqueado())pintar();};pintar();return sec;
}
