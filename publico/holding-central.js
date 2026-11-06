/* A carteira é uma seção opcional do estado privado da Central. Consultar
   imóveis não cria registros nem altera a base usada pela sincronização. */
function holdingCarteira() {
  const carteira = E.holdingImoveis === undefined ? [] : E.holdingImoveis;
  return HoldingModelo.validarCarteira(carteira);
}

function holdingLocal() {
  return DEV && !window.__testeSync;
}

async function holdingConferirBase() {
  if (holdingLocal() || _tabBase) return;
  try {
    if (await conferirBaseInicial() && _tabBase) return;
  } catch (erro) {
    falhaSync(erro);
  }
  throw Error('Confira a sincronização antes de salvar. O formulário continua disponível.');
}

function holdingMetadadosImovel(imovel) {
  return imovel && { id: imovel.id, nome: imovel.nome, totalCentavos: imovel.totalCentavos ?? null };
}

function holdingMesmosDados(a, b) {
  return conteudoSync(a ?? null) === conteudoSync(b ?? null);
}

function holdingConflito() {
  throw Error('Este registro mudou desde que o formulário foi aberto. Confira os dados atuais e reabra a edição.');
}

function holdingPersistir(carteira, proxima) {
  if (proxima === carteira) return;
  const tinhaCarteira = Object.hasOwn(E, 'holdingImoveis');
  const tinhaMarca = Object.hasOwn(E, '_mt');
  const marca = E._mt;
  E.holdingImoveis = proxima;
  try {
    salvar();
  } catch (erro) {
    if (tinhaCarteira) E.holdingImoveis = carteira;
    else delete E.holdingImoveis;
    if (tinhaMarca) E._mt = marca;
    else delete E._mt;
    falhaSync(erro);
    throw Error('Não foi possível salvar neste dispositivo. Confira o armazenamento e tente novamente.');
  }
}

async function holdingConfirmarGravacao(aindaPresente) {
  if (holdingLocal()) return 'Salvo neste dispositivo de prévia.';
  const confirmado = await enviarNuvem();
  if (!aindaPresente(holdingCarteira())) holdingConflito();
  // A outra aba pode ter confirmado a mesma parcela enquanto este PUT
  // recebia 409. A releitura do servidor comprova esse lançamento.
  const base = !confirmado && _tabConteudo ? JSON.parse(_tabConteudo) : null;
  const presenteNaNuvem = base && aindaPresente(base.holdingImoveis || []);
  return confirmado || presenteNaNuvem ? 'Salvo e sincronizado.' : 'Salvo neste dispositivo. Sincronização pendente.';
}

async function holdingGravarImovel(dados, baseImovel = null) {
  await holdingConferirBase();
  const carteira = holdingCarteira();
  const atualImovel = carteira.find(item => item.id === dados.id);
  // Um mesmo envio já aplicado pode ser repetido. Uma edição baseada em
  // outra ficha não pode recriar um imóvel que foi removido em outro acesso.
  if (baseImovel && (!atualImovel || baseImovel.id !== dados.id)) holdingConflito();
  const proxima = HoldingModelo.salvarImovel(carteira, dados);
  if (proxima !== carteira && !holdingMesmosDados(holdingMetadadosImovel(atualImovel), holdingMetadadosImovel(baseImovel))) holdingConflito();
  const esperado = holdingMetadadosImovel(proxima.find(item => item.id === dados.id));
  holdingPersistir(carteira, proxima);
  return holdingConfirmarGravacao(lista => holdingMesmosDados(esperado,
    holdingMetadadosImovel(lista.find(item => item.id === dados.id))));
}

async function holdingGravarPagamento(imovelId, dados, basePagamento = null, baseImovel = null) {
  await holdingConferirBase();
  const carteira = holdingCarteira();
  const imovel = carteira.find(item => item.id === imovelId);
  if (!imovel || !baseImovel || baseImovel.id !== imovelId) holdingConflito();
  const pagamento = (imovel.pagamentos || []).find(item => item.id === dados.id);
  if (basePagamento && (!pagamento || basePagamento.id !== dados.id)) holdingConflito();
  const proxima = HoldingModelo.salvarPagamento(carteira, imovelId, dados);
  // Lançamentos diferentes no mesmo imóvel podem coexistir. A soma e o
  // saldo são validados sobre a carteira atual, após a primeira leitura.
  if (proxima !== carteira && (!holdingMesmosDados(pagamento, basePagamento) ||
      !holdingMesmosDados(holdingMetadadosImovel(imovel), holdingMetadadosImovel(baseImovel)))) holdingConflito();
  const localizar = lista => lista.find(item => item.id === imovelId)?.pagamentos?.find(item => item.id === dados.id);
  const esperado = localizar(proxima);
  holdingPersistir(carteira, proxima);
  return holdingConfirmarGravacao(lista => holdingMesmosDados(esperado, localizar(lista)));
}

