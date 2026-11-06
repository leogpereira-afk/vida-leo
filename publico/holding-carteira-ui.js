/* Lançamentos patrimoniais e mensais no resumo da holding. Os editores guardam
   a base da abertura para o adaptador conferir concorrência em cada registro. */
const holdingRenderCarteira = (() => {
  const reais = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});
  const decimal = new Intl.NumberFormat('pt-BR', {useGrouping:false, maximumFractionDigits:2});
  const competenciaBR = new Intl.DateTimeFormat('pt-BR', {month:'long', year:'numeric', timeZone:'UTC'});
  const moeda = centavos => centavos == null ? 'A informar' : reais.format(centavos / 100);
  const textoValor = centavos => centavos == null ? '' : decimal.format(centavos / 100);
  const nomeMes = mes => competenciaBR.format(new Date(mes + '-15T12:00:00Z'));

  function elemento(tag, classe, texto) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto != null) no.textContent = texto;
    return no;
  }

  function acao(texto, executar, rotulo) {
    const botao = elemento('button','hcar-acao',texto);
    botao.type = 'button';
    if (rotulo) botao.setAttribute('aria-label',rotulo);
    botao.addEventListener('click',executar);
    return botao;
  }

  function campo(form, rotulo, nome, valor, opcoes = {}) {
    const label = elemento('label','hcar-campo');
    const input = elemento('input');
    input.type = 'text'; input.name = nome; input.value = valor ?? '';
    if (opcoes.decimal) { input.inputMode = 'decimal'; input.placeholder = 'A informar'; }
    if (opcoes.obrigatorio) input.required = true;
    if (opcoes.limite) input.maxLength = opcoes.limite;
    label.append(elemento('span','',rotulo),input);
    form.append(label);
    return input;
  }

  function valor(input) {
    const n = HoldingModelo.centavos(input.value.trim());
    if (n != null && n < 0) throw Error('Informe um valor maior ou igual a zero.');
    return n;
  }

  function percentual(input) {
    const centesimos = valor(input);
    if (centesimos != null && centesimos > 10000) throw Error('Informe uma participação entre 0% e 100%.');
    return centesimos == null ? null : centesimos / 100;
  }

  function metrica(dl, nome, texto) {
    const item = elemento('div','hcar-metrica');
    item.append(elemento('dt','',nome),elemento('dd','',texto));
    dl.append(item);
  }

  function seletorEmpresa(form, api, empresa, nome) {
    const titular = elemento('label','hcar-campo');
    const select = elemento('select'); select.name = 'empresaId';
    const semVinculo = elemento('option','','Sem vínculo com Empresas'); semVinculo.value = '';
    select.append(semVinculo);
    const opcoes = [...api.listarEmpresasPJ()].filter(item=>item?.id && item.nome).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    for (const item of opcoes) {
      const opt = elemento('option','',item.nome); opt.value=item.id;
      opt.selected = empresa?.empresaId === item.id; select.append(opt);
    }
    if (empresa?.empresaId && !opcoes.some(item=>item.id===empresa.empresaId)) {
      const opt = elemento('option','',(empresa.nome || 'Empresa')+' · cadastro indisponível');
      opt.value=empresa.empresaId;opt.selected=true;select.append(opt);
    }
    semVinculo.selected = !empresa?.empresaId;
    titular.append(elemento('span','','Vínculo com Empresas da Central'),select);
    nome.closest('label').before(titular);
    let nomeLivre = empresa?.empresaId ? '' : nome.value;
    function aplicar() {
      const id=select.value || '';
      if (id) {
        if (!nome.readOnly) nomeLivre=nome.value;
        nome.value=opcoes.find(item=>item.id===id)?.nome || empresa?.nome || '';
      } else if (nome.readOnly) nome.value=nomeLivre;
      nome.readOnly=Boolean(id);
    }
    select.addEventListener('change',aplicar);aplicar();
    return select;
  }

  function campoMonetario(form, nome, rotulo, centavos) {
    return campo(form,rotulo,nome,textoValor(centavos),{decimal:true});
  }

  function editorEmpresa(form,api,empresa) {
    const base=empresa ? structuredClone(empresa) : null;
    const id=empresa?.id || api.novoId();
    const nome=campo(form,'Nome da empresa','nome',empresa?.nome,{obrigatorio:true,limite:180});
    const vinculo=seletorEmpresa(form,api,empresa,nome);
    const pct=campo(form,'Participação da holding (%)','participacao',empresa?.participacaoPct==null?'':decimal.format(empresa.participacaoPct),{decimal:true});
    const parte=campoMonetario(form,'patrimonio','Valor patrimonial da participação (R$)',empresa?.valorParticipacaoCentavos);
    return () => api.gravarEmpresa({id,empresaId:vinculo.value||null,nome:nome.value.trim(),participacaoPct:percentual(pct),valorParticipacaoCentavos:valor(parte)},base);
  }

  function editorPatrimonio(form, api, imovel) {
    const atual=api.lerValorImovel(imovel.id);
    const base=atual ? structuredClone(atual) : null;
    const patrim=campoMonetario(form,'patrimonio','Valor patrimonial atual (R$)',atual?.valorAtualCentavos);
    return () => api.gravarValorImovel({imovelId:imovel.id,valorAtualCentavos:valor(patrim)},base);
  }

  function editorMensal(form,api,tipo,item,mes) {
    const registro=api.lerMensal(tipo,item.id,mes);
    const base=registro ? structuredClone(registro) : null;
    const dados={tipo,origemId:item.id,competencia:mes};
    if (tipo==='imovel') {
      const aluguel=campoMonetario(form,'aluguel','Aluguel efetivamente recebido (R$)',registro?.aluguelCentavos);
      return () => api.gravarMensal({...dados,aluguelCentavos:valor(aluguel)},base);
    }
    const faturamento=campoMonetario(form,'faturamento','Faturamento da empresa (R$)',registro?.faturamentoCentavos);
    const repasse=campoMonetario(form,'repasse','Repasse recebido pela holding (R$)',registro?.repasseCentavos);
    return () => api.gravarMensal({...dados,faturamentoCentavos:valor(faturamento),repasseCentavos:valor(repasse)},base);
  }

  function abrirEditor(ctx, local, acionador, titulo, montar) {
    const raiz=ctx.secao.closest('.holding-area') || ctx.secao;
    const pendente=raiz.querySelector('form[data-holding-rascunho],form[aria-busy="true"]');
    if (pendente) {
      const detalhes=pendente.closest('details');if(detalhes)detalhes.open=true;
      ctx.informar(pendente.getAttribute('aria-busy')==='true'?'Aguarde o salvamento.':'Salve ou cancele a edição aberta antes de continuar.');
      pendente.querySelector('input:not([disabled]),select:not([disabled])')?.focus();
      return;
    }
    ctx.secao.querySelector('.hcar-editor')?.remove();
    ctx.informar('');
    const form=elemento('form','hcar-editor');form.setAttribute('aria-label',titulo);
    form.append(elemento('h4','',titulo));
    const gravar=montar(form);
    const grupoId=acionador.closest('[data-carteira-grupo]')?.dataset.carteiraGrupo;
    function devolverFoco(){
      if(acionador.isConnected)acionador.focus({preventScroll:true});
      else if(grupoId)ctx.secao.querySelector(`[data-carteira-grupo="${grupoId}"] > summary`)?.focus({preventScroll:true});
    }
    const erro=elemento('p','hcar-erro');erro.hidden=true;erro.setAttribute('role','alert');
    const cancelar=acao('Cancelar',()=>{
      const atualizar=form.dataset.holdingAtualizar==='1';
      form.remove();
      if(atualizar){ctx.desenhar();ctx.aoAtualizar?.();}
      devolverFoco();
    });
    const salvar=elemento('button','hcar-salvar','Salvar');salvar.type='submit';
    const rodape=elemento('div','hcar-editor-acoes');rodape.append(cancelar,salvar);
    form.append(erro,rodape);local.append(form);
    const entradas=[...form.querySelectorAll('input,select')];
    const iniciais=entradas.map(inp=>inp.value);
    const marcar=()=>form.toggleAttribute('data-holding-rascunho',entradas.some((inp,i)=>inp.value!==iniciais[i]));
    form.addEventListener('input',marcar);form.addEventListener('change',marcar);
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();if(form.getAttribute('aria-busy')==='true')return;
      const controles=[...entradas,cancelar,salvar];
      form.setAttribute('aria-busy','true');controles.forEach(c=>{c.disabled=true;});
      erro.hidden=true;salvar.textContent='Salvando…';
      let resposta;
      try { resposta=await gravar(); }
      catch(e) {
        controles.forEach(c=>{c.disabled=false;});form.removeAttribute('aria-busy');salvar.textContent='Salvar';
        form.dataset.holdingAtualizar='1';
        erro.textContent=e?.message||'Não foi possível salvar.';erro.hidden=false;return;
      }
      if(!form.isConnected)return;
      form.remove();ctx.desenhar();ctx.informar(resposta || 'Salvo.');ctx.aoAtualizar?.();devolverFoco();
    });
    entradas.find(inp=>!inp.readOnly)?.focus();
  }

  function historico(tipo,meses) {
    if(!meses.length)return null;
    const detalhe=elemento('details','hcar-historico');
    detalhe.append(elemento('summary','',`Histórico mensal (${meses.length})`));
    const lista=elemento('ul');
    for(const r of meses){
      const li=elemento('li');
      li.append(elemento('strong','',nomeMes(r.competencia)));
      const financeiro=tipo==='imovel'?`Aluguel ${moeda(r.aluguelCentavos)}`:`Faturamento ${moeda(r.faturamentoCentavos)} · Repasse ${moeda(r.repasseCentavos)}`;
      li.append(elemento('span','',financeiro));lista.append(li);
    }
    detalhe.append(lista);return detalhe;
  }

  function linha(ctx,tipo,item,dados) {
    const imovel=tipo==='imovel';
    const row=elemento('article','hcar-linha');
    const titulo=elemento('div','hcar-linha-titulo');titulo.append(elemento('h4','',item.nome));
    const dl=elemento('dl','hcar-metricas');
    const meses=dados[tipo].get(item.id) || [];
    const mensal=meses.find(reg=>reg.competencia===ctx.mes);
    if(imovel){
      metrica(dl,'Patrimônio atual',moeda(dados.patrimonio.get(item.id)));
      metrica(dl,'Aluguel recebido',moeda(mensal?.aluguelCentavos));
    }else{
      metrica(dl,'Participação',item.participacaoPct==null?'A informar':decimal.format(item.participacaoPct)+'%');
      metrica(dl,'Patrimônio da participação',moeda(item.valorParticipacaoCentavos));
      metrica(dl,'Faturamento',moeda(mensal?.faturamentoCentavos));
      metrica(dl,'Repasse recebido',moeda(mensal?.repasseCentavos));
    }
    const acoes=elemento('div','hcar-acoes'), local=elemento('div','hcar-local');
    const alterar=imovel?'Editar patrimônio':'Editar participação';
    acoes.append(acao(alterar,ev=>abrirEditor(ctx,local,ev.currentTarget,alterar+' · '+item.nome,form=>imovel?editorPatrimonio(form,ctx.api,item):editorEmpresa(form,ctx.api,item)),alterar+' de '+item.nome));
    const lancar=imovel?(mensal?'Editar aluguel':'Lançar aluguel'):(mensal?'Editar mês':'Lançar mês');
    const periodo=item.nome+' · '+nomeMes(ctx.mes);
    acoes.append(acao(lancar,ev=>abrirEditor(ctx,local,ev.currentTarget,lancar+' · '+periodo,form=>editorMensal(form,ctx.api,tipo,item,ctx.mes)),lancar+' de '+periodo));
    row.append(titulo,dl,acoes);const hist=historico(tipo,meses);if(hist)row.append(hist);row.append(local);
    return row;
  }

  function grupo(ctx,id,titulo,itens,dados) {
    const detalhes=elemento('details','hcar-grupo');detalhes.dataset.carteiraGrupo=id;
    const sum=elemento('summary','hcar-sumario');
    sum.append(elemento('strong','',titulo),elemento('span','hcar-contagem',String(itens.length)));
    detalhes.append(sum);const conteudo=elemento('div','hcar-conteudo');
    const imoveis=id==='imoveis';
    if(!imoveis){
      const local=elemento('div','hcar-local');
      conteudo.append(acao('+ Cadastrar empresa',ev=>abrirEditor(ctx,local,ev.currentTarget,'Cadastrar empresa',form=>editorEmpresa(form,ctx.api,null))),local);
    }
    if(!itens.length)conteudo.append(elemento('p','hcar-vazio',imoveis?'Cadastre um imóvel na carteira para informar patrimônio e aluguel.':'Nenhuma empresa cadastrada na holding.'));
    for(const item of itens)conteudo.append(linha(ctx,imoveis?'imovel':'empresa',item,dados));
    detalhes.append(conteudo);
    sum.addEventListener('click',ev=>{
      if(detalhes.open&&detalhes.querySelector('form[data-holding-rascunho],form[aria-busy="true"]')){
        ev.preventDefault();ctx.informar('Salve ou cancele a edição antes de recolher este grupo.');
      }
    });
    return detalhes;
  }

  return function holdingRenderCarteira(container,{mes,aoAtualizar}={}) {
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))throw Error('Informe uma competência válida.');
    const secao=elemento('section','hcar-painel');secao.setAttribute('aria-label','Empresas e renda dos imóveis');
    const status=elemento('p','hcar-retorno');status.hidden=true;status.setAttribute('role','status');
    const ctx={secao,api:holdingApiCarteira(),mes,aoAtualizar,desenhar,informar(texto){status.textContent=texto;status.hidden=!texto;}};
    function desenhar(){
      const abertos=new Set([...secao.querySelectorAll('details[data-carteira-grupo]')].filter(d=>d.open).map(d=>d.dataset.carteiraGrupo));
      const financeiro=ctx.api.listar(), dados={imovel:new Map(),empresa:new Map(),patrimonio:new Map()};
      for(const reg of financeiro.imoveis || [])dados.patrimonio.set(reg.imovelId,reg.valorAtualCentavos);
      for(const reg of [...(financeiro.mensais || [])].sort((a,b)=>b.competencia.localeCompare(a.competencia))){
        const origem=dados[reg.tipo];
        if(!origem.has(reg.origemId))origem.set(reg.origemId,[]);
        origem.get(reg.origemId).push(reg);
      }
      const imobiliario=grupo(ctx,'imoveis','Patrimônio e aluguel dos imóveis',ctx.api.listarImoveis(),dados);
      const empresas=grupo(ctx,'empresas','Participações em empresas',ctx.api.listarEmpresas(),dados);
      for(const d of [imobiliario,empresas])d.open=abertos.has(d.dataset.carteiraGrupo);
      secao.replaceChildren(status,imobiliario,empresas);
    }
    desenhar();container.append(secao);return secao;
  };
})();
