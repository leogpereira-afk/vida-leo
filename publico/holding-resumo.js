/* O resumo só lê a carteira e a ficha da aeronave. Os valores de aquisição e
   os gastos de manutenção têm bases diferentes e são apresentados em separado. */
function holdingElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto != null) elemento.textContent = texto;
  return elemento;
}

function holdingAtalho(texto, desenho, destino, ativo = false) {
  const botao = holdingElemento('button', 'holding-destino');
  botao.type = 'button';
  botao.setAttribute('aria-label', texto === 'Imóveis' ? 'Abrir imóveis' : 'Abrir avião');
  botao.title = texto;
  if (ativo) botao.setAttribute('aria-current', 'page');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', desenho);
  svg.append(path);
  botao.append(svg);
  if (texto === 'Imóveis') botao.append(holdingElemento('span', '', texto));
  botao.addEventListener('click', destino);
  return botao;
}

function holdingCabecalho(acoes, secao) {
  const cab = holdingElemento('header', 'holding-cabecalho holding-cab-navegacao');
  cab.append(holdingAtalho('Imóveis','M2.5 10.5 12 3l9.5 7.5M5 9v12h14V9M9.5 21v-7h5v7', acoes.abrirImoveis, secao === 'imoveis'));
  const marca = holdingElemento('div', 'holding-titulo holding-marca');
  marca.append(holdingElemento('h1', '', 'Universo Holding'));
  if (secao !== 'resumo') {
    const retorno = holdingElemento('button', 'holding-voltar-resumo', '← Resumo do patrimônio');
    retorno.type = 'button';
    retorno.addEventListener('click', acoes.abrirResumo);
    marca.append(retorno);
  }
  cab.append(marca, holdingAtalho('Avião','M21 3c1 1-1 4-3 6l-2 2 2 8-2 2-4-7-4 3v3l-1 1-2-4-3-2 1-1h3l3-4-7-4 2-2 8 2 2-2c2-2 5-4 6-3Z', acoes.abrirAviao));
  return cab;
}

function holdingConsolidar(carteira, aviao) {
  const tipos = ['investimento', 'condominio', 'impostos', 'avulsa'];
  const despesas = Object.fromEntries(tipos.map(tipo => [tipo, { pago: 0, aberto: 0, semValor: 0, registros: 0 }]));
  const imoveis = { quantidade: carteira.length, comValor: 0, quitados: 0, saldo: 0, pago: 0 };
  for (const imovel of carteira) {
    const resumo = HoldingModelo.resumo(imovel);
    imoveis.pago += resumo.pago;
    if (resumo.saldo !== null) {
      imoveis.saldo += resumo.saldo;
      imoveis.comValor++;
    }
    if (resumo.status === 'Quitado') imoveis.quitados++;
    const porTipo = HoldingModelo.resumoDespesas(imovel);
    for (const tipo of tipos) {
      const grupo = despesas[tipo];
      grupo.registros += porTipo[tipo].quantidade;
      grupo.semValor += porTipo[tipo].aInformar;
      grupo.pago += porTipo[tipo].pago;
      grupo.aberto += porTipo[tipo].aberto;
    }
  }
  const aquisicaoAviao = Math.round(totaisAviao(aviao).aportado * 100);
  return { imoveis, despesas, aquisicaoAviao, pagoAquisicoes: imoveis.pago + aquisicaoAviao };
}

function holdingValorResumo(centavos) {
  return centavos == null ? 'A informar' : brl(centavos / 100);
}

function holdingIndicador(rotulo, valor, nota) {
  const div = holdingElemento('div', 'holding-indicador');
  div.append(holdingElemento('dt', '', rotulo), holdingElemento('dd', '', valor), holdingElemento('small', '', nota));
  return div;
}

