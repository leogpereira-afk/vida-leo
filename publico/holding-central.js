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

function holdingPersistir(carteira, proxima, gastos = E.gastos) {
  if (proxima === carteira && gastos === E.gastos) return;
  const gastosAnteriores = E.gastos;
  const tinhaGastos = Object.hasOwn(E, 'gastos');
  const tinhaCarteira = Object.hasOwn(E, 'holdingImoveis');
  const tinhaMarca = Object.hasOwn(E, '_mt');
  const marca = E._mt;
  E.holdingImoveis = proxima;
  E.gastos = gastos;
  try {
    salvar();
  } catch (erro) {
    if (tinhaGastos) E.gastos = gastosAnteriores;
    else delete E.gastos;
    if (tinhaCarteira) E.holdingImoveis = carteira;
    else delete E.holdingImoveis;
    if (tinhaMarca) E._mt = marca;
    else delete E._mt;
    falhaSync(erro);
    throw Error('Não foi possível salvar neste dispositivo. Confira o armazenamento e tente novamente.');
  }
}

async function holdingConfirmarGravacao(aindaPresente, gastoPresente = () => true) {
  if (holdingLocal()) return 'Salvo neste dispositivo de prévia.';
  const confirmado = await enviarNuvem();
  if (!aindaPresente(holdingCarteira()) || !gastoPresente(E.gastos || [])) holdingConflito();
  // A outra aba pode ter confirmado a mesma parcela enquanto este PUT
  // recebia 409. A releitura do servidor comprova esse lançamento.
  const base = !confirmado && _tabConteudo ? JSON.parse(_tabConteudo) : null;
  const presenteNaNuvem = base && aindaPresente(base.holdingImoveis || []) && gastoPresente(base.gastos || []);
  return confirmado || presenteNaNuvem ? 'Salvo e sincronizado.' : 'Salvo neste dispositivo. Sincronização pendente.';
}

// Um identificador estável liga o gasto ao pagamento, inclusive após recarga
// ou repetição em outra aba. A configuração pertence ao cadastro privado.
function holdingIntegrarParcela(carteira, imovelId, parcelaId) {
  const gastos = E.gastos || [];
  const imovel = carteira.find(i => i.id === imovelId);
  if (!imovel?.gastosEmpresaId || !parcelaId) return { gastos, conferir: () => true };
  const empresa = (E.empresasPJ || []).find(e => e.id === imovel.gastosEmpresaId);
  if (!empresa) throw Error('Confira a empresa vinculada ao imóvel antes de registrar o pagamento.');
  const parcela = imovel.parcelas?.find(p => p.id === parcelaId);
  const pagamento = HoldingModelo.pagamentoDaParcela(imovel, parcelaId);
  if (!parcela || !pagamento) throw Error('A parcela e o pagamento precisam estar registrados juntos.');
  const vinculados = gastos.filter(g => g.holdingImovelId === imovelId && g.holdingParcelaId === parcelaId);
  if (vinculados.length > 1) throw Error('Há mais de um gasto vinculado a esta parcela. Confira os lançamentos.');
  const anterior = vinculados[0];
  const id = anterior?.id || 'gasto:' + HoldingUI.refAnexos(imovelId, 'parcela', parcelaId);
  if (!anterior && gastos.some(g => g.id === id)) throw Error('O identificador do gasto já está em uso.');
  const esperado = {
    ...anterior, id,
    oque: anterior?.oque || imovel.nome + ' · ' + parcela.descricao,
    valor: pagamento.valorCentavos / 100, mes: pagamento.data.slice(0,7),
    data: pagamento.data, pagoEm: pagamento.data, vencimento: parcela.vencimento || '',
    situacao: 'Pago', classe: anterior?.classe || 'Outros',
    empresaId: empresa.id, empresa: empresa.nome,
    holdingImovelId: imovelId, holdingParcelaId: parcelaId
  };
  const conferir = lista => {
    const registros = lista.filter(g => g.holdingImovelId === imovelId && g.holdingParcelaId === parcelaId);
    return registros.length === 1 && holdingMesmosDados(registros[0], esperado);
  };
  if (holdingMesmosDados(anterior, esperado)) return { gastos, conferir };
  return { gastos: anterior ? gastos.map(g => g.id === id ? esperado : g) : [...gastos, esperado], conferir };
}

function holdingAnexosCompartilhados(ref) {
  const gasto = ref.startsWith('gasto:') && (E.gastos || []).find(g => 'gasto:' + g.id === ref);
  const imoveis = E.holdingImoveis || [];
  if (gasto?.holdingImovelId && gasto.holdingParcelaId) {
    const imovel = imoveis.find(i => i.id === gasto.holdingImovelId);
    const parcela = imovel?.parcelas?.find(p => p.id === gasto.holdingParcelaId);
    if (parcela) return HoldingUI.refAnexos(imovel.id, 'parcela', parcela.id);
  }
  for (const imovel of imoveis) {
    if (!imovel.gastosEmpresaId) continue;
    if ((imovel.parcelas || []).some(p => HoldingUI.refAnexos(imovel.id,'parcela',p.id) === ref)) return ref;
  }
  return null;
}

async function holdingIdComprovante(ref, file, somenteNuvem = false) {
  const bytes = await file.arrayBuffer();
  const hash = async dados => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',dados)),b=>b.toString(16).padStart(2,'0')).join('');
  const digest = await hash(bytes);
  const id = 'anexo-holding-' + await hash(new TextEncoder().encode(ref + ':' + digest));
  const existentes = (await arqPor(ref)).filter(a => !somenteNuvem || a.nuvem);
  if (existentes.some(a => a.id === id)) return { id, existente: existentes.find(a => a.id === id) };
  // Anexos históricos mantêm o identificador já usado pelos comprovantes.
  for (const arquivo of existentes.filter(a => a.tam === file.size)) {
    const local = arquivo.blob || (await arqPorLocal(arquivo.id))?.blob;
    let conteudo;
    if (local) conteudo = await local.arrayBuffer();
    else {
      const url = await arqUrlDe(arquivo.id, false);
      const resposta = await fetch(url);
      if (!resposta.ok) throw Error('Não foi possível conferir o comprovante já anexado.');
      conteudo = await resposta.arrayBuffer();
    }
    if (await hash(conteudo) === digest) return { id: arquivo.id, existente: arquivo };
  }
  return { id };
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
  const integrado = holdingIntegrarParcela(proxima, imovelId, esperado.parcelaId);
  holdingPersistir(carteira, proxima, integrado.gastos);
  return holdingConfirmarGravacao(lista => holdingMesmosDados(esperado, localizar(lista)), integrado.conferir);
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
  const integrado = holdingIntegrarParcela(proxima, imovelId, operacao.gastoParcelaId);
  holdingPersistir(carteira, proxima, integrado.gastos);
  return holdingConfirmarGravacao(lista => {
    const salvo = lista.find(i => i.id === imovelId);
    return salvo && holdingMesmosDados(esperado, operacao.lerResultado(salvo));
  }, integrado.conferir);
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
    gastoParcelaId: parcelaId,
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
    pagarDespesa: holdingPagarDespesa
  });
}
