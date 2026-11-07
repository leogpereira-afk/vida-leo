// Os valores dos bens são atuais. A competência só filtra os movimentos mensais.
function holdingNomeMes(competencia, curto = false) {
  const [ano, mes] = competencia.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: curto ? 'short' : 'long', year: curto ? '2-digit' : 'numeric' })
    .format(new Date(ano, mes-1, 15));
}

function holdingCoberturaIndicador(dados, unidade) {
  if (!dados.total) return 'Sem ' + unidade + ' no recorte';
  const nome = dados.total === 1 ? ({origens:'origem', ativos:'ativo', empresas:'empresa'}[unidade] || unidade) : unidade;
  if (!dados.informados) return 'Nenhum valor informado';
  return (dados.pendentes ? 'Parcial · ' : '') + dados.informados + ' de ' + dados.total + ' ' + nome + ' com valor';
}

function holdingValorCotaCentavos(aeronave) {
  const valor = aeronave.valorCotaAtual;
  if (valor !== null && valor !== undefined && valor !== '') return Math.round(Number(valor)*100);
  return aeronave.nome || aeronave.matricula || aeronave.aportes?.length ? null : undefined;
}

function holdingCartaoDashboard(titulo, dados, nota, unidade, abrir) {
  const btn = holdingElemento('button','holding-kpi-dashboard');
  btn.type = 'button';
  btn.append(holdingElemento('span','holding-kpi-rotulo',titulo),holdingElemento('strong','',holdingValorResumo(dados.conhecido)),
    holdingElemento('small','',nota),holdingElemento('span','holding-cobertura',holdingCoberturaIndicador(dados,unidade)));
  btn.addEventListener('click',abrir);
  return btn;
}

function holdingComposicaoPatrimonial(patrimonio, abrirGrupo, abrirAviao) {
  const secao = holdingElemento('section','holding-quadro holding-composicao-atual');
  secao.append(holdingElemento('h3','','Composição do patrimônio'));
  const fontes = [['Imóveis',patrimonio.imoveis,'imoveis'],['Participações em empresas',patrimonio.empresas,'empresas'],['Cota da aeronave',patrimonio.aeronave,null]];
  for (const [nome, dados, grupo] of fontes) {
    const linha = holdingElemento('button','holding-faixa-patrimonio');
    linha.type = 'button';
    linha.addEventListener('click',() => grupo ? abrirGrupo(grupo) : abrirAviao());
    linha.append(holdingElemento('span','',nome),holdingElemento('strong','',dados.total ? holdingValorResumo(dados.conhecido) : 'Sem cadastro'));
    if (patrimonio.total.conhecido > 0 && dados.conhecido !== null) {
      const fracao = dados.conhecido / patrimonio.total.conhecido;
      const trilho = holdingElemento('span','holding-trilho');
      const barra = holdingElemento('i');
      barra.style.width = (100 * fracao) + '%';
      trilho.append(barra);
      linha.append(trilho,holdingElemento('small','',fracao.toLocaleString('pt-BR',{style:'percent',maximumFractionDigits:1}) + ' do valor avaliado'));
    }
    secao.append(linha);
  }
  return secao;
}

function holdingGraficoMeses(serie, mesAtual, selecionarMes) {
  const secao = holdingElemento('section','holding-quadro holding-evolucao');
  secao.append(holdingElemento('h3','','Últimos seis meses'));
  const nav = holdingElemento('div','holding-variaveis');
  nav.setAttribute('role','group'); nav.setAttribute('aria-label','Medida do gráfico');
  const quadro = holdingElemento('div');
  const opcoes = [['renda','Renda recebida'],['faturamento','Faturamento']];
  const botoes = new Map();
  function desenhar(campo) {
    filtro.holdingSerie = campo;
    for (const [id,botao] of botoes) botao.setAttribute('aria-pressed',String(id === campo));
    quadro.replaceChildren();
    const conhecidos = serie.map(linha=>linha[campo].conhecido).filter(v=>v !== null);
    if (!conhecidos.length) {
      quadro.append(holdingElemento('p','holding-grafico-vazio',campo === 'renda'
        ? 'Sem aluguéis ou repasses informados neste período.' : 'Sem faturamento informado neste período.'));
      return;
    }
    const maximo = Math.max(1,...conhecidos);
    const colunas = holdingElemento('div','holding-colunas-mensais');
    const tabela = holdingElemento('details','holding-tabela-meses');
    tabela.append(holdingElemento('summary','','Valores por mês'));
    const lista = holdingElemento('dl','holding-resumo-aeronave');
    for (const linha of serie) {
      const ponto = linha[campo];
      const botao = holdingElemento('button','holding-coluna');
      botao.type='button';
      const nomeMes=holdingNomeMes(linha.competencia,true);
      const exato=holdingValorResumo(ponto.conhecido);
      const cobertura=holdingCoberturaIndicador(ponto,'origens');
      botao.title=nomeMes+' · '+exato+' · '+cobertura;
      botao.setAttribute('aria-label','Ver '+botao.title);
      botao.setAttribute('aria-pressed',String(linha.competencia === mesAtual));
      const area=holdingElemento('span','holding-area-coluna');
      if (ponto.conhecido !== null) {
        const barra=holdingElemento('i'); barra.style.height=(100*ponto.conhecido/maximo)+'%';
        area.append(barra);
      } else area.append(holdingElemento('span','','—'));
      botao.append(area,holdingElemento('small','',nomeMes));
      botao.addEventListener('click',()=>selecionarMes(linha.competencia));
      colunas.append(botao);
      const item=holdingElemento('div');item.append(holdingElemento('dt','',nomeMes),holdingElemento('dd','',exato+(ponto.pendentes && ponto.informados ? ' · parcial' : '')));
      lista.append(item);
    }
    tabela.append(lista); quadro.append(colunas,tabela);
  }
  for (const [id,rotulo] of opcoes) {
    const botao=holdingElemento('button','',rotulo);botao.type='button';
    botao.addEventListener('click',()=>desenhar(id));botoes.set(id,botao);nav.append(botao);
  }
  secao.append(nav,quadro);
  desenhar(filtro.holdingSerie==='faturamento'?'faturamento':'renda');
  return secao;
}