function holdingQuadroImoveis({imoveis, despesas}) {
  const sec = holdingElemento('section', 'holding-quadro');
  sec.append(holdingElemento('h3', '', 'Imóveis'));
  const categorias = [['Investimento no imóvel','investimento'],['Condomínio','condominio'],['Impostos','impostos']];
  if (despesas.avulsa.registros) categorias.push(['Outras despesas','avulsa']);
  const tabela = holdingElemento('table', 'holding-composicao');
  tabela.setAttribute('aria-label', 'Composição dos valores dos imóveis');
  const head = holdingElemento('thead');
  const titulos = holdingElemento('tr');
  head.append(titulos);
  for (const titulo of ['Tipo de lançamento','Pago','Em aberto']) {
    const th = holdingElemento('th', '', titulo); th.scope = 'col'; titulos.append(th);
  }
  const corpo = holdingElemento('tbody');
  tabela.append(head,corpo);
  function linha(nome, pago, aberto, semValor = 0) {
    const tr = holdingElemento('tr');
    corpo.append(tr);
    const th = holdingElemento('th', '', nome); th.scope='row';
    const saldo = holdingElemento('td', '', holdingValorResumo(aberto));
    if (semValor && aberto != null) saldo.append(holdingElemento('small', '', semValor + ' a informar'));
    tr.append(th, holdingElemento('td','',holdingValorResumo(pago)), saldo);
  }
  const faltamValores = imoveis.quantidade - imoveis.comValor;
  linha('Parcela de aquisição', imoveis.pago, faltamValores && !imoveis.comValor ? null : imoveis.saldo, faltamValores);
  for (const [nome, tipo] of categorias) {
    const grupo = despesas[tipo];
    linha(nome, grupo.pago, grupo.semValor && !grupo.aberto ? null : grupo.aberto, grupo.semValor);
  }
  sec.append(tabela);
  return sec;
}

function holdingQuadroAviao(a, aquisicaoAviao) {
  const sec = holdingElemento('section', 'holding-quadro');
  sec.append(holdingElemento('h3','','Aeronave'));
  const identificacao = [a.nome, a.matricula].filter(Boolean).join(' · ');
  if (identificacao) sec.append(holdingElemento('p','holding-identificacao',identificacao));
  const dl = holdingElemento('dl','holding-resumo-aeronave');
  for (const [rotulo, valor] of [
    ['Participação', a.participacao == null ? 'A informar' : Number(a.participacao).toLocaleString('pt-BR',{style:'percent',maximumFractionDigits:2})],
    ['Pago na aquisição da cota', holdingValorResumo(aquisicaoAviao)],
    ['Valor estimado da cota', a.valorCotaAtual == null ? 'A informar' : brl(a.valorCotaAtual)]
  ]) {
    const item = holdingElemento('div');
    item.append(holdingElemento('dt','',rotulo),holdingElemento('dd','',valor));
    dl.append(item);
  }
  sec.append(dl);
  return sec;
}

function holdingContasAquisicao(resumo) {
  const secao = holdingElemento('details','holding-contas');
  secao.append(holdingElemento('summary','','Aquisições, saldos e despesas dos imóveis'));
  const { imoveis, despesas } = resumo;
  const indicadores = holdingElemento('dl','holding-indicadores');
  const conhecidos = imoveis.comValor || !imoveis.quantidade;
  const grupos = Object.values(despesas);
  const emAberto = grupos.reduce((s,d) => s + d.aberto, 0);
  const semValor = grupos.reduce((s,d) => s + d.semValor, 0);
  indicadores.append(holdingIndicador('Pago em aquisições',holdingValorResumo(resumo.pagoAquisicoes),'Imóveis e cota da aeronave'),
    holdingIndicador('Saldo de aquisição dos imóveis',holdingValorResumo(conhecidos ? imoveis.saldo : null),
      'Valor informado em ' + imoveis.comValor + ' de ' + imoveis.quantidade),
    holdingIndicador('Despesas dos imóveis em aberto',holdingValorResumo(semValor && !emAberto ? null : emAberto),
      semValor ? semValor + ' com valor a informar' : 'Investimentos, condomínio e impostos'));
  const quadros = holdingElemento('div','holding-quadros');
  quadros.append(holdingQuadroImoveis(resumo),holdingQuadroAviao(E.aviao,resumo.aquisicaoAviao));
  secao.append(indicadores,quadros);
  return secao;
}
