/* Interface de imóveis da Universo Holding. O estado e a gravação são fornecidos pela Central. */
(() => {
  'use strict';
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const decimal = new Intl.NumberFormat('pt-BR', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const proporcao = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const dinheiro = centavos => moeda.format(centavos / 100);
  const percentagem = (valor, quitado) => {
    if (valor == null) return 'A informar';
    if (valor > 0 && valor < 0.01) return '<0,01%';
    if (!quitado && valor >= 99.995) return '>99,99%';
    return proporcao.format(valor) + '%';
  };
  const mesAno = iso => new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
  const dataBR = iso => iso ? iso.split('-').reverse().join('/') : 'Data a informar';

  function elemento(tag, classe, texto) {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }
  function botao(texto, classe, acao) {
    const btn = elemento('button', classe, texto);
    btn.type = 'button';
    btn.addEventListener('click', acao);
    return btn;
  }
  function campo(form, legenda, nome, valor, opcoes = {}) {
    const label = elemento('label','holding-campo');
    const input = elemento('input');
    input.name = nome;
    input.type = opcoes.tipo || 'text';
    input.value = valor ?? '';
    if (opcoes.requerido) input.required = true;
    if (opcoes.decimal) input.inputMode = 'decimal';
    if (opcoes.placeholder) input.placeholder = opcoes.placeholder;
    if (opcoes.maxLength) input.maxLength = opcoes.maxLength;
    label.append(elemento('span','',legenda),input);
    form.append(label);
    return input;
  }

  const dinheiroCampo = centavos => centavos == null ? '' : decimal.format(centavos / 100);
  function valorCampo(input,opcional = false) {
    const texto = input.value.trim();
    if (!texto && opcional) return null;
    const valor = globalThis.HoldingModelo.centavos(texto);
    if (!Number.isSafeInteger(valor) || valor <= 0) throw Error('Informe um valor maior que zero.');
    return valor;
  }
  function quantidadeCampo(input) {
    const qtd = Number(input.value);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 360) throw Error('Informe uma quantidade entre 1 e 360.');
    return qtd;
  }
  const NATUREZAS = {aquisicao:'Parcela de aquisição',investimento:'Investimento no imóvel',condominio:'Condomínio',impostos:'Impostos',avulsa:'Despesa avulsa'};
  function campoNatureza(form,valor,opcoes) {
    const label=elemento('label','holding-campo');label.append(elemento('span','','Tipo de lançamento'));
    const select=elemento('select');select.name='tipo';
    for(const id of opcoes) {
      const option=elemento('option','',NATUREZAS[id]);option.value=id;option.selected=id===valor;select.append(option);
    }
    label.append(select);form.append(label);return select;
  }
  function camposEditor(form,api,tipo,imovel,item,id) {
    const baseImovel = imovel ? structuredClone(imovel) : null;
    const baseItem = item ? structuredClone(item) : null;
    if (tipo === 'imovel') {
      const nome = campo(form,'Nome do imóvel','nome',imovel?.nome,{requerido:true,maxLength:180});
      const total = campo(form,'Valor de aquisição (R$)','total',dinheiroCampo(imovel?.totalCentavos),{decimal:true,placeholder:'A informar'});
      return () => api.gravarImovel({id,nome:nome.value.trim(),totalCentavos:valorCampo(total,true)},baseImovel);
    }
    if (tipo === 'parcelamento') {
      const modelo=globalThis.HoldingModelo, prazo=modelo.prazoPlano(imovel);
      const inicio=(imovel.parcelas || []).filter(p=>!modelo.pagamentoDaParcela(imovel,p.id) && p.vencimento>=api.hoje()).map(p=>p.vencimento).sort()[0] || api.hoje();
      form.append(elemento('p','holding-form-imovel',imovel.nome));
      form.append(elemento('p','holding-painel-nota',`Distribui todo o saldo de ${dinheiro(modelo.resumo(imovel).saldo)} e substitui as ${prazo.quantidade} parcelas ainda não pagas, inclusive reforços e semestrais. Pagamentos, Gastos e comprovantes já registrados são preservados. O plano anterior fica no histórico.`));
      const quantidade=campo(form,'Quantidade de parcelas restantes','quantidade',prazo.quantidade || 12,{tipo:'number',requerido:true});
      quantidade.min='1';quantidade.max='360';quantidade.step='1';
      const vencimento=campo(form,'Primeiro vencimento','primeiroVencimento',inicio,{tipo:'date',requerido:true});
      const label=elemento('label','holding-campo');label.append(elemento('span','','Intervalo entre parcelas'));
      const intervalo=elemento('select');intervalo.name='intervaloMeses';
      for (const [n,texto] of [[1,'Mensal'],[2,'Bimestral'],[3,'Trimestral'],[6,'Semestral'],[12,'Anual']]) {
        const opt=elemento('option','',texto);opt.value=String(n);opt.selected=n===1;intervalo.append(opt);
      }
      label.append(intervalo);form.append(label);
      const previa=elemento('div','holding-previa-parcelamento');previa.setAttribute('role','status');previa.setAttribute('aria-live','polite');form.append(previa);
      const dados=()=>({id,quantidade:quantidadeCampo(quantidade),primeiroVencimento:vencimento.value,intervaloMeses:Number(intervalo.value)});
      function atualizar() {
        previa.replaceChildren();
        try {
          const plano=modelo.simularParcelamento(imovel,dados());
          const valores=[...new Set(plano.parcelas.map(p=>p.valorCentavos))];
          previa.append(elemento('strong','',`Término previsto: ${mesAno(plano.ultimoVencimento)}`),
            elemento('span','',`${plano.parcelas.length} parcelas de ${valores.map(dinheiro).join(' ou ')} · última em ${dataBR(plano.ultimoVencimento)}`));
          const detalhes=elemento('details');detalhes.append(elemento('summary','','Conferir vencimentos'));
          const lista=elemento('ol');for(const p of plano.parcelas) lista.append(elemento('li','',`${dataBR(p.vencimento)} · ${dinheiro(p.valorCentavos)}`));
          detalhes.append(lista);previa.append(detalhes);
        } catch(erro) { previa.append(elemento('span','',erro.message)); }
      }
      for(const input of [quantidade,vencimento,intervalo]) { input.addEventListener('input',atualizar);input.addEventListener('change',atualizar); }
      atualizar();
      return ()=>{form.dataset.destino='plano';return api.reparcelar(imovel.id,dados(),baseImovel);};
    }
    if (tipo === 'pagamento') {
      const data = campo(form,'Data do pagamento','data',item?.data || api.hoje(),{tipo:'date',requerido:true});
      const valor = campo(form,'Valor pago (R$)','valor',dinheiroCampo(item?.valorCentavos),{decimal:true,requerido:true,placeholder:'0,00'});
      const descricao = campo(form,'Descrição (opcional)','descricao',item?.descricao,{maxLength:500});
      return () => api.gravarPagamento(imovel.id,{id,data:data.value,valorCentavos:valorCampo(valor),descricao:descricao.value.trim()},baseItem,baseImovel);
    }
    const edicao = Boolean(item);
    const editarParcela = tipo === 'parcela';
    const tipoAnterior = item && !editarParcela ? globalThis.HoldingModelo.tipoDespesa(item) : null;
    const tipos = edicao ? (editarParcela ? ['aquisicao'] : ['investimento','condominio','impostos',...(tipoAnterior==='avulsa'?['avulsa']:[])]) : ['aquisicao','investimento','condominio','impostos'];
    const inicial = tipoAnterior || (tipo==='despesa'?'investimento':'aquisicao');
    const natureza=campoNatureza(form,inicial,tipos);
    if (editarParcela) natureza.disabled=true;
    const descricao=campo(form,'Descrição','descricao',item?.descricao,{requerido:true,maxLength:500,placeholder:'Ex.: entrada ou condomínio'});
    const valor=campo(form,'Valor por parcela (R$)','valor',dinheiroCampo(item?.valorCentavos),{decimal:true});
    const vencimento=campo(form,edicao?'Vencimento':'Primeiro vencimento','vencimento',item?.vencimento,{tipo:'date'});
    const agendado=edicao && tipo==='despesa' ? campo(form,'Agendado para (opcional)','agendadoPara',item.agendadoPara,{tipo:'date'}) : null;
    let quantidade;
    if (!edicao) {
      quantidade=campo(form,'Quantidade (mensal)','quantidade','1',{tipo:'number',requerido:true});
      quantidade.min='1'; quantidade.max='360'; quantidade.step='1';
    }
    function atualizarTipo() {
      const aquisicao=natureza.value==='aquisicao';valor.required=aquisicao;vencimento.required=aquisicao && !edicao && Number(quantidade?.value)>1;
      valor.placeholder=aquisicao?'0,00':'A informar';
    }
    if (quantidade) {
      const prazo=elemento('p','holding-painel-nota');prazo.setAttribute('role','status');form.append(prazo);
      const atualizarPrazo=()=>{try { prazo.textContent=vencimento.value ? `Última parcela: ${dataBR(globalThis.HoldingModelo.vencimentoDoMes(vencimento.value,quantidadeCampo(quantidade)-1))}` : 'Informe o primeiro vencimento para ver a data final.'; } catch(erro) {prazo.textContent=erro.message;} };
      quantidade.addEventListener('input',atualizarPrazo);vencimento.addEventListener('input',atualizarPrazo);atualizarPrazo();
    }
    quantidade?.addEventListener('input',atualizarTipo);
    natureza.addEventListener('change',atualizarTipo);atualizarTipo();
    return () => {
      const aquisicao=natureza.value==='aquisicao';
      form.dataset.destino=aquisicao?'plano':'despesas';
      const dados={id,descricao:descricao.value.trim(),valorCentavos:valorCampo(valor,!aquisicao)};
      if (!aquisicao) return api.gravarDespesa(imovel.id,{...dados,...(natureza.value==='avulsa'?{}:{tipo:natureza.value}),vencimento:vencimento.value || null,...(agendado?{agendadoPara:agendado.value || null}:{}),...(quantidade?{quantidade:quantidadeCampo(quantidade)}:{})},baseItem,baseImovel);
      if (!edicao) return api.gravarSerie(imovel.id,{...dados,primeiroVencimento:vencimento.value,quantidade:quantidadeCampo(quantidade)},baseImovel);
      return api.editarParcela(imovel.id,{...dados,vencimento:vencimento.value},baseItem,baseImovel);
    };
  }

  function mostrarErro(form,texto) {
    const erro = form.querySelector('.holding-erro');
    if (erro) { erro.textContent = texto; erro.hidden = false; }
  }
  function disponivel(contexto) {
    const ocupado = contexto.container.querySelector('form[aria-busy="true"],form[data-holding-rascunho]');
    if (!ocupado) return true;
    mostrarErro(ocupado,ocupado.getAttribute('aria-busy') === 'true' ? 'Aguarde o salvamento.' : 'Salve ou cancele a edição para continuar.');
    return false;
  }
  function formulario(contexto,imovel,item,tipo,acionador) {
    if (!disponivel(contexto)) return;
    const {container,api,desenhar} = contexto;
    container.querySelector('.holding-inline')?.remove();
    if (container.querySelector('.holding-dialog')) return;
    const modal = tipo === 'imovel' || tipo === 'pagamento' || tipo === 'parcelamento';
    const titulos = {parcelamento:'Ajustar parcelamento',imovel:imovel ? 'Editar imóvel' : 'Cadastrar imóvel',pagamento:item ? 'Corrigir pagamento' : 'Lançar pagamento',serie:'Novo lançamento',parcela:'Editar parcela',despesa:item ? 'Editar despesa' : 'Novo lançamento'};
    const titulo = titulos[tipo];
    const id = (tipo === 'imovel' ? imovel?.id : item?.id) || api.novoId();
    const editor = elemento(modal ? 'dialog' : 'section',modal ? 'holding-dialog' : 'holding-inline');
    editor.setAttribute('aria-label',titulo);
    const form = elemento('form','holding-form');
    const cabecalho = elemento('header','holding-form-cab');
    cabecalho.append(elemento(modal ? 'h2' : 'h3','',titulo));
    form.append(cabecalho);
    let salvando = false;
    function fechar() {
      if (salvando) return;
      if (modal && typeof editor.close === 'function') editor.close();
      editor.remove();
      if (editor.dataset.holdingAtualizar === '1' || form.dataset.holdingAtualizar === '1') desenhar('',imovel?.id);
      else if (acionador.isConnected) acionador.focus();
    }
    if (modal) {
      const sair = botao('×','holding-fechar',fechar);
      sair.setAttribute('aria-label','Fechar formulário');
      cabecalho.append(sair);
      editor.addEventListener('cancel',ev=>{ ev.preventDefault(); fechar(); });
      if (tipo === 'pagamento') form.append(elemento('p','holding-form-imovel',imovel.nome));
    }
    const gravar = camposEditor(form,api,tipo,imovel,item,id);
    const erro = elemento('p','holding-erro');
    erro.setAttribute('role','alert'); erro.hidden = true;
    const acoes = elemento('div','holding-form-acoes');
    const salvar = elemento('button','holding-primario',{parcelamento:'Aplicar parcelamento',imovel:'Salvar imóvel',pagamento:'Salvar pagamento',serie:'Salvar lançamento',parcela:'Salvar parcela',despesa:item?'Salvar despesa':'Salvar lançamento'}[tipo]);
    salvar.type='submit';
    acoes.append(botao('Cancelar','holding-secundario',fechar),salvar);
    form.append(erro,acoes);
    const valoresIniciais = [...form.querySelectorAll('input,select')].map(inp=>[inp,inp.value]);
    function marcarRascunho() { form.toggleAttribute('data-holding-rascunho',valoresIniciais.some(([inp,inicial])=>inp.value!==inicial)); }
    form.addEventListener('input',marcarRascunho); form.addEventListener('change',marcarRascunho);
    editor.append(form);
    if (modal) container.append(editor);
    else acionador.closest('.holding-painel').querySelector('.holding-editor-local').append(editor);
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();
      if (salvando) return;
      salvando = true; erro.hidden = true;
      const rotulo = salvar.textContent;
      const campos = [...form.querySelectorAll('input,select,button')].filter(c=>!c.disabled);
      campos.forEach(c=>{ c.disabled=true; });
      form.setAttribute('aria-busy','true'); salvar.textContent='Salvando…';
      try {
        const resposta = await gravar();
        if (!editor.isConnected) return;
        if (modal && typeof editor.close === 'function') editor.close();
        if (form.dataset.destino) {
          contexto.recortes.delete(`${imovel.id}:${form.dataset.destino}`);
          contexto.painelAberto={id:imovel.id,aba:form.dataset.destino};
        }
        editor.remove();
        desenhar(typeof resposta==='string' && resposta ? resposta : 'Salvo.',imovel?.id || id,tipo==='pagamento');
      } catch (falha) {
        mostrarErro(form,falha?.message || 'Não foi possível salvar. Confira os campos e tente novamente.');
        campos.forEach(c=>{ c.disabled=false; });
        form.removeAttribute('aria-busy'); salvar.textContent=rotulo; salvando=false;
      }
    });
    if (modal) {
      if (typeof editor.showModal==='function') editor.showModal();
      else { editor.setAttribute('open',''); editor.setAttribute('role','dialog'); }
    }
    form.querySelector('input')?.focus();
  }
  function historico(contexto,imovel,abrir) {
    const detalhes = elemento('details','holding-historico'); detalhes.open=abrir;
    const pagamentos = [...(imovel.pagamentos||[])].reverse().sort((a,b)=>b.data.localeCompare(a.data));
    detalhes.append(elemento('summary','',`Histórico de pagamentos (${pagamentos.length})`));
    if (!pagamentos.length) detalhes.append(elemento('p','holding-vazio','Nenhum pagamento lançado.'));
    const lista = elemento('ul','holding-parcelas');
    for (const pg of pagamentos) {
      const linha = elemento('li');
      const ref = elemento('div','holding-parcela-ref');
      const data = elemento('time','',dataBR(pg.data)); data.dateTime=pg.data; ref.append(data);
      if (pg.descricao) ref.append(elemento('small','',pg.descricao));
      ref.append(elemento('small','',pg.parcelaId ? 'Aquisição · do plano' : 'Aquisição'));
      if (pg.historico?.length) {
        const rev=elemento('details','holding-revisoes');rev.append(elemento('summary','',`${pg.historico.length} ${pg.historico.length===1?'correção':'correções'}`));
        for(const versao of pg.historico) rev.append(elemento('small','',`${dataBR(versao.data)} · ${dinheiro(versao.valorCentavos)}${versao.descricao ? ' · '+versao.descricao : ''}`));
        ref.append(rev);
      }
      linha.append(ref,elemento('strong','',dinheiro(pg.valorCentavos)));
      const acoes=elemento('div','holding-historico-acoes');
      if (!pg.parcelaId) {
        const corrigir = botao('Corrigir','holding-link',ev=>formulario(contexto,imovel,pg,'pagamento',ev.currentTarget));
        corrigir.setAttribute('aria-label',`Corrigir pagamento de ${dataBR(pg.data)}, ${dinheiro(pg.valorCentavos)}`);
        acoes.append(corrigir);
      }
      const referencia=pg.parcelaId ? refAnexos(imovel.id,'parcela',pg.parcelaId) : refAnexos(imovel.id,'pagamento',pg.id);
      const rotulo=[pg.descricao || 'Pagamento',dataBR(pg.data),dinheiro(pg.valorCentavos),imovel.nome].join(', ');
      acoes.append(botaoAnexos(linha,referencia,rotulo));linha.append(acoes);
      lista.append(linha);
    }
    detalhes.append(lista);
    if(globalThis.HoldingModelo.resumo(imovel).status!=='Quitado') detalhes.append(botao('Lançar pagamento manual','holding-link',ev=>formulario(contexto,imovel,null,'pagamento',ev.currentTarget)));
    return detalhes;
  }
  function rotuloCompromisso(imovel,item,despesa) {
    const especie=despesa ? 'despesa' : 'parcela';
    const serie=item.quantidade>1 ? `${especie} ${item.numero} de ${item.quantidade}` : especie;
    const venc=item.vencimento ? `vencimento ${dataBR(item.vencimento)}` : 'vencimento a informar';
    const valor=item.valorCentavos==null ? 'valor a informar' : dinheiro(item.valorCentavos);
    return `${item.descricao}, ${serie}, ${venc}, ${valor}, ${imovel.nome}`;
  }
  function controleBaixa(contexto, imovel, linha) {
    const { item, despesa, pagoEm, rotulo } = linha;
    const form = elemento('form', 'holding-baixa');
    const alvo = elemento('label', 'holding-check-alvo');
    const check = elemento('input', 'holding-pago');
    check.type = 'checkbox';
    check.checked = Boolean(pagoEm);
    check.disabled = check.checked || item.valorCentavos == null;
    check.setAttribute('aria-label', `${pagoEm ? 'Pago' : 'Marcar como pago'}: ${rotulo}`);
    if (!pagoEm && item.valorCentavos == null) alvo.title = 'Informe o valor da despesa para marcar como paga.';
    alvo.append(check);
    const erro = elemento('p', 'holding-erro');
    erro.setAttribute('role', 'alert');
    erro.hidden = true;
    form.append(alvo, erro);
    form.addEventListener('submit', event => event.preventDefault());
    const baseItem = structuredClone(item);
    const baseImovel = { id: imovel.id, nome: imovel.nome, totalCentavos: imovel.totalCentavos };
    check.addEventListener('change', async () => {
      if (pagoEm || check.disabled) { check.checked = Boolean(pagoEm); return; }
      const confirmar = check.checked;
      check.checked = false;
      if (!confirmar || !disponivel(contexto)) return;
      check.disabled = true;
      check.indeterminate = true;
      erro.hidden = true;
      form.setAttribute('aria-busy', 'true');
      contexto.container.querySelector('.holding-feedback')?.remove();
      try {
        const gravar = despesa ? contexto.api.pagarDespesa : contexto.api.pagarParcela;
        const resposta = await gravar(imovel.id, item.id, baseItem, baseImovel);
        if (form.isConnected) contexto.desenhar(typeof resposta === 'string' ? resposta : 'Pagamento registrado.', imovel.id);
      } catch (falha) {
        check.disabled = false;
        check.indeterminate = false;
        form.removeAttribute('aria-busy');
        mostrarErro(form, falha?.message || 'Não foi possível registrar o pagamento.');
      }
    });
    return form;
  }

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  function nomeMes(mes) {
    if (!mes) return 'A informar';
    return `${MESES[Number(mes.slice(5,7)) - 1]}/${mes.slice(0,4)}`;
  }
  function situacaoMensal(vencimento, pagoEm, hoje) {
    if (pagoEm) return 'Pago';
    if (!vencimento) return 'Vencimento a informar';
    if (vencimento < hoje) return 'Em atraso';
    if (vencimento === hoje) return 'Vence hoje';
    return 'A vencer';
  }
  function linhasDoControle(imovel, despesa, hoje) {
    const baixas = new Map((imovel.pagamentos || []).filter(p => p.parcelaId).map(p => [p.parcelaId, p]));
    const itens = despesa ? imovel.despesas || [] : imovel.parcelas || [];
    return itens.map(item => {
      const pagoEm = despesa ? item.pagoEm : baixas.get(item.id)?.data;
      return { item, despesa, pagoEm, mes: item.vencimento?.slice(0,7) || '',
        tipo: despesa ? globalThis.HoldingModelo.tipoDespesa(item) : 'aquisicao',
        rotulo: rotuloCompromisso(imovel, item, despesa), situacao: situacaoMensal(item.vencimento, pagoEm, hoje) };
    }).sort((a,b) => (a.item.vencimento || '9999-99').localeCompare(b.item.vencimento || '9999-99'));
  }
  function resumoControle(linhas, exibicao, selecionar) {
    let pago = 0, pendente = 0, semValor = 0;
    for (const { item, pagoEm } of linhas) {
      if (item.valorCentavos == null) semValor++;
      else if (pagoEm) pago += item.valorCentavos;
      else pendente += item.valorCentavos;
    }
    const previsto = pago + pendente;
    const valoresConhecidos = linhas.length > semValor;
    const pendentesConhecidos = linhas.some(l => !l.pagoEm && l.item.valorCentavos != null);
    const texto = (soma, conhecidos) => semValor ? [conhecidos ? dinheiro(soma) : '', `${semValor} a informar`].filter(Boolean).join(' + ') : dinheiro(soma);
    const percentual = !semValor && previsto > 0 ? (pago / previsto) * 100 : null;
    const grupo = elemento('div','holding-controle-total');
    grupo.setAttribute('role','group'); grupo.setAttribute('aria-label','Filtrar lançamentos pelos totais');
    for (const [id,rotulo,valor,acao] of [
      ['todos','Total previsto',texto(previsto,valoresConhecidos),'Mostrar todos os lançamentos'],
      ['pagos','Total pago',dinheiro(pago),'Mostrar lançamentos pagos'],
      ['pendentes','Total pendente',texto(pendente,pendentesConhecidos),'Mostrar lançamentos pendentes'],
      ['percentual','% quitado',percentagem(percentual,pago===previsto),'Ver composição da quitação']
    ]) {
      const btn=botao('','holding-indicador-filtro',()=>selecionar(id));
      btn.append(elemento('small','',rotulo),elemento('strong','',valor));
      btn.title=acao;btn.dataset.exibicao=id;
      btn.setAttribute('aria-pressed',String(exibicao===id));grupo.append(btn);
    }
    return grupo;
  }
  function totaisDeDespesas(imovel, linhas) {
    const dl=elemento('dl','holding-tipostotal');
    const porTipo=globalThis.HoldingModelo.resumoDespesas({...imovel, despesas:linhas.map(l => l.item)});
    for(const id of ['investimento','condominio','impostos','avulsa']) {
      const item=porTipo[id]; if(!item.quantidade) continue;
      const texto=[item.pago ? dinheiro(item.pago)+' pago' : '',item.aberto ? dinheiro(item.aberto)+' em aberto' : '',item.aInformar ? `${item.aInformar} a informar` : ''].filter(Boolean).join(' · ');
      const grupo=elemento('div'); grupo.append(elemento('dt','',NATUREZAS[id]),elemento('dd','',texto));dl.append(grupo);
    }
    return dl;
  }
  function seletorRecorte(nome, rotulo, opcoes, atual, definir, contexto, imovel) {
    const label=elemento('label');label.append(elemento('span','',rotulo));
    const select=elemento('select'); select.name=nome;
    for (const [v,txt] of opcoes) {
      const o=elemento('option','',txt); o.value=v; if(v===atual)o.selected=true; select.append(o);
    }
    select.addEventListener('change',()=>{
      if (!disponivel(contexto)) { const anterior=[...select.options].find(o=>o.value===atual); if(anterior) anterior.selected=true; return; }
      definir(select.value); contexto.desenhar('',imovel.id);
      contexto.container.querySelector(`[name="${nome}"]`)?.focus({preventScroll:true});
    });
    label.append(select);return label;
  }
  function controlesRecorte(contexto, imovel, despesa, linhas, recorte) {
    const filtros=elemento('div','holding-controle-filtros');
    const meses=[...new Set(linhas.map(l=>l.mes))].sort((a,b)=>(a||'9999-99').localeCompare(b||'9999-99'));
    const periodo=[['todos','Todos os meses'],...meses.map(m=>[m||'sem',m?nomeMes(m):'Vencimento a informar'])];
    if (!periodo.some(([valor])=>valor===recorte.mes)) recorte.mes='todos';
    filtros.append(seletorRecorte('holding-mes','Mês do vencimento',periodo,recorte.mes,v=>{recorte.mes=v;},contexto,imovel));
    if (despesa) {
      const tipos=['investimento','condominio','impostos'];
      if(linhas.some(l=>l.tipo==='avulsa')) tipos.push('avulsa');
      const opcoes=[['todos','Todas as despesas'],...tipos.map(t=>[t,NATUREZAS[t]])];
      if (!opcoes.some(([valor])=>valor===recorte.tipo)) recorte.tipo='todos';
      filtros.append(seletorRecorte('holding-tipo','Tipo de despesa',opcoes,recorte.tipo,v=>{recorte.tipo=v;},contexto,imovel));
    }
    return filtros;
  }
  function refAnexos(imovelId, tipo, itemId) {
    if (!['parcela','despesa','pagamento'].includes(tipo)) throw Error('Tipo de lançamento inválido.');
    // ':' separa os campos. Escapar também '_' evita colisões com o próprio escape.
    function segmento(id) {
      if (typeof id !== 'string' || !id.trim()) throw Error('Salve o lançamento antes de anexar.');
      return id.replace(/[^A-Za-z0-9-]/gu, char => `_${char.codePointAt(0).toString(16)}_`);
    }
    return `holding:${segmento(imovelId)}:${tipo}:${segmento(itemId)}`;
  }
  function botaoAnexos(origem, referencia, rotulo, numeroColunas=0) {
    let detalhe;
    const abrir=botao('Boleto e comprovantes','holding-link holding-anexos-abrir',()=>{
      if (detalhe) {
        if (detalhe.querySelector('.solta[aria-busy="true"]')) return;
        detalhe.remove(); detalhe=null;
        abrir.setAttribute('aria-expanded','false'); abrir.removeAttribute('aria-controls');
        return;
      }
      const painel=elemento('section','holding-anexos');painel.id=`anexos-${numeroColunas?'controle':'historico'}-${referencia}`;
      painel.setAttribute('aria-label',`Boleto e comprovantes de ${rotulo}`);
      painel.append(elemento('strong','','Boleto e comprovantes'));
      if (origem.dataset.baixa) painel.append(elemento('p','holding-dados-baixa',origem.dataset.baixa));
      painel.append(elemento('p','holding-anexos-modo',naNuvem()?'Arquivos marcados como “neste aparelho” aguardam sincronização.':'Anexos desta prévia são salvos neste navegador.'));
      painel.append(areaArquivos(referencia,'Adicionar boleto ou comprovante'));
      if (numeroColunas) {
        detalhe=elemento('tr','holding-anexos-linha');
        const celula=elemento('td','holding-anexos-celula');celula.setAttribute('colspan',String(numeroColunas));
        celula.append(painel);detalhe.append(celula);origem.after(detalhe);
      } else { detalhe=painel;origem.append(painel); }
      abrir.setAttribute('aria-expanded','true'); abrir.setAttribute('aria-controls',painel.id);
    });
    abrir.setAttribute('aria-label',`Boleto e comprovantes: ${rotulo}`);
    abrir.setAttribute('aria-expanded','false');
    return abrir;
  }
  function tabelaMensal(contexto, imovel, linhas, despesa) {
    const colunas=['Mês/ano','Descrição','Vencimento','Valor','Pago','Data do pagamento','Situação','Ações'];
    const tabela=elemento('table','holding-controle-mensal');
    tabela.setAttribute('aria-label',`Controle mensal de ${despesa?'despesas':'parcelas'} de ${imovel.nome}`);
    const head=elemento('thead'), titulos=elemento('tr'), body=elemento('tbody');
    for(const nome of colunas) { const th=elemento('th','',nome);th.scope='col';titulos.append(th); }
    head.append(titulos);tabela.append(head,body);
    for(const l of linhas) {
      const {item,pagoEm,tipo,situacao,rotulo}=l;
      const tr=elemento('tr','holding-compromisso');tr.dataset.situacao=situacao;
      if (pagoEm) tr.dataset.baixa=item.descricao+' · '+dinheiro(item.valorCentavos)+' pagos em '+dataBR(pagoEm);
      const celulas=colunas.map((nome,i)=>{
        const c=elemento('td',`holding-mensal-c${i}`);c.dataset.campo=nome;tr.append(c);return c;
      });
      celulas[0].append(elemento('span','',nomeMes(l.mes)));
      celulas[1].append(elemento('strong','',item.descricao));
      const categoria=item.descricao.trim().toLocaleLowerCase('pt-BR')===NATUREZAS[tipo].toLocaleLowerCase('pt-BR')?'':NATUREZAS[tipo];
      const ref=[categoria,item.quantidade>1?`${item.numero} de ${item.quantidade}`:''].filter(Boolean).join(' · ');
      if (item.observacao) celulas[1].append(elemento('small','',item.observacao));
      if (ref) celulas[1].append(elemento('small','',ref));
      celulas[2].append(elemento('span','',item.vencimento?dataBR(item.vencimento):'A informar'));
      celulas[3].append(elemento('strong','',item.valorCentavos==null?'Valor a informar':dinheiro(item.valorCentavos)));
      const referencia=refAnexos(imovel.id,despesa?'despesa':'parcela',item.id);
      const anexos=botaoAnexos(tr,referencia,rotulo,colunas.length);
      if (pagoEm) {
        const ver=botao('✓','holding-ver-pago',()=>anexos.click());
        ver.title='Ver pagamento e comprovantes';
        ver.setAttribute('aria-label','Ver pagamento e comprovantes: '+rotulo);
        celulas[4].append(ver);
      } else celulas[4].append(controleBaixa(contexto,imovel,l));
      celulas[5].append(elemento('span','',pagoEm?dataBR(pagoEm):'—'));
      const status=botao(situacao,'holding-mensal-status',ev=>{
        if (pagoEm) anexos.click();
        else formulario(contexto,imovel,item,despesa?'despesa':'parcela',ev.currentTarget);
      });
      status.title=pagoEm?'Ver pagamento e comprovantes':'Editar lançamento';
      celulas[6].append(status);
      if (despesa && !pagoEm && item.agendadoPara) celulas[6].append(elemento('small','holding-agendado',`Agendado para ${dataBR(item.agendadoPara)}`));
      if (!pagoEm) {
        const editar=botao('Editar','holding-link',ev=>formulario(contexto,imovel,item,despesa?'despesa':'parcela',ev.currentTarget));
        editar.setAttribute('aria-label',`Editar: ${rotulo}`);celulas[7].append(editar);
      }
      celulas[7].append(anexos);
      body.append(tr);
    }
    return tabela;
  }
  function painel(contexto,imovel,aba,abrirHistorico) {
    const despesa=aba==='despesas';
    const sec=elemento('section','holding-painel');sec.setAttribute('aria-label',`${despesa?'Despesas':'Plano de pagamento'} de ${imovel.nome}`);
    const topo=elemento('div','holding-painel-cab');
    topo.append(elemento('h4','',despesa?'Despesas do imóvel':'Plano de pagamento'));
    const acoes=elemento('div','holding-painel-acoes');
    const incluir=botao(despesa?'+ Despesa avulsa':'+ Lançamento','holding-secundario',ev=>formulario(contexto,imovel,null,despesa?'despesa':'serie',ev.currentTarget));
    if (!despesa && globalThis.HoldingModelo.resumo(imovel).saldo>0) acoes.append(botao('Ajustar parcelamento','holding-secundario',ev=>formulario(contexto,imovel,null,'parcelamento',ev.currentTarget)));
    acoes.append(incluir,botao('Recolher','holding-secundario',()=>{
      if (!disponivel(contexto)) return;
      contexto.painelAberto={id:imovel.id,aba:''};contexto.desenhar('',imovel.id);
    }));topo.append(acoes);sec.append(topo);
    if (!despesa && imovel.gastosEmpresaId) sec.append(elemento('p','holding-painel-nota','Ao marcar uma parcela como paga, o lançamento entra em Gastos e compartilha os comprovantes.'));
    if (!despesa && imovel.origemPlano) sec.append(elemento('p','holding-painel-nota',imovel.origemPlano));
    if (despesa) sec.append(elemento('p','holding-painel-nota','Despesas separadas do valor de aquisição.'));
    const chave=`${imovel.id}:${aba}`;
    if(!contexto.recortes.has(chave)) contexto.recortes.set(chave,{mes:'todos',tipo:'todos'});
    const recorte=contexto.recortes.get(chave);
    const linhas=linhasDoControle(imovel,despesa,contexto.api.hoje());
    sec.append(controlesRecorte(contexto,imovel,despesa,linhas,recorte));
    const filtradas=linhas.filter(l=>(recorte.tipo==='todos'||l.tipo===recorte.tipo)&&(recorte.mes==='todos'||(l.mes||'sem')===recorte.mes));
    const exibicao=recorte.exibicao || 'todos';
    function selecionar(id) {
      if (!disponivel(contexto)) return;
      recorte.exibicao=id;
      contexto.desenhar('',imovel.id);
      contexto.container.querySelector('.holding-controle-total [aria-pressed="true"]')?.focus({preventScroll:true});
    }
    sec.append(resumoControle(filtradas,exibicao,selecionar));
    const visiveis=filtradas.filter(l=>exibicao==='pagos' ? l.pagoEm : exibicao==='pendentes' ? !l.pagoEm : true);
    if (exibicao==='percentual') {
      const pagas=filtradas.filter(l=>l.pagoEm).length;
      sec.append(elemento('p','holding-painel-nota',pagas+' de '+filtradas.length+' lançamentos pagos. O percentual considera os valores do período.'));
    }
    if (despesa && filtradas.length) sec.append(totaisDeDespesas(imovel,filtradas));
    sec.append(elemento('div','holding-editor-local'));
    if (visiveis.length) sec.append(tabelaMensal(contexto,imovel,visiveis,despesa));
    else if (filtradas.length) sec.append(elemento('p','holding-vazio',exibicao==='pendentes'?'Nenhum lançamento pendente neste período.':'Nenhum lançamento pago neste período.'));
    else sec.append(elemento('p','holding-vazio',linhas.length?'Nenhum lançamento neste recorte.':despesa?'Nenhuma despesa lançada.':'Nenhuma parcela cadastrada.'));
    if (!despesa) {sec.append(historico(contexto,imovel,abrirHistorico));sec.append(historicoPlanos(imovel));}
    return sec;
  }
  function historicoPlanos(imovel) {
    const area=elemento('div','holding-planos-anteriores');
    if (!imovel.reparcelamentos?.length) return area;
    const detalhes=elemento('details','holding-historico');detalhes.append(elemento('summary','',`Planos anteriores (${imovel.reparcelamentos.length})`));
    detalhes.append(elemento('p','holding-painel-nota','Cronogramas substituídos, fora do saldo e das próximas cobranças.'));
    for(const revisao of [...imovel.reparcelamentos].reverse()) {
      const grupo=elemento('details');grupo.append(elemento('summary','',`Substituído em ${dataBR(revisao.criadoEm.slice(0,10))} · ${revisao.parcelasAnteriores.length} parcelas`));
      const lista=elemento('ul','holding-parcelas');
      for(const p of revisao.parcelasAnteriores) {
        const li=elemento('li');li.append(elemento('span','',`${p.descricao} · ${dataBR(p.vencimento)}`),elemento('strong','',dinheiro(p.valorCentavos)),botaoAnexos(li,refAnexos(imovel.id,'parcela',p.id),`${p.descricao}, plano anterior, ${imovel.nome}`));lista.append(li);
      }
      grupo.append(lista);detalhes.append(grupo);
    }
    area.append(detalhes);return area;
  }
  function coluna(rotulo,valor,dica,acao) {
    const cell=botao('','holding-metrica',acao);
    cell.title=dica;
    cell.append(elemento('small','holding-rotulo',rotulo),elemento('strong','',valor));return cell;
  }
  function cartao(contexto,imovel,abrirHistorico) {
    const resumo=globalThis.HoldingModelo.resumo(imovel), quitado=resumo.status==='Quitado';
    const card=elemento('article','holding-cartao');
    const row=elemento('div','holding-linha');
    const titulo=elemento('h3');
    const editar=botao(imovel.nome,'holding-nome',ev=>formulario(contexto,imovel,null,'imovel',ev.currentTarget));
    editar.title='Editar imóvel'; titulo.append(editar);
    const status=botao(resumo.status,'holding-status',ev=>{
      if (resumo.percentual==null) formulario(contexto,imovel,null,'imovel',ev.currentTarget);
      else abrirPlano(quitado?'pagos':'pendentes',quitado);
    });
    status.title=resumo.percentual==null?'Completar dados do imóvel':quitado?'Ver histórico de pagamentos':'Ver parcelas pendentes';
    status.dataset.tipo=quitado?'quitado':resumo.percentual==null?'incompleto':'andamento';
    const identidade=elemento('div','holding-identidade'); identidade.append(titulo,status);
    const prazo=globalThis.HoldingModelo.prazoPlano(imovel);
    const textoPrazo=prazo.quitadoEm ? `Quitado em ${mesAno(prazo.quitadoEm)}` : prazo.completo && prazo.ultimoVencimento ? `Término: ${mesAno(prazo.ultimoVencimento)} · ${prazo.quantidade} restantes` : prazo.ultimoVencimento ? `Plano parcial até ${mesAno(prazo.ultimoVencimento)} · ${prazo.quantidade} restantes` : 'Término a definir';
    identidade.append(elemento('small','holding-prazo',textoPrazo));row.append(identidade);
    const faltaTotal=imovel.totalCentavos==null;
    function abrirPlano(exibicao,historico=false) {
      if (!disponivel(contexto)) return;
      const origem=exibicao+':'+historico;
      if (contexto.painelAberto.id===imovel.id && contexto.painelAberto.aba==='plano' && contexto.painelAberto.origem===origem) {
        contexto.painelAberto={id:imovel.id,aba:''};contexto.desenhar('',imovel.id);return;
      }
      contexto.painelAberto={id:imovel.id,aba:'plano',origem};
      contexto.recortes.set(imovel.id+':plano',{mes:'todos',tipo:'todos',exibicao});
      contexto.desenhar('',imovel.id,historico);
      const destino=contexto.container.querySelector(historico?'.holding-historico summary':'.holding-controle-total [aria-pressed="true"]');
      destino?.focus();
    }
    let aquisicao;
    if (faltaTotal) {
      aquisicao=elemento('div','holding-metrica');
      aquisicao.append(elemento('small','holding-rotulo','Aquisição'),botao('Informar valor','holding-link',ev=>formulario(contexto,imovel,null,'imovel',ev.currentTarget)));
    } else aquisicao=coluna('Aquisição',dinheiro(imovel.totalCentavos),'Abrir plano completo',()=>abrirPlano('todos'));
    row.append(aquisicao,coluna('Pago',dinheiro(resumo.pago),'Abrir histórico de pagamentos',()=>abrirPlano('pagos',true)),
      coluna('Saldo',resumo.saldo==null?'—':dinheiro(resumo.saldo),'Ver parcelas pendentes',()=>abrirPlano('pendentes')));
    const pct=coluna('% pago',resumo.percentual==null?'—':percentagem(resumo.percentual,quitado),'Ver pagamentos da aquisição',()=>abrirPlano('todos',true));
    if (resumo.percentual!=null) {
      const barra=elemento('progress','holding-barra');barra.max=100;barra.value=resumo.percentual;barra.setAttribute('aria-label',`${percentagem(resumo.percentual,quitado)} pago`);pct.append(barra);
    }
    row.append(pct);
    const acoes=elemento('div','holding-linha-acoes');
    const aberta=contexto.painelAberto.id===imovel.id ? contexto.painelAberto.aba : '';
    for(const [id,rotulo] of [['plano','Plano'],['despesas','Despesas']]) {
      const btn=botao(rotulo,'holding-secundario',()=>{
        if (!disponivel(contexto)) return;
        contexto.painelAberto={id:imovel.id,aba:aberta===id?'':id}; contexto.desenhar('',imovel.id);
      });
      btn.setAttribute('aria-expanded',String(aberta===id));acoes.append(btn);
    }
    row.append(acoes);card.append(row);
    if (aberta) card.append(painel(contexto,imovel,aberta,abrirHistorico));
    return {card,titulo:editar};
  }
  function render(container,api) {
    function desenhar(mensagem,imovelFoco,abrirHistorico=false) {
      const carteira=api.listar();
      const raiz=elemento('section','holding-area');
      raiz.append(holdingCabecalho('universo-imoveis'));
      const lista=elemento('section','holding-lista'), topo=elemento('div','holding-lista-cab');
      topo.append(elemento('h1','','Imóveis'),botao('+ Cadastrar imóvel','holding-primario',ev=>formulario(contexto,null,null,'imovel',ev.currentTarget)));lista.append(topo);
      const alvo=imovelFoco && carteira.find(i=>i.id===imovelFoco);
      if (mensagem && alvo && contexto.filtro!==globalThis.HoldingModelo.resumo(alvo).status) contexto.filtro='todos';
      if (carteira.length) {
        const resumos=carteira.map(i=>globalThis.HoldingModelo.resumo(i));
        const quitados=resumos.filter(r=>r.status==='Quitado').length,andamento=resumos.filter(r=>r.status==='Em pagamento').length;
        const filtros=[['todos',carteira.length+' '+(carteira.length===1?'imóvel':'imóveis')],['Em pagamento',andamento+' em pagamento'],['Quitado',quitados+' '+(quitados===1?'quitado':'quitados')]];
        const pendentes=carteira.length-andamento-quitados;
        if (pendentes || contexto.filtro==='A informar') filtros.push(['A informar',pendentes+' com valor a informar']);
        const resumo=elemento('div','holding-resumo');
        resumo.setAttribute('role','group');resumo.setAttribute('aria-label','Filtrar imóveis por situação');
        for (const [situacao,rotulo] of filtros) {
          const btn=botao(rotulo,'holding-filtro-imoveis',()=>{
            if (!disponivel(contexto)) return;
            contexto.filtro=situacao;desenhar();
            container.querySelector('.holding-resumo [aria-pressed="true"]')?.focus({preventScroll:true});
          });
          btn.setAttribute('aria-pressed',String(situacao===contexto.filtro));resumo.append(btn);
        }
        lista.append(resumo);
      }
      if (mensagem) { const status=elemento('p','holding-feedback',mensagem);status.setAttribute('role','status');lista.append(status); }
      if (!carteira.length) lista.append(elemento('p','holding-lista-vazia','Cadastre o primeiro imóvel para acompanhar sua aquisição e seus pagamentos.'));
      let foco;
      const visiveis=carteira.filter(i=>contexto.filtro==='todos'||globalThis.HoldingModelo.resumo(i).status===contexto.filtro);
      if (carteira.length && !visiveis.length) lista.append(elemento('p','holding-vazio','Nenhum imóvel nesta situação.'));
      for(const imovel of visiveis) {
        const {card,titulo}=cartao(contexto,imovel,imovelFoco===imovel.id && abrirHistorico);lista.append(card);if(imovel.id===imovelFoco)foco=titulo;
      }
      raiz.append(lista);container.replaceChildren(raiz);if (foco && container.isConnected) foco.focus({preventScroll:true});
    }
    const contexto={container,api,desenhar,filtro:'todos',recortes:new Map(),painelAberto:{id:null,aba:''}};
    desenhar();
  }
  globalThis.HoldingUI=Object.freeze({render,refAnexos});
})();
