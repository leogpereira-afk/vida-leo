function holdingEstadoFinanceiro() {
  if (E.holdingFinanceiro === undefined) return HoldingCarteiraModelo.vazio();
  HoldingCarteiraModelo.validar(E.holdingFinanceiro, E.holdingImoveis ?? []);
  return E.holdingFinanceiro;
}

function holdingEmpresaParaExibir(registro) {
  if (!registro) return null;
  const vinculada = registro.empresaId && (E.empresasPJ || []).find(e => e.id === registro.empresaId);
  return { ...registro, nome:vinculada?.nome ?? registro.nome };
}

function holdingPersistirFinanceiro(proximo) {
  const anterior = E.holdingFinanceiro, tinha = Object.hasOwn(E,'holdingFinanceiro');
  const mt = E._mt, tinhaMt = Object.hasOwn(E,'_mt');
  E.holdingFinanceiro = proximo;
  try {
    salvar();
  } catch (erro) {
    if (tinha) E.holdingFinanceiro = anterior;
    else delete E.holdingFinanceiro;
    if (tinhaMt) E._mt = mt;
    else delete E._mt;
    falhaSync(erro);
    throw Error('Não foi possível salvar neste dispositivo. Confira o armazenamento e tente novamente.');
  }
}

async function holdingGravarFinanceiro({ base, localizar, aplicar, exibirBase }) {
  await holdingConferirBase();
  const estado = holdingEstadoFinanceiro(), atual = localizar(estado);
  if (base && !atual) holdingConflito();
  const proximo = aplicar(estado);
  if (proximo !== estado) {
    if (!holdingMesmosDados(exibirBase ? exibirBase(atual) : atual, base)) holdingConflito();
    holdingPersistirFinanceiro(proximo);
  }
  if (holdingLocal()) return 'Salvo neste dispositivo de prévia.';
  const esperado = localizar(proximo);
  const sincronizado = await enviarNuvem();
  if (!holdingMesmosDados(esperado, localizar(holdingEstadoFinanceiro()))) holdingConflito();
  const baseRemota = !sincronizado && _tabConteudo ? JSON.parse(_tabConteudo).holdingFinanceiro : null;
  const jaConfirmado = baseRemota && holdingMesmosDados(esperado, localizar(baseRemota));
  return sincronizado || jaConfirmado ? 'Salvo e sincronizado.' : 'Salvo neste dispositivo. Sincronização pendente.';
}

function holdingApiCarteira() {
  const acharImovel = (f,id) => (f.imoveis || []).find(i=>i.imovelId === id) ?? null;
  const acharEmpresa = (f,id) => (f.empresas || []).find(e=>e.id === id) ?? null;
  const acharMes = (f,tipo,origemId,competencia) => (f.mensais || []).find(m=>
    m.tipo === tipo && m.origemId === origemId && m.competencia === competencia) ?? null;
  return {
    novoId:uid,
    listar:() => structuredClone(holdingEstadoFinanceiro()),
    listarImoveis:() => structuredClone(holdingCarteira()),
    listarEmpresasPJ:() => (E.empresasPJ || []).map(e=>({id:e.id,nome:e.nome})),
    listarEmpresas:() => (holdingEstadoFinanceiro().empresas || []).map(e=>structuredClone(holdingEmpresaParaExibir(e))),
    listarMensais:() => structuredClone(holdingEstadoFinanceiro().mensais || []),
    lerValorImovel:imovelId => structuredClone(acharImovel(holdingEstadoFinanceiro(),imovelId)),
    lerMensal:(tipo,origemId,competencia) => structuredClone(acharMes(holdingEstadoFinanceiro(),tipo,origemId,competencia)),
    gravarValorImovel:(dados,base = null) => holdingGravarFinanceiro({
      base, localizar:f => acharImovel(f,dados.imovelId),
      aplicar:f => HoldingCarteiraModelo.salvarValorImovel(f,dados,holdingCarteira())
    }),
    gravarEmpresa:(dados,base = null) => holdingGravarFinanceiro({
      base, localizar:f => acharEmpresa(f,dados.id), exibirBase:holdingEmpresaParaExibir,
      aplicar:f => HoldingCarteiraModelo.salvarEmpresa(f,dados,E.empresasPJ || [])
    }),
    gravarMensal:(dados,base = null) => holdingGravarFinanceiro({
      base, localizar:f => acharMes(f,dados.tipo,dados.origemId,dados.competencia),
      aplicar:f => HoldingCarteiraModelo.salvarMensal(f,dados,holdingCarteira())
    })
  };
}