function vUniversoHolding(m) {
  const raiz = holdingElemento('section','holding-area holding-inicio');
  const abrirAviao = () => irTela('aviao');
  raiz.append(holdingCabecalho('resumo'));
  const titulo=holdingElemento('div','holding-titulo-resumo');
  const rotulo=holdingElemento('label','holding-mes-dashboard');
  const mes=holdingElemento('input');mes.type='month';
  mes.value=filtro.holdingCompetencia || hoje().slice(0,7);
  rotulo.append(holdingElemento('span','','Mês de referência'),mes);
  titulo.append(holdingElemento('h1','','Resumo do patrimônio'),rotulo);
  const paineis=holdingElemento('div','holding-dados-dashboard');
  const cadastros=holdingElemento('section','holding-cadastros-dashboard');
  const contas=holdingElemento('div');
  raiz.append(titulo,paineis,cadastros,contas);m.append(raiz);

  function abrirGrupo(grupo) {
    const alvo=cadastros.querySelector('[data-carteira-grupo="'+grupo+'"]');
    if (!alvo) return;
    alvo.open=true;
    alvo.scrollIntoView({block:'nearest'});alvo.querySelector('summary')?.focus();
  }
  function competencia() {return filtro.holdingCompetencia || hoje().slice(0,7);}
  function atualizarResumo() {
    const carteira=holdingCarteira();
    const financeiro=HoldingCarteiraModelo.resumo(E.holdingFinanceiro,{
      imoveis:carteira,empresasPJ:E.empresasPJ,competencia:competencia(),
      valorAeronaveCentavos:holdingValorCotaCentavos(E.aviao),quantidadeMeses:6
    });
    const composicao=holdingComposicaoPatrimonial(financeiro.patrimonio,abrirGrupo,abrirAviao);
    const renda=holdingElemento('details','holding-origens-renda');
    renda.open=Boolean(paineis.querySelector('.holding-origens-renda')?.open);
    renda.append(holdingElemento('summary','','Composição da renda de '+holdingNomeMes(competencia())));
    for(const [nome,indicador,grupo] of [['Aluguéis recebidos',financeiro.mes.alugueis,'imoveis'],['Repasses recebidos',financeiro.mes.repasses,'empresas']]) {
      const bt=holdingElemento('button','holding-origem-renda');bt.type='button';
      bt.append(holdingElemento('span','',nome),holdingElemento('strong','',holdingValorResumo(indicador.conhecido)));
      bt.addEventListener('click',()=>abrirGrupo(grupo));renda.append(bt);
    }
    const linha=holdingElemento('div','holding-kpis-dashboard');
    linha.append(holdingCartaoDashboard('Patrimônio avaliado',financeiro.patrimonio.total,'Valor bruto atual dos bens e participações','ativos',()=>{
      composicao.scrollIntoView({block:'nearest'});composicao.querySelector('button')?.focus();
    }),
      holdingCartaoDashboard('Renda recebida no mês',financeiro.mes.renda,'Aluguéis recebidos + repasses das empresas','origens',()=>{
        renda.open=true;renda.querySelector('summary').focus();
      }),
      holdingCartaoDashboard('Faturamento das empresas',financeiro.mes.faturamento,holdingNomeMes(competencia()),'empresas',()=>abrirGrupo('empresas')));
    const graficos=holdingElemento('div','holding-quadros holding-graficos');
    graficos.append(composicao,holdingGraficoMeses(financeiro.serie,competencia(),trocarMes));
    paineis.replaceChildren(linha,graficos,renda);
    const aberto=Boolean(contas.querySelector('details')?.open);
    const detalhes=holdingContasAquisicao(holdingConsolidar(carteira,E.aviao));detalhes.open=aberto;
    contas.replaceChildren(detalhes);
  }
  function preencherCadastros() {
    const grupos=[...cadastros.querySelectorAll('[data-carteira-grupo][open]')].map(el=>el.dataset.carteiraGrupo);
    cadastros.replaceChildren();
    holdingRenderCarteira(cadastros,{mes:competencia(),aoAtualizar:atualizarResumo});
    for(const grupo of grupos) {
      const alvo=cadastros.querySelector('[data-carteira-grupo="'+grupo+'"]');if(alvo)alvo.open=true;
    }
  }
  function trocarMes(valor) {
    if(valor===competencia())return;
    const aviso=impedimentoSaidaHolding();
    if(aviso){mes.value=competencia();alert(aviso);return;}
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)||valor<'1000-01'){mes.value=competencia();return;}
    filtro.holdingCompetencia=valor;mes.value=valor;
    atualizarResumo();preencherCadastros();
  }
  mes.addEventListener('change',()=>trocarMes(mes.value));
  atualizarResumo();preencherCadastros();
}

function vUniversoEmpresas(m) {
  const raiz = holdingElemento('section','holding-area');
  raiz.append(holdingCabecalho('universo-empresas'));
  const competencia = filtro.holdingCompetencia || hoje().slice(0,7);
  const topo = holdingElemento('div','holding-titulo-resumo');
  topo.append(holdingElemento('h1','','Empresas'),holdingElemento('span','',holdingNomeMes(competencia)));
  raiz.append(topo);
  m.append(raiz);
  holdingRenderCarteira(raiz,{mes:competencia, somenteEmpresas:true});
}
