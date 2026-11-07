(() => {
  'use strict';

  function inteiroPositivo(valor, campo) {
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      throw new Error(campo + ' deve ser maior que zero e estar em centavos.');
    }
    return valor;
  }

  function centavos(texto) {
    if (texto === null || texto === undefined || String(texto).trim() === '') return null;
    const original = String(texto).trim().replace(/^R\$\s*/i, '');
    let inteiro, fracao;
    const brasileiro = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(original);
    const decimal = /^(\d+)\.(\d{1,2})$/.exec(original);
    if (brasileiro) {
      inteiro = brasileiro[1].replaceAll('.', '');
      fracao = brasileiro[2] || '';
    } else if (decimal) {
      [, inteiro, fracao] = decimal;
    } else {
      throw new Error('Informe um valor em reais com até duas casas decimais.');
    }
    const valor = Number(inteiro + fracao.padEnd(2, '0'));
    if (!Number.isSafeInteger(valor)) throw new Error('O valor está acima do limite aceito.');
    return valor;
  }

  function idValido(id) {
    if (typeof id !== 'string' || !id.trim() || id !== id.trim()) {
      throw new Error('O registro precisa de um identificador válido.');
    }
    return id;
  }

  function dataValida(data, campo = 'data do pagamento') {
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      throw new Error('Informe a ' + campo + '.');
    }
    const dia = new Date(data + 'T12:00:00Z');
    if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) {
      throw new Error('A ' + campo + ' é inválida.');
    }
    return data;
  }

  function pagamentosDo(imovel) {
    if (imovel.pagamentos === undefined) return [];
    if (!Array.isArray(imovel.pagamentos)) throw new Error('O histórico de pagamentos é inválido.');
    return imovel.pagamentos;
  }

  function validarDadosPagamento(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Há um registro de pagamento inválido.');
    if (p.tipo !== undefined && p.tipo !== 'aquisicao') throw Error('A carteira de aquisição só aceita pagamentos da aquisição.');
    dataValida(p.data);
    inteiroPositivo(p.valorCentavos, 'O valor do pagamento');
    if (p.descricao !== undefined && typeof p.descricao !== 'string') throw new Error('A descrição do pagamento é inválida.');
  }

  function listaDo(imovel, chave) {
    if (imovel[chave] === undefined) return [];
    if (!Array.isArray(imovel[chave])) throw Error('Lista de ' + chave + ' inválida.');
    return imovel[chave];
  }

  const TIPOS_DESPESA = Object.freeze(['investimento', 'condominio', 'impostos']);

  function tipoDespesa(despesa) {
    if (despesa.tipo == null || despesa.tipo === 'avulsa') return 'avulsa';
    if (!TIPOS_DESPESA.includes(despesa.tipo)) throw Error('O tipo da despesa é inválido.');
    return despesa.tipo;
  }

  function validarPrevisao(item, despesa) {
    if (despesa) tipoDespesa(item);
    else if (item.tipo !== undefined && item.tipo !== 'aquisicao') throw Error('A parcela do plano deve ser de aquisição.');
    if (typeof item.descricao !== 'string' || !item.descricao.trim()) throw Error('Informe a descrição.');
    if (!despesa || item.valorCentavos != null) inteiroPositivo(item.valorCentavos, 'O valor');
    if (item.vencimento != null) dataValida(item.vencimento, 'data de vencimento');
    if (item.agendadoPara != null) {
      if (!despesa) throw Error('Informe a data agendada na despesa individual.');
      dataValida(item.agendadoPara, 'data agendada');
    }
    if (despesa && item.pagoEm != null) {
      dataValida(item.pagoEm);
      inteiroPositivo(item.valorCentavos, 'O valor da despesa paga');
    }
  }

  function itensPorId(imovel, chave) {
    const mapa = new Map();
    for (const item of listaDo(imovel, chave)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Registro inválido em ' + chave + '.');
      idValido(item.id);
      if (mapa.has(item.id)) throw Error('Identificador repetido em ' + chave + '.');
      validarPrevisao(item, chave === 'despesas');
      if (item.historico !== undefined) {
        if (!Array.isArray(item.historico)) throw Error('Histórico inválido em ' + chave + '.');
        for (const versao of item.historico) validarPrevisao(versao, chave === 'despesas');
      }
      mapa.set(item.id, item);
    }
    return mapa;
  }

  function pagamentoDaParcela(imovel, id) {
    return id ? pagamentosDo(imovel).find(p => p.parcelaId === id) : undefined;
  }

  function abertoNoPlano(imovel) {
    const parcelas = itensPorId(imovel, 'parcelas');
    const pagas = new Set();
    for (const p of pagamentosDo(imovel)) {
      if (p.parcelaId === undefined) continue;
      const parcela = parcelas.get(p.parcelaId);
      if (!parcela || pagas.has(p.parcelaId) || p.valorCentavos !== parcela.valorCentavos) {
        throw Error('Confira o vínculo e o valor do pagamento com a parcela prevista.');
      }
      pagas.add(p.parcelaId);
    }
    let aberto = 0;
    for (const parcela of parcelas.values()) if (!pagas.has(parcela.id)) aberto += parcela.valorCentavos;
    if (!Number.isSafeInteger(aberto)) throw Error('O total do plano ultrapassa o limite aceito.');
    return aberto;
  }

  function resumo(imovel) {
    if (!imovel || typeof imovel !== 'object' || Array.isArray(imovel)) throw new Error('O imóvel é inválido.');
    const ids = new Set();
    let pago = 0;
    for (const p of pagamentosDo(imovel)) {
      validarDadosPagamento(p);
      idValido(p.id);
      if (ids.has(p.id)) throw new Error('Há dois pagamentos com o mesmo identificador.');
      ids.add(p.id);
      if (p.historico !== undefined) {
        if (!Array.isArray(p.historico)) throw new Error('O histórico deste pagamento é inválido.');
        for (const revisao of p.historico) validarDadosPagamento(revisao);
      }
      pago += p.valorCentavos;
      if (!Number.isSafeInteger(pago)) throw new Error('O total pago está acima do limite aceito.');
    }
    const aberto = abertoNoPlano(imovel);
    itensPorId(imovel, 'despesas');
    const total = imovel.totalCentavos;
    if (total === null || total === undefined) {
      return { pago, saldo: null, percentual: null, status: 'A informar' };
    }
    inteiroPositivo(total, 'O valor de aquisição');
    if (pago > total) throw new Error('O total pago ultrapassa o valor de aquisição deste imóvel.');
    if (aberto > total - pago) throw Error('Os pagamentos e as parcelas abertas ultrapassam a aquisição. Confira os valores previstos.');
    return {
      pago,
      saldo: total - pago,
      percentual: (pago / total) * 100,
      status: pago === total ? 'Quitado' : 'Em pagamento'
    };
  }

  function validarCarteira(carteira) {
    if (!Array.isArray(carteira)) throw new Error('A lista de imóveis é inválida.');
    const ids = new Set();
    for (const imovel of carteira) {
      resumo(imovel);
      idValido(imovel.id);
      if (ids.has(imovel.id)) throw new Error('Há dois imóveis com o mesmo identificador.');
      ids.add(imovel.id);
      if (typeof imovel.nome !== 'string' || !imovel.nome.trim()) throw new Error('Informe o nome do imóvel.');
    }
    return carteira;
  }

  function salvarImovel(carteira, dados) {
    validarCarteira(carteira);
    idValido(dados.id);
    const anterior = carteira.find(i => i.id === dados.id);
    const nome = dados.nome === undefined ? anterior?.nome : dados.nome;
    if (typeof nome !== 'string' || !nome.trim()) throw new Error('Informe o nome do imóvel.');
    const total = dados.totalCentavos === undefined ? anterior?.totalCentavos ?? null : dados.totalCentavos;
    const imovel = { ...anterior, id: dados.id, nome: nome.trim(), totalCentavos: total, pagamentos: anterior?.pagamentos || [] };
    resumo(imovel);
    if (!anterior) return [...carteira, imovel];
    if (anterior.nome === imovel.nome && anterior.totalCentavos === total) return carteira;
    return carteira.map(i => i.id === imovel.id ? imovel : i);
  }

  function salvarPagamento(carteira, imovelId, dados) {
    validarCarteira(carteira);
    idValido(imovelId);
    idValido(dados.id);
    if (dados.tipo !== undefined && dados.tipo !== 'aquisicao') throw Error('Lance este valor como despesa do imóvel, fora da aquisição.');
    const imovel = carteira.find(i => i.id === imovelId);
    if (!imovel) throw new Error('O imóvel deste pagamento não foi encontrado.');
    const pagamentos = pagamentosDo(imovel);
    const anterior = pagamentos.find(p => p.id === dados.id);
    if (!anterior && (dados.id.startsWith('parcela:') || dados.parcelaId !== undefined)) {
      throw Error('Confirme o pagamento desta parcela pelo plano do imóvel.');
    }
    const data = dataValida(dados.data === undefined ? anterior?.data : dados.data);
    const valorCentavos = inteiroPositivo(dados.valorCentavos === undefined ? anterior?.valorCentavos : dados.valorCentavos, 'O valor do pagamento');
    const descricao = dados.descricao === undefined ? anterior?.descricao ?? '' : dados.descricao;
    if (typeof descricao !== 'string') throw new Error('A descrição do pagamento é inválida.');
    const pagamento = { ...anterior, id: dados.id, data, valorCentavos, descricao: descricao.trim() };
    if (anterior && anterior.data === data && anterior.valorCentavos === valorCentavos && (anterior.descricao ?? '') === pagamento.descricao) return carteira;
    if (anterior) {
      pagamento.historico = [...(anterior.historico || []), {
        alteradoEm: new Date().toISOString(),
        data: anterior.data,
        valorCentavos: anterior.valorCentavos,
        descricao: anterior.descricao || ''
      }];
    }
    const atualizados = anterior ? pagamentos.map(p => p.id === dados.id ? pagamento : p) : [...pagamentos, pagamento];
    const revisado = { ...imovel, pagamentos: atualizados };
    resumo(revisado);
    return carteira.map(i => i.id === imovelId ? revisado : i);
  }

  function imovelNaCarteira(carteira, id) {
    validarCarteira(carteira);
    const imovel = carteira.find(i => i.id === id);
    if (!imovel) throw Error('Imóvel não encontrado.');
    return imovel;
  }

  function substituir(carteira, imovel) {
    resumo(imovel);
    return carteira.map(i => i.id === imovel.id ? imovel : i);
  }

  function quantidadeSerie(n) {
    const quantidade = n === undefined ? 1 : n;
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 360) throw Error('Informe entre 1 e 360 meses.');
    return quantidade;
  }

  function idDaSerie(id, indice) {
    return indice === 0 ? id : id + ':' + (indice + 1);
  }

  function vencimentoDoMes(inicio, indice) {
    dataValida(inicio, 'data de vencimento');
    const [ano, mes, dia] = inicio.split('-').map(Number);
    const alvo = ano * 12 + mes - 1 + indice;
    const anoAlvo = Math.floor(alvo / 12), mesAlvo = alvo % 12 + 1;
    if (anoAlvo > 9999) throw Error('O vencimento ultrapassa o ano permitido.');
    const bissexto = anoAlvo % 4 === 0 && (anoAlvo % 100 !== 0 || anoAlvo % 400 === 0);
    const ultimo = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mesAlvo - 1];
    return String(anoAlvo).padStart(4, '0') + '-' + String(mesAlvo).padStart(2, '0') + '-' + String(Math.min(dia, ultimo)).padStart(2, '0');
  }

  function camposPrevistos(dados, anterior, despesa) {
    const descricao = dados.descricao === undefined ? anterior?.descricao : dados.descricao;
    const valor = dados.valorCentavos === undefined ? anterior?.valorCentavos ?? null : dados.valorCentavos;
    const vencimento = dados.vencimento === undefined ? anterior?.vencimento ?? null : dados.vencimento || null;
    const item = { descricao: typeof descricao === 'string' ? descricao.trim() : descricao, valorCentavos: valor, vencimento };
    if (despesa) {
      const tipo = dados.tipo === undefined ? anterior?.tipo : dados.tipo;
      if (!TIPOS_DESPESA.includes(tipo) && !(anterior && tipoDespesa(anterior) === 'avulsa' && (tipo == null || tipo === 'avulsa'))) {
        throw Error('Escolha investimento, condomínio ou impostos.');
      }
      if (tipo != null) item.tipo = tipo;
      const agendado = dados.agendadoPara === undefined ? anterior?.agendadoPara : dados.agendadoPara;
      if (agendado != null && agendado !== '') item.agendadoPara = agendado;
      else if (anterior && Object.hasOwn(anterior,'agendadoPara')) item.agendadoPara = null;
    } else {
      if (dados.tipo !== undefined && dados.tipo !== 'aquisicao') throw Error('O plano aceita somente parcelas da aquisição.');
      if (dados.agendadoPara != null && dados.agendadoPara !== '') throw Error('Informe a data agendada na despesa individual.');
    }
    validarPrevisao(item, despesa);
    return item;
  }

  function mesmaPrevisao(a, b) {
    return a && b && a.descricao === b.descricao && (a.valorCentavos ?? null) === (b.valorCentavos ?? null) &&
      (a.vencimento ?? null) === (b.vencimento ?? null) && (a.tipo ?? null) === (b.tipo ?? null) &&
      (a.agendadoPara ?? null) === (b.agendadoPara ?? null);
  }

  function adicionarSerie(carteira, imovel, chave, dados, inicio) {
    idValido(dados.id);
    const n = quantidadeSerie(dados.quantidade);
    const despesa = chave === 'despesas';
    if (n > 1 && !inicio) throw Error('Informe o primeiro vencimento para criar a série mensal.');
    if (n > 1 && dados.agendadoPara != null && dados.agendadoPara !== '') throw Error('Informe o agendamento em uma única despesa da série.');
    const linhas = Array.from({ length: n }, (_, indice) => {
      const vencimento = inicio ? vencimentoDoMes(inicio, indice) : null;
      return {
        id: idDaSerie(dados.id, indice),
        ...camposPrevistos({ ...dados, vencimento }, null, despesa),
        ...(despesa ? { pagoEm: null } : {}),
        ...(n > 1 ? { grupoId: dados.id, numero: indice + 1, quantidade: n } : {})
      };
    });
    const existentes = itensPorId(imovel, chave);
    if (linhas.some(x => existentes.has(x.id))) {
      const iguais = linhas.every(x => {
        const anterior = existentes.get(x.id);
        return mesmaPrevisao(anterior, x) && anterior.grupoId === x.grupoId && anterior.quantidade === x.quantidade;
      });
      if (iguais) return carteira;
      throw Error('Já existe um lançamento com este identificador. Confira a série salva.');
    }
    return substituir(carteira, { ...imovel, [chave]: [...existentes.values(), ...linhas] });
  }

  function gravarSerie(carteira, imovelId, dados) {
    const imovel = imovelNaCarteira(carteira, imovelId);
    return adicionarSerie(carteira, imovel, 'parcelas', dados, dados.primeiroVencimento);
  }

  function prazoPlano(imovel) {
    const r = resumo(imovel);
    const pendentes = listaDo(imovel,'parcelas').filter(p => !pagamentoDaParcela(imovel,p.id));
    const datas = pendentes.map(p => p.vencimento).filter(Boolean).sort();
    const previsto = pendentes.reduce((s,p) => s+p.valorCentavos,0);
    return { quantidade:pendentes.length, ultimoVencimento:datas.at(-1) || null,
      completo:r.saldo != null && previsto===r.saldo && datas.length===pendentes.length,
      quitadoEm:r.saldo===0 ? pagamentosDo(imovel).map(p=>p.data).sort().at(-1) : null };
  }

  function simularParcelamento(imovel,dados) {
    const saldo = resumo(imovel).saldo;
    if (saldo == null) throw Error('Informe o valor de aquisição para distribuir o saldo.');
    if (saldo === 0) throw Error('Este imóvel já está quitado.');
    idValido(dados.id);
    const n = quantidadeSerie(dados.quantidade);
    const intervalo = dados.intervaloMeses;
    if (![1,2,3,6,12].includes(intervalo)) throw Error('Escolha o intervalo entre as parcelas.');
    dataValida(dados.primeiroVencimento,'data do primeiro vencimento');
    if (saldo < n) throw Error('Cada parcela precisa ter pelo menos um centavo.');
    const valor = Math.floor(saldo/n), resto = saldo % n;
    const parcelas = Array.from({length:n},(_,indice)=>({
      id:idDaSerie(dados.id,indice),grupoId:dados.id,numero:indice+1,quantidade:n,
      descricao:`Parcela ${indice+1} de ${n}`,valorCentavos:valor+(indice<resto?1:0),
      vencimento:vencimentoDoMes(dados.primeiroVencimento,indice*intervalo)
    }));
    return {saldoCentavos:saldo,parcelas,ultimoVencimento:parcelas.at(-1).vencimento};
  }

  function reparcelar(carteira,imovelId,dados) {
    const imovel = imovelNaCarteira(carteira,imovelId);
    const anteriores = imovel.reparcelamentos || [];
    const existente = anteriores.find(p=>p.id===dados.id);
    if (existente) {
      if (existente.quantidade===dados.quantidade && existente.intervaloMeses===dados.intervaloMeses && existente.primeiroVencimento===dados.primeiroVencimento) return carteira;
      throw Error('Já existe um ajuste com este identificador.');
    }
    const previa = simularParcelamento(imovel,dados);
    const usados = new Set([...listaDo(imovel,'parcelas'),...anteriores.flatMap(p=>p.parcelasAnteriores)].map(p=>p.id));
    if (previa.parcelas.some(p=>usados.has(p.id))) throw Error('O identificador de uma parcela já está em uso.');
    const pagas = listaDo(imovel,'parcelas').filter(p=>pagamentoDaParcela(imovel,p.id));
    const registro = {id:dados.id,quantidade:dados.quantidade,intervaloMeses:dados.intervaloMeses,
      primeiroVencimento:dados.primeiroVencimento,saldoCentavos:previa.saldoCentavos,criadoEm:new Date().toISOString(),
      parcelasAnteriores:listaDo(imovel,'parcelas').filter(p=>!pagamentoDaParcela(imovel,p.id))};
    return substituir(carteira,{...imovel,parcelas:[...pagas,...previa.parcelas],reparcelamentos:[...anteriores,registro]});
  }

  function editarPrevisao(carteira, imovel, chave, anterior, dados) {
    const campos = camposPrevistos(dados, anterior, chave === 'despesas');
    if (mesmaPrevisao(anterior, campos)) return carteira;
    if (chave === 'despesas' ? anterior.pagoEm : pagamentoDaParcela(imovel, anterior.id)) {
      throw Error('Este lançamento já foi pago. Seus dados de quitação estão preservados.');
    }
    const historico = [...(anterior.historico || []), {
      alteradoEm: new Date().toISOString(),
      descricao: anterior.descricao,
      valorCentavos: anterior.valorCentavos ?? null,
      vencimento: anterior.vencimento ?? null,
      ...(Object.hasOwn(anterior,'agendadoPara') ? { agendadoPara: anterior.agendadoPara } : {}),
      ...(anterior.tipo != null ? { tipo: anterior.tipo } : {})
    }];
    const item = { ...anterior, ...campos, historico };
    return substituir(carteira, { ...imovel, [chave]: imovel[chave].map(x => x.id === item.id ? item : x) });
  }

  function editarParcela(carteira, imovelId, dados) {
    const imovel = imovelNaCarteira(carteira, imovelId);
    const anterior = itensPorId(imovel, 'parcelas').get(dados.id);
    if (!anterior) throw Error('A parcela prevista não foi encontrada.');
    return editarPrevisao(carteira, imovel, 'parcelas', anterior, dados);
  }

  function pagarParcela(carteira, imovelId, parcelaId, data) {
    const imovel = imovelNaCarteira(carteira, imovelId);
    const parcela = itensPorId(imovel, 'parcelas').get(parcelaId);
    if (!parcela) throw Error('A parcela prevista não foi encontrada.');
    if (pagamentoDaParcela(imovel, parcelaId)) return carteira;
    const pagamento = { id: 'parcela:' + parcelaId, parcelaId, data: dataValida(data), valorCentavos: parcela.valorCentavos, descricao: parcela.descricao };
    const pagamentos = pagamentosDo(imovel);
    if (pagamentos.some(p => p.id === pagamento.id)) throw Error('Há outro pagamento com o identificador desta parcela.');
    return substituir(carteira, { ...imovel, pagamentos: [...pagamentos, pagamento] });
  }

  function gravarDespesa(carteira, imovelId, dados) {
    const imovel = imovelNaCarteira(carteira, imovelId);
    const anterior = itensPorId(imovel, 'despesas').get(dados.id);
    if (!anterior || quantidadeSerie(dados.quantidade) > 1) return adicionarSerie(carteira, imovel, 'despesas', dados, dados.vencimento);
    return editarPrevisao(carteira, imovel, 'despesas', anterior, dados);
  }

  function pagarDespesa(carteira, imovelId, despesaId, data) {
    const imovel = imovelNaCarteira(carteira, imovelId);
    const despesas = listaDo(imovel, 'despesas');
    const despesa = despesas.find(x => x.id === despesaId);
    if (!despesa) throw Error('A despesa não foi encontrada.');
    if (despesa.pagoEm) return carteira;
    if (despesa.valorCentavos == null) throw Error('Informe o valor da despesa antes de confirmar o pagamento.');
    const paga = { ...despesa, pagoEm: dataValida(data) };
    return substituir(carteira, { ...imovel, despesas: despesas.map(x => x.id === despesaId ? paga : x) });
  }

  function resumoDespesas(imovel) {
    const novo = () => ({ pago: 0, aberto: 0, aInformar: 0, quantidade: 0 });
    const resultado = Object.fromEntries([...TIPOS_DESPESA, 'avulsa', 'total'].map(tipo => [tipo, novo()]));
    const despesas = itensPorId(imovel, 'despesas');
    for (const d of despesas.values()) {
      for (const grupo of [resultado[tipoDespesa(d)], resultado.total]) {
        grupo.quantidade++;
        if (d.valorCentavos == null) grupo.aInformar++;
        else {
          const chave = d.pagoEm ? 'pago' : 'aberto';
          grupo[chave] += d.valorCentavos;
          if (!Number.isSafeInteger(grupo[chave])) throw Error('O total de despesas ultrapassa o limite aceito.');
        }
      }
    }
    return resultado;
  }

  globalThis.HoldingModelo = Object.freeze({
    centavos, resumo, validarCarteira, salvarImovel, salvarPagamento,
    gravarSerie, simularParcelamento, reparcelar, prazoPlano, vencimentoDoMes, editarParcela, pagarParcela, gravarDespesa, pagarDespesa, pagamentoDaParcela, idDaSerie, tipoDespesa, TIPOS_DESPESA, resumoDespesas
  });
})();
