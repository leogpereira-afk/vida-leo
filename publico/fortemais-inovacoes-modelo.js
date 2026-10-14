(function (root) {
  'use strict';

  const SITUACOES = Object.freeze(['Para avaliar', 'Aplicar nas próximas obras', 'Adotada', 'Arquivada']);
  const LIMITES = Object.freeze({ titulo: 160, descricao: 6000, aplicacao: 3000, etapa: 80, referencia: 2000 });
  const CAMPOS = Object.keys(LIMITES).concat('situacao');
  const ROTULOS = { titulo: 'título', descricao: 'descrição', aplicacao: 'aplicação', etapa: 'etapa', referencia: 'referência', situacao: 'situação' };
  const AUDITORIA = ['id', 'criadoEm', 'criadoPor', 'atualizadoEm', 'atualizadoPor', 'historico'];
  const tem = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const objeto = value => !!value && Object.prototype.toString.call(value) === '[object Object]';
  const chave = value => String(value == null ? '' : value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

  function igual(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const aKeys = Object.keys(a).sort(), bKeys = Object.keys(b).sort();
    return aKeys.length === bKeys.length && aKeys.every((key, index) => key === bKeys[index] && igual(a[key], b[key]));
  }

  function textoValido(value, maximo, obrigatorio) {
    return typeof value === 'string' && value.length <= maximo && (!obrigatorio || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
  }

  function dataValida(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || value.startsWith('0000-')) return false;
    const data = new Date(value);
    return Number.isFinite(data.getTime()) && data.toISOString() === value;
  }

  function referencia(value) {
    if (!value) return '';
    let url;
    try { url = new URL(value); } catch (_) { /* Validated below. */ }
    const autoridade = value.match(/^https?:\/\/([^/?#]+)/i);
    if (!url || !autoridade || !['http:', 'https:'].includes(url.protocol) || !url.hostname
      || url.username || url.password || autoridade[1].includes('@') || /[\u0000-\u0020\u007f\\]/.test(value)) {
      throw new Error('Use uma referência completa iniciada por https:// ou http://, sem usuário ou senha no endereço.');
    }
    if (url.href.length > LIMITES.referencia) throw new Error('A referência deve ter no máximo 2000 caracteres.');
    return url.href;
  }

  function estrutura(value, permitidos, mensagem) {
    if (!objeto(value) || Object.keys(value).some(key => !permitidos.includes(key))) throw new Error(mensagem);
  }

  function validar(lista) {
    if (lista === undefined) return true;
    if (!Array.isArray(lista)) throw new Error('O cadastro de inovações deve ser uma lista.');
    const usados = new Set();
    function idUnico(id) {
      if (!textoValido(id, 160, true) || id !== id.trim() || usados.has(id)) throw new Error('Cada inovação e evento precisa ter um identificador único válido.');
      usados.add(id);
    }
    for (const item of lista) {
      estrutura(item, CAMPOS.concat(AUDITORIA), 'Um cadastro de inovação tem campos inválidos.');
      if (['titulo', 'situacao'].concat(AUDITORIA).some(campo => !tem(item, campo))) throw new Error('Um cadastro de inovação está incompleto.');
      idUnico(item.id);
      for (const campo of Object.keys(LIMITES)) {
        if (!tem(item, campo) && campo !== 'titulo') continue;
        if (!textoValido(item[campo], LIMITES[campo], campo === 'titulo')) throw new Error('Confira o campo ' + ROTULOS[campo] + ' da inovação.');
      }
      if (!SITUACOES.includes(item.situacao)) throw new Error('Uma inovação tem uma situação inválida.');
      referencia(item.referencia || '');
      if (!dataValida(item.criadoEm) || !dataValida(item.atualizadoEm) || item.atualizadoEm < item.criadoEm
        || !textoValido(item.criadoPor, 160, true) || !textoValido(item.atualizadoPor, 160, true)) {
        throw new Error('Confira as datas e a autoria da inovação.');
      }
      if (!Array.isArray(item.historico) || !item.historico.length) throw new Error('O histórico da inovação está inválido.');
      let anterior = item.criadoEm;
      for (const [indice, evento] of item.historico.entries()) {
        estrutura(evento, ['id', 'em', 'autor', 'tipo', 'texto', 'campos', 'de', 'para'], 'Um evento do histórico da inovação está inválido.');
        if (['id', 'em', 'autor', 'tipo', 'texto'].some(campo => !tem(evento, campo))) throw new Error('Um evento do histórico da inovação está incompleto.');
        idUnico(evento.id);
        if (!dataValida(evento.em) || evento.em < anterior || evento.em > item.atualizadoEm
          || !textoValido(evento.autor, 160, true) || !textoValido(evento.texto, 1000, true)
          || !['criacao', 'edicao', 'situacao'].includes(evento.tipo)) throw new Error('Confira as informações do histórico da inovação.');
        if ((indice === 0 && (evento.tipo !== 'criacao' || evento.em !== item.criadoEm || evento.autor !== item.criadoPor))
          || (indice > 0 && evento.tipo === 'criacao')) throw new Error('O histórico deve preservar a criação da inovação.');
        if (tem(evento, 'campos') && (!Array.isArray(evento.campos) || !evento.campos.length
          || new Set(evento.campos).size !== evento.campos.length || Array.from(evento.campos).some(campo => !CAMPOS.includes(campo)))) {
          throw new Error('Os campos alterados no histórico da inovação estão inválidos.');
        }
        if (evento.tipo === 'situacao') {
          if (!SITUACOES.includes(evento.de) || !SITUACOES.includes(evento.para) || evento.de === evento.para) throw new Error('A mudança de situação no histórico está inválida.');
        } else if (tem(evento, 'de') || tem(evento, 'para')) throw new Error('A mudança de situação no histórico está inválida.');
        anterior = evento.em;
      }
      const ultimo = item.historico[item.historico.length - 1];
      if (ultimo.em !== item.atualizadoEm || ultimo.autor !== item.atualizadoPor) throw new Error('A última atualização não corresponde ao histórico da inovação.');
    }
    return true;
  }

  function contexto(lista, entrada) {
    if (!entrada || typeof entrada.uid !== 'function' || typeof entrada.now !== 'string'
      || !Number.isFinite(Date.parse(entrada.now)) || !textoValido(entrada.autor, 160, true)) {
      throw new Error('Não foi possível identificar a data e o autor desta alteração. Atualize a página e tente novamente.');
    }
    const now = new Date(entrada.now).toISOString();
    if (!dataValida(now)) throw new Error('Informe uma data válida para esta alteração.');
    const usados = new Set();
    lista.forEach(item => { usados.add(item.id); item.historico.forEach(evento => usados.add(evento.id)); });
    return {
      now, autor: entrada.autor.trim(),
      uid() {
        for (let tentativa = 0; tentativa < 32; tentativa += 1) {
          const valor = entrada.uid();
          if (textoValido(valor, 160, true)) {
            const id = valor.trim();
            if (!usados.has(id)) { usados.add(id); return id; }
          }
        }
        throw new Error('Não foi possível criar um identificador único. Tente novamente.');
      }
    };
  }

  function salvar(lista, valores, id, entrada) {
    validar(lista);
    const itens = lista || [];
    if (valores === undefined) valores = {};
    if (!objeto(valores)) throw new Error('Informe os dados da inovação.');
    const novo = id == null || id === '';
    const indice = novo ? -1 : itens.findIndex(item => item.id === id);
    if (!novo && indice < 0) throw new Error('Esta inovação não foi encontrada. Reabra a lista antes de editar.');
    const anterior = novo ? null : itens[indice];
    if (anterior && entrada && entrada.base != null && !igual(anterior, entrada.base)) {
      throw new Error('Esta inovação mudou enquanto o formulário estava aberto. Reabra o cadastro para conferir a versão atual.');
    }
    const ctx = contexto(itens, entrada);
    if (anterior && ctx.now < anterior.atualizadoEm) throw new Error('A data desta alteração é anterior à última atualização. Confira o relógio e reabra o cadastro.');
    const item = anterior ? { ...anterior } : {};
    for (const campo of Object.keys(LIMITES)) {
      const valor = tem(valores, campo) ? valores[campo] : (anterior && anterior[campo]);
      if (valor != null && typeof valor !== 'string') throw new Error('Informe um texto válido para ' + ROTULOS[campo] + '.');
      item[campo] = valor == null ? '' : valor.trim();
      if (!textoValido(item[campo], LIMITES[campo], campo === 'titulo')) {
        throw new Error(campo === 'titulo' && !item.titulo ? 'Informe o título da inovação.' : 'O campo ' + ROTULOS[campo] + ' deve ter no máximo ' + LIMITES[campo] + ' caracteres válidos.');
      }
    }
    item.referencia = referencia(item.referencia);
    const situacao = tem(valores, 'situacao') ? valores.situacao : (anterior && anterior.situacao);
    if (situacao != null && typeof situacao !== 'string') throw new Error('Escolha uma situação válida para a inovação.');
    item.situacao = situacao == null || situacao.trim() === '' ? 'Para avaliar' : situacao.trim();
    if (!SITUACOES.includes(item.situacao)) throw new Error('Escolha uma situação válida para a inovação.');
    const alterados = CAMPOS.filter(campo => (anterior && anterior[campo] || '') !== item[campo]);
    if (anterior && !alterados.length) return lista;
    const mudouSituacao = anterior && anterior.situacao !== item.situacao;
    const evento = {
      id: ctx.uid(), em: ctx.now, autor: ctx.autor,
      tipo: !anterior ? 'criacao' : mudouSituacao ? 'situacao' : 'edicao',
      texto: !anterior ? 'Inovação cadastrada.' : 'Campos atualizados: ' + alterados.map(campo => ROTULOS[campo]).join(', ') + '.'
    };
    if (anterior) evento.campos = alterados;
    if (mudouSituacao) { evento.de = anterior.situacao; evento.para = item.situacao; }
    if (!anterior) {
      item.id = ctx.uid();
      item.criadoEm = ctx.now;
      item.criadoPor = ctx.autor;
    }
    item.atualizadoEm = ctx.now;
    item.atualizadoPor = ctx.autor;
    item.historico = (anterior ? anterior.historico : []).concat(evento);
    const resultado = itens.slice();
    if (anterior) resultado[indice] = item;
    else resultado.push(item);
    validar(resultado);
    return resultado;
  }

  function filtrar(lista, filtros) {
    validar(lista);
    filtros = filtros || {};
    const busca = chave(filtros.texto), situacao = chave(filtros.situacao), etapa = chave(filtros.etapa);
    const semFiltro = valor => !valor || valor === 'todas' || valor === 'todos';
    return (lista || []).filter(item => {
      if (!semFiltro(situacao) && chave(item.situacao) !== situacao) return false;
      if (!semFiltro(etapa) && (etapa === 'sem-etapa' ? !!chave(item.etapa) : chave(item.etapa) !== etapa)) return false;
      return !busca || chave(CAMPOS.map(campo => item[campo]).filter(Boolean).join(' ')).includes(busca);
    }).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm) || a.id.localeCompare(b.id));
  }

  function resumo(lista) {
    validar(lista);
    return (lista || []).reduce((total, item) => {
      total.total += 1;
      if (item.situacao === 'Aplicar nas próximas obras') total.aAplicar += 1;
      if (item.situacao === 'Para avaliar') total.avaliar += 1;
      if (item.situacao === 'Adotada') total.adotadas += 1;
      if (item.situacao === 'Arquivada') total.arquivadas += 1;
      return total;
    }, { total: 0, aAplicar: 0, avaliar: 0, adotadas: 0, arquivadas: 0 });
  }

  const api = Object.freeze({ validar, salvar, filtrar, resumo, SITUACOES, LIMITES });
  root.FortemaisInovacoesModelo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
