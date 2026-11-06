(() => {
  'use strict';
  const secoes = ['imoveis','empresas','mensais'];
  const vazio = () => ({ imoveis:[], empresas:[], mensais:[] });
  const lista = (estado, chave) => estado?.[chave] ?? [];

  function id(valor) {
    if (typeof valor !== 'string' || !valor.trim() || valor !== valor.trim()) throw Error('Confira o identificador do registro.');
    return valor;
  }
  function competencia(valor) {
    if (typeof valor !== 'string' || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(valor)) throw Error('Informe a competência com ano e mês válidos.');
    return valor;
  }
  function dinheiro(valor) {
    if (valor == null) return null;
    if (!Number.isSafeInteger(valor) || valor < 0) throw Error('O valor precisa ser zero ou positivo e estar em centavos.');
    return valor;
  }
  function percentual(valor) {
    if (valor == null) return null;
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) throw Error('A participação deve estar entre 0% e 100%.');
    return valor;
  }
  function valorImovel(d) {
    return { imovelId:id(d.imovelId), valorAtualCentavos:dinheiro(d.valorAtualCentavos) };
  }
  function empresa(d) {
    if (typeof d.nome !== 'string' || !d.nome.trim()) throw Error('Informe o nome da empresa.');
    return { id:id(d.id), empresaId:d.empresaId == null || d.empresaId === '' ? null : id(d.empresaId),
      nome:d.nome.trim(), participacaoPct:percentual(d.participacaoPct), valorParticipacaoCentavos:dinheiro(d.valorParticipacaoCentavos) };
  }
  function mensal(d) {
    if (!['imovel','empresa'].includes(d.tipo)) throw Error('Escolha uma origem de imóvel ou empresa.');
    const base = { tipo:d.tipo, origemId:id(d.origemId), competencia:competencia(d.competencia) };
    if (d.tipo === 'imovel') {
      if (d.faturamentoCentavos != null || d.repasseCentavos != null) throw Error('Faturamento e repasse pertencem às empresas.');
      return { ...base, aluguelCentavos:dinheiro(d.aluguelCentavos) };
    }
    if (d.aluguelCentavos != null) throw Error('O aluguel pertence ao imóvel.');
    return { ...base, faturamentoCentavos:dinheiro(d.faturamentoCentavos), repasseCentavos:dinheiro(d.repasseCentavos) };
  }
  const chaveMensal = m => JSON.stringify([m.tipo,m.origemId,m.competencia]);
  const formatos = {
    imoveis:{ campos:valorImovel, chave:d=>d.imovelId },
    empresas:{ campos:empresa, chave:d=>d.id },
    mensais:{ campos:mensal, chave:chaveMensal }
  };

  function validar(estado, imoveis) {
    if (estado === undefined) return;
    if (!estado || typeof estado !== 'object' || Array.isArray(estado)) throw Error('Os dados financeiros da holding são inválidos.');
    const vinculadas = new Set();
    const participacoes = new Set();
    const imoveisAtuais = imoveis === undefined ? null : new Set(imoveis.map(i=>i.id));
    for (const secao of secoes) {
      if (estado[secao] !== undefined && !Array.isArray(estado[secao])) throw Error('Lista financeira inválida: ' + secao);
      const formato = formatos[secao], ids = new Set();
      for (const registro of lista(estado,secao)) {
        if (!registro || typeof registro !== 'object' || Array.isArray(registro)) throw Error('Registro financeiro inválido.');
        const dados = formato.campos(registro), chave = formato.chave(dados);
        if (ids.has(chave)) throw Error('Registro financeiro duplicado na mesma origem ou competência.');
        ids.add(chave);
        if (secao === 'imoveis' && imoveisAtuais && !imoveisAtuais.has(dados.imovelId)) throw Error('Avaliação vinculada a imóvel desconhecido.');
        if (secao === 'empresas') {
          participacoes.add(dados.id);
          if (dados.empresaId) {
            if (vinculadas.has(dados.empresaId)) throw Error('Esta empresa da Central já está na holding.');
            vinculadas.add(dados.empresaId);
          }
        }
        if (secao === 'mensais') {
          const origens = dados.tipo === 'empresa' ? participacoes : imoveisAtuais;
          if (origens && !origens.has(dados.origemId)) throw Error('Origem do lançamento mensal não encontrada.');
        }
        if (registro.historico !== undefined) {
          if (!Array.isArray(registro.historico)) throw Error('O histórico financeiro é inválido.');
          for (const revisao of registro.historico) {
            if (!revisao?.antes || typeof revisao.alteradoEm !== 'string' || Number.isNaN(Date.parse(revisao.alteradoEm)) ||
                formato.chave(formato.campos(revisao.antes)) !== chave) throw Error('Revisão financeira inválida.');
          }
        }
      }
    }
  }

  function atualizar(estado, secao, dados, imoveis) {
    validar(estado,imoveis);
    const formato = formatos[secao], itens = lista(estado,secao);
    const chave = formato.chave(dados), anterior = itens.find(item=>formato.chave(item) === chave);
    const informados = Object.fromEntries(Object.entries(dados).filter(([,valor])=>valor !== undefined));
    const campos = formato.campos({ ...anterior,...informados });
    const anteriores = anterior && formato.campos(anterior);
    if (anteriores && Object.keys(campos).every(k => campos[k] === anteriores[k])) return estado;
    const novo = { ...anterior, ...campos };
    if (anterior) novo.historico = [...(anterior.historico || []), { alteradoEm:new Date().toISOString(), antes:anteriores }];
    const saida = { ...(estado ?? vazio()), [secao]:anterior ? itens.map(i=>i === anterior ? novo : i) : [...itens,novo] };
    validar(saida,imoveis);
    return saida;
  }
  function salvarValorImovel(estado, dados, imoveis) {
    if (!imoveis.some(i=>i.id === dados.imovelId)) throw Error('Imóvel da holding não encontrado.');
    return atualizar(estado,'imoveis',dados,imoveis);
  }
  function salvarEmpresa(estado, dados, empresasPJ = []) {
    const anterior = lista(estado,'empresas').find(e=>e.id === dados.id);
    const vinculo = dados.empresaId === undefined ? anterior?.empresaId ?? null : dados.empresaId || null;
    const central = vinculo && empresasPJ.find(e=>e.id === vinculo);
    if (vinculo && !central && anterior?.empresaId !== vinculo) throw Error('A empresa selecionada não está no cadastro da Central.');
    if (anterior && (anterior.empresaId ?? null) !== vinculo && lista(estado,'mensais').some(m=>m.tipo === 'empresa' && m.origemId === anterior.id)) {
      throw Error('Esta participação já possui lançamentos mensais. Cadastre outra participação para vincular outra empresa.');
    }
    return atualizar(estado,'empresas',{ ...dados, empresaId:vinculo, nome:central?.nome ?? dados.nome ?? anterior?.nome });
  }
  function salvarMensal(estado, dados, imoveis) {
    const origens = dados.tipo === 'empresa' ? lista(estado,'empresas') : imoveis;
    if (!origens.some(i=>i.id === dados.origemId)) throw Error('A origem do lançamento não está na carteira.');
    return atualizar(estado,'mensais',dados,imoveis);
  }
  function indicador(valores) {
    let conhecido = null, informados = 0;
    for (const valor of valores) {
      if (valor == null) continue;
      conhecido = (conhecido ?? 0) + dinheiro(valor); informados++;
      if (!Number.isSafeInteger(conhecido)) throw Error('O total ultrapassa o limite financeiro aceito.');
    }
    return { conhecido, informados, pendentes:valores.length - informados, total:valores.length };
  }
  function mesAnterior(fim, passos) {
    const [ano,mes] = fim.split('-').map(Number), posicao = ano * 12 + mes - 1 - passos;
    const anoResultante = Math.floor(posicao / 12);
    if (anoResultante < 1) throw Error('O intervalo solicitado ultrapassa as competências válidas.');
    return String(anoResultante).padStart(4,'0') + '-' + String(posicao % 12 + 1).padStart(2,'0');
  }
  function resumo(estado, { imoveis = [], competencia:selecao, valorAeronaveCentavos, quantidadeMeses = 6 }) {
    validar(estado,imoveis);
    competencia(selecao);
    if (!Number.isInteger(quantidadeMeses) || quantidadeMeses < 1 || quantidadeMeses > 120) throw Error('Intervalo mensal inválido.');
    const avaliacoes = new Map(lista(estado,'imoveis').map(i=>[i.imovelId,i.valorAtualCentavos]));
    const empresas = lista(estado,'empresas');
    const valoresImoveis = imoveis.map(i=>avaliacoes.get(i.id));
    const valoresEmpresas = empresas.map(e=>e.valorParticipacaoCentavos);
    const valoresAviao = valorAeronaveCentavos === undefined ? [] : [valorAeronaveCentavos];
    const patrimonio = { imoveis:indicador(valoresImoveis), empresas:indicador(valoresEmpresas), aeronave:indicador(valoresAviao),
      total:indicador([...valoresImoveis,...valoresEmpresas,...valoresAviao]) };
    const mensais = new Map(lista(estado,'mensais').map(m=>[chaveMensal(m),m]));
    const porMes = mes => {
      const registro = (tipo,id) => mensais.get(chaveMensal({tipo,origemId:id,competencia:mes}));
      const alugueis = imoveis.map(i=>registro('imovel',i.id)?.aluguelCentavos);
      const empresasMes = empresas.map(e=>registro('empresa',e.id));
      const repasses = empresasMes.map(e=>e?.repasseCentavos);
      return { competencia:mes, alugueis:indicador(alugueis), repasses:indicador(repasses),
        faturamento:indicador(empresasMes.map(e=>e?.faturamentoCentavos)), renda:indicador([...alugueis,...repasses]) };
    };
    const serie = Array.from({length:quantidadeMeses},(_,i)=>porMes(mesAnterior(selecao,quantidadeMeses - i - 1)));
    return { patrimonio, mes:serie.at(-1), serie };
  }
  globalThis.HoldingCarteiraModelo = Object.freeze({ vazio, validar, salvarValorImovel, salvarEmpresa, salvarMensal, resumo });
})();
