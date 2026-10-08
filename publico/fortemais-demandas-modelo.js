(function (root) {
  'use strict';

  const SITUACOES = Object.freeze(['A fazer', 'Em andamento', 'Aguardando terceiro', 'Bloqueada', 'Resolvida']);
  const PRIORIDADES = Object.freeze(['baixa', 'normal', 'alta']);
  const TEXTOS = ['titulo', 'descricao', 'etapaId', 'responsavel', 'envolvidos', 'proximaAcao', 'motivoBloqueio', 'aguardandoQuem', 'retornoPendente'];
  const ROTULOS = {
    titulo: 'título', descricao: 'descrição', etapaId: 'etapa', responsavel: 'responsável',
    envolvidos: 'pessoas envolvidas', prazo: 'prazo', prioridade: 'prioridade',
    proximaAcao: 'próxima ação', motivoBloqueio: 'motivo do bloqueio',
    aguardandoQuem: 'terceiro aguardado', retornoPendente: 'retorno pendente',
    checklist: 'lista de verificação', links: 'arquivos e links'
  };

  const texto = value => value == null ? '' : String(value).trim();
  const chave = value => texto(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const tem = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const etapasDe = data => Array.isArray(data && data.etapas) ? data.etapas : [];
  const itensDe = data => Array.isArray(data && data.itens) ? data.itens : [];

  function dados(obra) {
    return obra && obra.fmDemandas && typeof obra.fmDemandas === 'object'
      ? obra.fmDemandas : { etapas: [], itens: [] };
  }

  function dataValida(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function contexto(data, ctx) {
    if (!ctx || typeof ctx.uid !== 'function' || !Number.isFinite(Date.parse(ctx.now))) {
      throw new Error('Não foi possível identificar a data e o autor desta alteração. Atualize a página e tente novamente.');
    }
    const usados = new Set();
    const reservar = id => { if (id != null) usados.add(String(id)); };
    etapasDe(data).forEach(etapa => reservar(etapa.id));
    itensDe(data).forEach(item => {
      reservar(item.id);
      ['checklist', 'links', 'historico'].forEach(campo => {
        (Array.isArray(item[campo]) ? item[campo] : []).forEach(row => reservar(row.id));
      });
    });
    return {
      now: new Date(ctx.now).toISOString(), autor: texto(ctx.autor) || 'Usuário', usados,
      uid() {
        for (let tentativa = 0; tentativa < 32; tentativa += 1) {
          const id = texto(ctx.uid());
          if (id && !usados.has(id)) { usados.add(id); return id; }
        }
        throw new Error('Não foi possível criar um identificador único. Tente novamente.');
      }
    };
  }

  function evento(ctx, tipo, mensagem, extra) {
    return { id: ctx.uid(), em: ctx.now, autor: ctx.autor, tipo, texto: mensagem, ...(extra || {}) };
  }

  function lista(input, anterior, campo, ctx) {
    if (!Array.isArray(input)) throw new Error(campo === 'links' ? 'Informe uma lista válida de arquivos e links.' : 'Informe uma lista válida de verificação.');
    const ids = new Set();
    const anteriores = new Set((Array.isArray(anterior) ? anterior : []).map(row => texto(row.id)));
    const result = [];
    input.forEach(row => {
      if (!row || typeof row !== 'object') throw new Error('Um dos itens da lista está inválido.');
      let value;
      if (campo === 'checklist') {
        const conteudo = texto(row.texto);
        if (!conteudo && !row.id) return;
        if (!conteudo) throw new Error('Preencha o texto de cada item da lista de verificação.');
        value = { texto: conteudo, feito: row.feito === true };
      } else {
        const url = texto(row.url);
        const nome = texto(row.nome);
        if (!url && !nome && !row.id) return;
        let parsed;
        try { parsed = new URL(url); } catch (_) { /* Validated below. */ }
        if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || /[\u0000-\u0020\u007f]/.test(url)) {
          throw new Error('Use um endereço completo de arquivo ou link iniciado por https:// ou http://.');
        }
        value = { nome: nome || url, url };
      }
      const id = texto(row.id) || ctx.uid();
      if (ids.has(id)) throw new Error('Cada item da lista precisa ter um identificador diferente.');
      if (row.id && ctx.usados.has(id) && !anteriores.has(id)) throw new Error('Um item da lista pertence a outro registro. Recrie esse item.');
      ids.add(id);
      ctx.usados.add(id);
      result.push({ id, ...value });
    });
    return result;
  }

  function salvarDemanda(data, input, id, ctxInput) {
    input = input || {};
    const itens = itensDe(data);
    const etapas = etapasDe(data);
    const indice = id == null || id === '' ? -1 : itens.findIndex(item => item.id === id);
    if (id != null && id !== '' && indice < 0) throw new Error('Esta demanda não foi encontrada nesta obra.');
    const anterior = indice < 0 ? null : itens[indice];
    const ctx = contexto(data, ctxInput);
    const base = anterior || {};
    const item = { ...base };
    TEXTOS.forEach(campo => { item[campo] = texto(tem(input, campo) ? input[campo] : base[campo]); });
    if (!item.titulo) throw new Error('Informe o título da demanda.');
    if (item.etapaId && !etapas.some(etapa => etapa.id === item.etapaId)) throw new Error('Escolha uma etapa que pertença a esta obra.');
    item.prazo = texto(tem(input, 'prazo') ? input.prazo : base.prazo);
    if (item.prazo && !dataValida(item.prazo)) throw new Error('Informe um prazo válido no formato ano-mês-dia.');
    item.situacao = texto(tem(input, 'situacao') ? input.situacao : base.situacao) || 'A fazer';
    if (!SITUACOES.includes(item.situacao)) throw new Error('Escolha uma situação válida para a demanda.');
    item.prioridade = texto(tem(input, 'prioridade') ? input.prioridade : base.prioridade) || 'normal';
    if (!PRIORIDADES.includes(item.prioridade)) throw new Error('Escolha uma prioridade válida para a demanda.');
    ['checklist', 'links'].forEach(campo => {
      item[campo] = lista(tem(input, campo) ? input[campo] : (base[campo] || []), base[campo], campo, ctx);
    });
    const observacao = texto(input.observacao);
    // History is append-only; imported form fields cannot replace it or its timestamps.
    delete item.observacao;
    const historico = Array.isArray(base.historico) ? base.historico.slice() : [];
    if (!anterior) {
      item.id = ctx.uid();
      item.criadoEm = ctx.now;
      item.concluidoEm = item.situacao === 'Resolvida' ? ctx.now : null;
      historico.push(evento(ctx, 'criacao', 'Demanda criada' + (item.situacao === 'A fazer' ? '.' : ' com situação ' + item.situacao + '.')));
    } else {
      const alterados = Object.keys(ROTULOS).filter(campo => !igual(base[campo], item[campo]));
      const mudouSituacao = base.situacao !== item.situacao;
      if (!alterados.length && !mudouSituacao && !observacao) return data;
      if (alterados.length) historico.push(evento(ctx, 'edicao', 'Campos atualizados: ' + alterados.map(campo => ROTULOS[campo]).join(', ') + '.'));
      if (mudouSituacao) {
        const mensagem = item.situacao === 'Resolvida' ? 'Demanda resolvida.'
          : base.situacao === 'Resolvida' ? 'Demanda reaberta: ' + item.situacao + '.'
            : 'Situação alterada de ' + base.situacao + ' para ' + item.situacao + '.';
        historico.push(evento(ctx, 'situacao', mensagem, { de: base.situacao, para: item.situacao }));
        item.concluidoEm = item.situacao === 'Resolvida' ? ctx.now : null;
      }
    }
    if (observacao) historico.push(evento(ctx, 'observacao', observacao));
    item.historico = historico;
    item.atualizadoEm = ctx.now;
    const novosItens = itens.slice();
    if (anterior) novosItens[indice] = item;
    else novosItens.push(item);
    return { ...(data || {}), etapas, itens: novosItens };
  }

  function situacao(data, id, status, ctx) {
    if (id == null || id === '') throw new Error('Escolha uma demanda para alterar a situação.');
    return salvarDemanda(data, { situacao: status }, id, ctx);
  }

  function salvarEtapas(data, entrada, ctxInput) {
    if (!Array.isArray(entrada)) throw new Error('Informe uma lista válida de etapas.');
    const ctx = contexto(data, ctxInput);
    const anteriores = etapasDe(data);
    const idsAnteriores = new Set(anteriores.map(etapa => etapa.id));
    const ids = new Set();
    const nomes = new Set();
    const etapas = entrada.map(etapa => {
      if (!etapa || typeof etapa !== 'object' || !texto(etapa.nome)) throw new Error('Informe o nome de cada etapa.');
      const id = texto(etapa.id) || ctx.uid();
      const nome = texto(etapa.nome);
      if (ids.has(id)) throw new Error('Cada etapa precisa ter um identificador diferente.');
      if (etapa.id && ctx.usados.has(id) && !idsAnteriores.has(id)) throw new Error('Uma das etapas usa o identificador de outro registro.');
      if (nomes.has(chave(nome))) throw new Error('Use nomes diferentes para as etapas desta obra.');
      ids.add(id);
      nomes.add(chave(nome));
      ctx.usados.add(id);
      return { id, nome };
    });
    if (igual(anteriores, etapas)) return data;
    const itens = itensDe(data).map(item => {
      if (!item.etapaId || ids.has(item.etapaId)) return item;
      const removida = anteriores.find(etapa => etapa.id === item.etapaId);
      return {
        ...item, etapaId: '', atualizadoEm: ctx.now,
        historico: [...(Array.isArray(item.historico) ? item.historico : []), evento(ctx, 'edicao', 'Etapa removida' + (removida ? ': ' + removida.nome : '') + '. Demanda mantida sem etapa.')]
      };
    });
    return { ...(data || {}), etapas, itens };
  }

  function atrasada(item, hoje) {
    return !!item && item.situacao !== 'Resolvida' && dataValida(item.prazo) && dataValida(hoje) && item.prazo < hoje;
  }

  function resumo(data, hoje) {
    return itensDe(data).reduce((total, item) => {
      if (item.situacao === 'Resolvida') total.resolvidas += 1;
      else {
        total.abertas += 1;
        if (atrasada(item, hoje)) total.atrasadas += 1;
        if (item.situacao === 'Bloqueada') total.bloqueadas += 1;
      }
      return total;
    }, { abertas: 0, atrasadas: 0, bloqueadas: 0, resolvidas: 0 });
  }

  function filtrar(data, filtros, hoje) {
    filtros = filtros || {};
    const busca = chave(filtros.texto);
    const etapa = texto(filtros.etapa);
    const responsavel = chave(filtros.responsavel);
    const status = texto(filtros.situacao);
    const grupo = texto(filtros.resumo);
    const peso = { alta: 0, normal: 1, baixa: 2 };
    const etapas = etapasDe(data);
    return itensDe(data).filter(item => {
      const resolvida = item.situacao === 'Resolvida';
      if (grupo === 'abertas' && resolvida) return false;
      if (grupo === 'resolvidas' && !resolvida) return false;
      if (grupo === 'atrasadas' && !atrasada(item, hoje)) return false;
      if (grupo === 'bloqueadas' && item.situacao !== 'Bloqueada') return false;
      if (status && status !== 'todas' && status !== 'todos' && item.situacao !== status) return false;
      if (etapa && etapa !== 'todas' && etapa !== 'todos' && (etapa === 'sem-etapa' ? !!item.etapaId : item.etapaId !== etapa)) return false;
      if (responsavel && responsavel !== 'todos' && responsavel !== 'todas' && (responsavel === 'sem-responsavel' ? !!texto(item.responsavel) : chave(item.responsavel) !== responsavel)) return false;
      if (busca) {
        const nomeEtapa = etapas.find(value => value.id === item.etapaId);
        const campos = TEXTOS.map(campo => item[campo]);
        campos.push(nomeEtapa && nomeEtapa.nome, item.situacao, item.prioridade, item.prazo);
        (item.checklist || []).forEach(value => campos.push(value.texto));
        (item.links || []).forEach(value => campos.push(value.nome, value.url));
        (item.historico || []).forEach(value => { if (value.tipo === 'observacao') campos.push(value.texto); });
        if (!chave(campos.filter(Boolean).join(' ')).includes(busca)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aResolvida = a.situacao === 'Resolvida';
      const bResolvida = b.situacao === 'Resolvida';
      if (aResolvida !== bResolvida) return aResolvida ? 1 : -1;
      if (aResolvida) {
        return texto(b.concluidoEm || b.atualizadoEm).localeCompare(texto(a.concluidoEm || a.atualizadoEm))
          || texto(a.id).localeCompare(texto(b.id));
      }
      const atraso = Number(atrasada(b, hoje)) - Number(atrasada(a, hoje));
      const prioridade = (peso[a.prioridade] ?? 1) - (peso[b.prioridade] ?? 1);
      return atraso || prioridade || (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31')
        || texto(a.criadoEm).localeCompare(texto(b.criadoEm)) || texto(a.id).localeCompare(texto(b.id));
    });
  }

  const api = Object.freeze({ dados, salvarDemanda, situacao, salvarEtapas, atrasada, resumo, filtrar, SITUACOES, PRIORIDADES });
  root.FortemaisDemandasModelo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