/* Só o registro que o formulário abriu constitui a base de edição. Os
   demais lançamentos são sempre relidos da carteira atual antes de salvar. */
async function holdingMovimentar(imovelId, baseImovel, operacao) {
  await holdingConferirBase();
  const carteira = holdingCarteira();
  const imovel = carteira.find(i => i.id === imovelId);
  if (!imovel || baseImovel?.id !== imovelId) holdingConflito();
  const proxima = operacao.aplicar(carteira);
  if (proxima !== carteira) {
    if (!holdingMesmosDados(holdingMetadadosImovel(imovel), holdingMetadadosImovel(baseImovel))) holdingConflito();
    if (operacao.lerBase && !holdingMesmosDados(operacao.lerBase(imovel), operacao.base)) holdingConflito();
  }
  const esperado = operacao.lerResultado(proxima.find(i => i.id === imovelId));
  holdingPersistir(carteira, proxima);
  return holdingConfirmarGravacao(lista => {
    const salvo = lista.find(i => i.id === imovelId);
    return salvo && holdingMesmosDados(esperado, operacao.lerResultado(salvo));
  });
}

function holdingItensSerie(imovel, chave, dados) {
  const itens = imovel[chave] || [];
  return Array.from({ length: dados.quantidade ?? 1 }, (_, i) => itens.find(x => x.id === HoldingModelo.idDaSerie(dados.id, i)));
}

function holdingGravarSerie(imovelId, dados, baseImovel) {
  return holdingMovimentar(imovelId, baseImovel, {
    aplicar: carteira => HoldingModelo.gravarSerie(carteira, imovelId, dados),
    lerResultado: item => holdingItensSerie(item, 'parcelas', dados)
  });
}

function holdingEditarParcela(imovelId, dados, baseParcela, baseImovel) {
  const ler = item => item.parcelas?.find(p => p.id === dados.id);
  return holdingMovimentar(imovelId, baseImovel, {
    base: baseParcela, lerBase: ler, lerResultado: ler,
    aplicar: carteira => HoldingModelo.editarParcela(carteira, imovelId, dados)
  });
}

function holdingPagarParcela(imovelId, parcelaId, baseParcela, baseImovel) {
  return holdingMovimentar(imovelId, baseImovel, {
    base: baseParcela,
    lerBase: item => item.parcelas?.find(p => p.id === parcelaId),
    aplicar: carteira => HoldingModelo.pagarParcela(carteira, imovelId, parcelaId, hoje()),
    lerResultado: item => HoldingModelo.pagamentoDaParcela(item, parcelaId)
  });
}

function holdingGravarDespesa(imovelId, dados, baseDespesa, baseImovel) {
  return holdingMovimentar(imovelId, baseImovel, {
    base: baseDespesa,
    lerBase: item => item.despesas?.find(d => d.id === dados.id),
    aplicar: carteira => HoldingModelo.gravarDespesa(carteira, imovelId, dados),
    lerResultado: item => holdingItensSerie(item, 'despesas', dados)
  });
}

function holdingPagarDespesa(imovelId, despesaId, baseDespesa, baseImovel) {
  const ler = item => item.despesas?.find(d => d.id === despesaId);
  return holdingMovimentar(imovelId, baseImovel, {
    base: baseDespesa, lerBase: ler, lerResultado: ler,
    aplicar: carteira => HoldingModelo.pagarDespesa(carteira, imovelId, despesaId, hoje())
  });
}

function vUniversoImoveis(m) {
  HoldingUI.render(m, {
    listar: holdingCarteira,
    novoId: uid,
    hoje,
    gravarImovel: holdingGravarImovel,
    gravarPagamento: holdingGravarPagamento,
    gravarSerie: holdingGravarSerie,
    editarParcela: holdingEditarParcela,
    pagarParcela: holdingPagarParcela,
    gravarDespesa: holdingGravarDespesa,
    pagarDespesa: holdingPagarDespesa,
    abrirResumo: () => irTela('universo-holding'),
    abrirImoveis: () => irTela('universo-imoveis'),
    abrirAviao: () => irTela('aviao')
  });
}
