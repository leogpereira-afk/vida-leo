/* Organogramas pessoais. Dados e vínculos ficam no estado privado da Central. */
(function (global) {
  'use strict';
  const tipos = ['Empresa', 'Holding', 'Pessoa', 'Área', 'Contabilidade', 'Outro'];
  const texto = v => String(v ?? '').trim();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = v => JSON.parse(JSON.stringify(v));
  const id = () => 'org-' + (global.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  const registro = v => v && typeof v === 'object' && !Array.isArray(v);
  function validar(lista) {
    if (!Array.isArray(lista)) throw Error('A lista de organogramas precisa ser uma lista.');
    if(lista.length>50)throw Error('Use até 50 organogramas por arquivo.');
    const ids = new Set();
    for (const o of lista) {
      if (!registro(o) || !texto(o.id) || ids.has(o.id)) throw Error('Cada organograma precisa de um identificador único.');
      ids.add(o.id);
      if (!texto(o.titulo)) throw Error('Informe o título do organograma.');
      for (const chave of ['id','titulo','subtitulo','observacoes','atualizadoEm','tema']) if (o[chave] != null && typeof o[chave] !== 'string') throw Error('Texto inválido no organograma: ' + chave + '.');
      if (o.tema && !['claro','escuro'].includes(o.tema)) throw Error('Escolha um tema válido.');
      if (!Array.isArray(o.nos)) throw Error('Os itens do organograma precisam ser uma lista.');
      if(o.nos.length>200)throw Error('Cada organograma pode ter até 200 itens. Divida estruturas maiores.');
      const mapa = new Map();
      for (const n of o.nos) {
        if (!registro(n) || !texto(n.id) || mapa.has(n.id)) throw Error('Cada item precisa de um identificador único.');
        for (const chave of ['id','tipo','empresaId','nome','parentId','atividade','socios','relacao','observacoes','cnpj','regime','banco','contabilidade','logo','logoFundo']) if (n[chave] != null && typeof n[chave] !== 'string') throw Error('Texto inválido no item: ' + chave + '.');
        if (n.logoFundo && !/^#[a-f\d]{6}$/i.test(n.logoFundo)) throw Error('A cor de fundo da logo precisa ser hexadecimal.');
        if (n.logo && !logoSegura(n.logo)) throw Error('A logo precisa ser PNG, JPEG, WebP ou um link HTTPS válido.');
        if (!texto(n.nome) && !texto(n.empresaId)) throw Error('Informe o nome do item ou vincule uma empresa.');
        if (n.tipo && !tipos.includes(n.tipo)) throw Error('Escolha um tipo válido para o item.');
        if (n.percentual !== '' && n.percentual != null && (typeof n.percentual !== 'number' || !Number.isFinite(n.percentual) || n.percentual < 0 || n.percentual > 100)) throw Error('O percentual precisa estar entre 0 e 100.');
        if (n.ordem != null && (!Number.isFinite(n.ordem) || typeof n.ordem !== 'number')) throw Error('A ordem do item precisa ser numérica.');
        mapa.set(n.id, n);
      }
      for (const n of o.nos) {
        const vistos = new Set([n.id]);
        let proximo = n.parentId;
        while (proximo) {
          if (!mapa.has(proximo)) throw Error('A ligação de “' + (n.nome || n.id) + '” aponta para um item que não existe.');
          if (vistos.has(proximo)) throw Error('Essa ligação criaria um ciclo. Escolha outro item superior.');
          vistos.add(proximo); if(vistos.size>20)throw Error('Use até 20 níveis por organograma.'); proximo = mapa.get(proximo).parentId;
        }
      }
    }
    return lista;
  }
  function salvarNo(o, dados) {
    const novo = clone(o), n = {...clone(dados), id: dados.id || id()};
    const ix = novo.nos.findIndex(x => x.id === n.id);
    if (ix < 0) novo.nos.push(n); else novo.nos[ix] = n;
    validar([novo]); novo.atualizadoEm = new Date().toISOString();
    return novo;
  }
  function removerNo(o, noId) {
    const novo = clone(o), n = novo.nos.find(x => x.id === noId);
    if (!n) throw Error('Item não encontrado.');
    novo.nos = novo.nos.filter(x => x.id !== noId).map(x => x.parentId === noId ? {...x,parentId:n.parentId || ''} : x);
    validar([novo]); novo.atualizadoEm = new Date().toISOString();
    return novo;
  }
  function listaImportacao(conteudo) {
    const j = typeof conteudo === 'string' ? JSON.parse(conteudo) : clone(conteudo);
    const lista = Array.isArray(j) ? j : j.organogramas || (j.nos ? [j] : null);
    validar(lista);
    return clone(lista);
  }
  function importarNoEstado(estado, lista) {
    validar(lista);
    const atuais = estado.organogramas || [], novos = clone(lista);
    const usados = new Set(atuais.map(o => o.id));
    for (const o of novos) {
      if (usados.has(o.id)) o.id = id();
      usados.add(o.id); o.atualizadoEm = new Date().toISOString();
    }
    validar([...atuais,...novos]);
    return [...atuais,...novos];
  }
  function logoSegura(v) {
    if (typeof v !== 'string') return '';
    if (/^data:image\/(png|jpe?g|webp);base64,[a-z\d+/=\s]+$/i.test(v)) return v;
    try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function identificar(n, estado, ctx = {}) {
    const empresa = (estado.empresasPJ || []).find(e => e.id === n.empresaId);
    const nome = empresa?.nome || n.nome || 'Empresa não encontrada';
    const original = empresa?.logo || (empresa && ctx.logo?.(empresa.nome)) || n.logo || '';
    const logo = logoSegura(original);
    return {nome,logo,logoFundo:original===n.logo && /^#[a-f\d]{6}$/i.test(n.logoFundo||'') ? n.logoFundo : '',empresa,ausente:!!n.empresaId && !empresa};
  }
  function recorte(o, raizId) {
    if (!raizId) return clone(o);
    const n = o.nos.find(x => x.id === raizId);
    if (!n) throw Error('O item escolhido para exportar não existe.');
    const ids = new Set([raizId]);
    let mudou = true;
    while (mudou) { mudou = false; for (const x of o.nos) if (ids.has(x.parentId) && !ids.has(x.id)) { ids.add(x.id); mudou = true; } }
    return {...clone(o),nos:o.nos.filter(x => ids.has(x.id)).map(x => ({...clone(x),parentId:x.id === raizId ? '' : x.parentId}))};
  }
  function filhos(o, pai = '') { return o.nos.filter(n => (n.parentId || '') === pai).sort((a,b) => (a.ordem || 0) - (b.ordem || 0)); }
  function linhas(v, largura = 35) {
    const resultado = [];
    for (const paragrafo of String(v || '').split('\n')) {
      let atual = '';
      for (let palavra of paragrafo.split(/\s+/).filter(Boolean)) {
        while (palavra.length > largura) { if (atual) resultado.push(atual); atual = ''; resultado.push(palavra.slice(0,largura)); palavra = palavra.slice(largura); }
        if (!palavra) continue;
        if ((atual + ' ' + palavra).trim().length > largura) { resultado.push(atual); atual = palavra; } else atual = (atual + ' ' + palavra).trim();
      }
      if (atual) resultado.push(atual);
    }
    return resultado;
  }
  function cartaoExportacao(n, estado, notas, ctx) {
    const info = identificar(n,estado,ctx), blocos = [];
    for (const [chave,rotulo] of [['cnpj','CNPJ'],['regime','Regime'],['banco','Banco'],['contabilidade','Contabilidade']]) if (n[chave]) blocos.push({rotulo,texto:n[chave],linhas:linhas(n[chave])});
    if (n.atividade) blocos.push({rotulo:'Atividade',texto:n.atividade,linhas:linhas(n.atividade)});
    if (n.socios) blocos.push({rotulo:'Composição informada',texto:n.socios,linhas:linhas(n.socios)});
    if (n.relacao || n.percentual !== '' && n.percentual != null) blocos.push({rotulo:'Ligação informada',linhas:linhas([n.relacao,n.percentual !== '' && n.percentual != null ? n.percentual.toLocaleString('pt-BR') + '%' : ''].filter(Boolean).join(' · '))});
    if (notas && n.observacoes) blocos.push({rotulo:'Observações',texto:n.observacoes,linhas:linhas(n.observacoes)});
    if (info.ausente) blocos.push({rotulo:'Cadastro',linhas:['Empresa não encontrada. Nome preservado.']});
    const nome = linhas(info.nome,info.logo ? 23 : 31);
    const altura = Math.max(info.logo?100:0,60 + nome.length * 19 + blocos.reduce((v,b) => v + 28 + b.linhas.length * 16,0));
    return {info,blocos,nome,altura};
  }
  function diagramaSVG(o, estado, opts = {}, ctx = {}) {
    validar([o]);
    const escuro = (opts.tema || o.tema) === 'escuro';
    const cores = escuro ? {fundo:'#191e29',linha:'#455064',tinta:'#f5f7fa',suave:'#bbc4d2',destaque:'#7fd9bb'} : {fundo:'white',linha:'#d8e3df',tinta:'#21332d',suave:'#68796f',destaque:'#216d5e'};
    const largura = 272, gap = 24, gapY = 62, dados = new Map(), niveis = [];
    function medir(n, nivel) {
      const cartao = cartaoExportacao(n,estado,opts.notas !== false,ctx), fs = filhos(o,n.id);
      if(opts.resumo){cartao.blocos=cartao.blocos.filter(b=>b.rotulo==='Atividade').map(b=>({...b,linhas:b.linhas.length>2?[b.linhas[0],b.linhas[1]+'…']:b.linhas}));cartao.altura=Math.max(cartao.info.logo?100:0,60+cartao.nome.length*19+cartao.blocos.reduce((v,b)=>v+28+b.linhas.length*16,0));}
      const total = Math.max(largura,fs.reduce((s,f) => s + medir(f,nivel+1),0) + Math.max(0,fs.length-1)*gap);
      dados.set(n.id,{n,cartao,largura:total,nivel}); niveis[nivel] = Math.max(niveis[nivel] || 0,cartao.altura);
      return total;
    }
    const raizes = filhos(o); let totalX = Math.max(largura,raizes.reduce((s,n) => s + medir(n,0),0) + Math.max(0,raizes.length-1)*gap);
    const yNiveis = niveis.map((_,i) => niveis.slice(0,i).reduce((s,h) => s+h+gapY,0) + 18);
    function posicionar(n, inicio) {
      const d = dados.get(n.id); d.x = inicio + (d.largura-largura)/2 + 18; d.y = yNiveis[d.nivel];
      let x = inicio; for (const f of filhos(o,n.id)) { posicionar(f,x); x += dados.get(f.id).largura+gap; }
    }
    let inicio = 0; for (const n of raizes) { posicionar(n,inicio); inicio += dados.get(n.id).largura+gap; }
    let altura = Math.max(120,niveis.reduce((s,h) => s+h+gapY,0)-gapY+36);
    if(opts.resumo && !opts.horizontal){
      // Os ramos principais ficam lado a lado; cada ramo profundo ocupa sua própria coluna.
      const recuo=24,intervalo=24;
      const profundidade=n=>Math.max(0,...filhos(o,n.id).map(f=>1+profundidade(f)));
      const coluna=n=>largura+profundidade(n)*recuo;
      const empilhar=(n,x,y)=>{const d=dados.get(n.id);d.x=x+18;d.y=y;d.colunaCompacta=d.nivel>1;let fim=y+d.cartao.altura;for(const f of filhos(o,n.id))fim=empilhar(f,x+recuo,fim+intervalo);return fim};
      let x=0,fimTotal=0;
      for(const raiz of raizes){
        const ds=filhos(o,raiz.id),larguraRaiz=ds.length?ds.reduce((v,n)=>v+coluna(n),0)+Math.max(0,ds.length-1)*gap:largura,d=dados.get(raiz.id);
        d.x=x+(larguraRaiz-largura)/2+18;d.y=18;fimTotal=Math.max(fimTotal,18+d.cartao.altura);
        let colunaX=x;for(const n of ds){fimTotal=Math.max(fimTotal,empilhar(n,colunaX,d.y+d.cartao.altura+gapY));colunaX+=coluna(n)+gap;}
        x+=larguraRaiz+gap;
      }
      totalX=Math.max(largura,x-gap);altura=Math.max(120,fimTotal+18);
    }
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalX+36}" height="${altura}" viewBox="0 0 ${totalX+36} ${altura}" role="img" aria-label="Organograma de ${esc(o.titulo)}">`;
    for (const d of dados.values()) if (d.n.parentId) {
      const p = dados.get(d.n.parentId), px=p.x+largura/2,py=p.y+p.cartao.altura,nx=d.x+largura/2,ny=d.y,meio=py+(ny-py)/2;
      const trajeto=d.colunaCompacta?`M ${p.x+12} ${py} V ${d.y+d.cartao.altura/2} H ${d.x}`:`M ${px} ${py} V ${meio} H ${nx} V ${ny}`;
      svg += `<path d="${trajeto}" stroke="${cores.linha}" stroke-width="2" fill="none"/>`;
    }
    for (const d of dados.values()) {
      const {n,cartao:c,x,y} = d;
      svg += `<g data-no-id="${esc(n.id)}" tabindex="0" role="button" aria-label="Editar ${esc(c.info.nome)}"><rect x="${x}" y="${y}" width="${largura}" height="${c.altura}" rx="14" fill="${cores.fundo}" stroke="${cores.linha}"/><rect x="${x}" y="${y}" width="${largura}" height="6" rx="3" fill="${d.nivel===0?cores.destaque:'#c4a877'}"/>`;
      svg += `<text x="${x+18}" y="${y+29}" font-size="10" font-weight="700" fill="${cores.suave}" font-family="Arial,sans-serif">${esc((n.tipo||'Empresa').toUpperCase())}</text>`;
      if (c.info.logo && c.info.logoFundo) svg += `<rect x="${x+203}" y="${y+33}" width="54" height="54" rx="7" fill="${c.info.logoFundo}"/>`;
      if (c.info.logo) svg += `<image href="${esc(c.info.logo)}" x="${x+207}" y="${y+37}" width="46" height="46" preserveAspectRatio="xMidYMid meet"/>`;
      let ty = y+54;
      for (const linha of c.nome) { svg += `<text x="${x+18}" y="${ty}" font-size="16" font-weight="700" fill="${cores.tinta}" font-family="Arial,sans-serif">${esc(linha)}</text>`; ty += 19; }
      ty += 7;
      for (const bloco of c.blocos) {
        ty += 17; svg += `<text x="${x+18}" y="${ty}" font-size="10" fill="${cores.suave}" font-weight="700" font-family="Arial,sans-serif">${esc(bloco.rotulo.toUpperCase())}</text>`; ty += 18;
        for (const linha of bloco.linhas) { svg += `<text x="${x+18}" y="${ty}" font-size="12" fill="${cores.tinta}" font-family="Arial,sans-serif">${esc(linha)}</text>`; ty += 16; }
        ty -= 7;
      }
      svg += '</g>';
    }
    return {svg:svg+'</svg>',largura:totalX+36,altura};
  }
  function htmlExportacao(original, estado, opts = {}, ctx = {}) {
    const o = recorte(original,opts.raizId), raiz = original.nos.find(n => n.id === opts.raizId), parte = raiz ? identificar(raiz,estado,ctx).nome : '';
    const compacto=opts.formato!=='completo', grafico = diagramaSVG(o,estado,{...opts,resumo:compacto,horizontal:true},ctx), grande = compacto || grafico.largura > 1900 || grafico.altura > 1100;
    const escuro = (opts.tema || o.tema) === 'escuro';
    const titulo = original.titulo + (parte ? ' · ' + parte : '');
    const notas = opts.notas !== false && o.observacoes ? `<section class="notas"><h2>Observações gerais</h2><p>${esc(o.observacoes)}</p></section>` : '';
    const detalhes = grande ? `<section class="detalhes"><h2>Leitura dos itens</h2><p>Diagrama geral na página anterior. Abaixo, todos os textos em tamanho de leitura.</p>${notas}<div class="grade">${o.nos.map(n=>{const c=cartaoExportacao(n,estado,opts.notas!==false,ctx),pai=o.nos.find(p=>p.id===n.parentId);return `<article><small>${esc(n.tipo||'Empresa')}</small><h3>${esc(c.info.nome)}</h3>${pai?`<p class="vinculo">Ligado a ${esc(identificar(pai,estado,ctx).nome)}</p>`:''}${c.blocos.map(b=>`<h4>${esc(b.rotulo)}</h4><p>${esc(b.texto ?? b.linhas.join(' '))}</p>`).join('')}</article>`}).join('')}</div></section>` : '';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>@page{size:A3 landscape;margin:15mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#21332d;margin:0;background:#edf2ef}.controle{padding:14px 24px;background:#216d5e;color:white;display:flex;align-items:center;gap:20px}.controle button{background:white;color:#216d5e;padding:11px 20px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.folha{background:white;margin:24px;padding:28px;border-radius:14px}header{border-bottom:1px solid #d8e3df;padding-bottom:15px;margin-bottom:20px;display:flex;justify-content:space-between;gap:20px}header h1{font-size:28px;margin:6px 0}header p{color:#68796f;margin:5px 0;white-space:pre-wrap}small{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#65756e}.selo{text-align:right;font-size:11px;color:#68796f}.grafico svg{display:block;width:100%;height:auto;max-height:215mm}.grafico{break-inside:avoid}footer{color:#68796f;font-size:10px;margin-top:16px;border-top:1px solid #d8e3df;padding-top:10px}.notas{margin:14px 0 18px;padding:12px 16px;border:1px solid #d8e3df;border-radius:10px;break-inside:avoid;page-break-inside:avoid}.notas h2,.detalhes h2{font-size:17px}.notas h2{margin:0 0 7px;font-size:14px}.notas p{white-space:pre-wrap;line-height:1.5;overflow-wrap:anywhere;font-size:12px;margin:0;orphans:3;widows:3}.detalhes{break-before:page}.grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.grade article{border:1px solid #d8e3df;padding:18px;border-radius:10px;break-inside:avoid}.grade h3{margin:8px 0;font-size:17px}.grade h4{font-size:10px;text-transform:uppercase;color:#68796f;margin:14px 0 5px}.grade p{font-size:12px;line-height:1.5;margin:0;overflow-wrap:anywhere}.vinculo{color:#68796f}.aviso{font-size:11px;color:#68796f}.escuro .folha{background:#11151e;color:#f5f7fa}.escuro .folha :is(header p,small,.selo,footer,.notas p,.detalhes>p,.vinculo){color:#bbc4d2}.escuro .folha :is(header,footer,.grade article,.notas){border-color:#455064}.escuro .grade article{background:#191e29}.escuro .grade h4{color:#bbc4d2}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:white}.controle{display:none}.folha{margin:0;padding:0;border-radius:0}.grafico svg{max-height:215mm}a{color:inherit}}@media(max-width:700px){.folha{margin:10px;padding:16px}.grade{grid-template-columns:1fr}.controle{flex-wrap:wrap}header{display:block}}</style></head><body class="${escuro?'escuro':'claro'}"><div class="controle"><button type="button" onclick="window.print()">Salvar em PDF / Imprimir</button><span>Papel A3, orientação paisagem. ${esc(o.nos.length)} itens${parte?' · recorte selecionado':''}.</span></div><main class="folha"><header><div><small>Organograma · Central do Léo</small><h1>${esc(titulo)}</h1>${o.subtitulo?`<p>${esc(o.subtitulo)}</p>`:''}</div><div class="selo">${esc(new Date().toLocaleDateString('pt-BR'))}<br>${esc(o.nos.length)} itens</div></header><div class="grafico">${grafico.svg}</div><footer>As linhas representam ligações informadas no organograma. A composição societária aparece apenas quando preenchida expressamente.${grande?' Textos completos nas páginas seguintes.':''}</footer>${detalhes}${grande?'':notas}</main></body></html>`;
  }
  function render(container, ctx) {
    const doc = container.ownerDocument || global.document;
    let selecionado = ctx.selectedId || '', modo='geral';
    const selecionar = valor => { selecionado=valor; ctx.onSelect?.(valor); };
    const state = () => ctx.getState();
    const criar = (tag,classe,conteudo) => { const x=doc.createElement(tag); if(classe)x.className=classe; if(conteudo!=null)x.textContent=conteudo; return x; };
    const botao = (rotulo,fn,classe='ghost') => {const b=criar('button','btn '+classe,rotulo);b.type='button';b.onclick=fn;return b;};
    function persistir(lista, proximoId) {
      validar(lista); const e=state(), anteriores=e.organogramas, mt=e._mt, tinhaMt=Object.prototype.hasOwnProperty.call(e,'_mt');
      e.organogramas=lista;
      try { if(ctx.save()===false)throw Error('Não foi possível salvar.'); } catch(erro) { if(anteriores===undefined)delete e.organogramas;else e.organogramas=anteriores;if(tinhaMt)e._mt=mt;else delete e._mt;throw Error('Não foi possível salvar o organograma. '+erro.message); }
      selecionar(proximoId);pintar();
    }
    function conferirAtual(o,assinatura) {
      if(o && JSON.stringify((state().organogramas||[]).find(x=>x.id===o.id))!==assinatura)throw Error('Este organograma mudou enquanto a janela estava aberta. Feche e abra novamente para continuar.');
    }
    function mudar(o,original,assinatura) {
      conferirAtual(original,assinatura);
      const atuais=state().organogramas||[],ix=atuais.findIndex(x=>x.id===o.id),lista=atuais.slice();
      if(ix<0)lista.push(o);else lista[ix]=o;
      persistir(lista,o.id);
    }
    function abrir(titulo,sub,montar) {
      if(ctx.openModal)return ctx.openModal(titulo,sub,montar);
      const fundo=criar('div','org-modal-fundo'),dialogo=criar('section','org-modal'),h=criar('h2','',titulo),p=criar('p','',sub),corpo=criar('div');
      dialogo.setAttribute('role','dialog');dialogo.setAttribute('aria-modal','true');dialogo.append(h,p,corpo);fundo.append(dialogo);container.append(fundo);montar(corpo,()=>fundo.remove());
    }
    function form(corpo,fechar,campos,salvar,rotulo='Salvar') {
      const f=criar('form','org-form'),controles={};
      for(const campo of campos){
        const label=criar('label','org-campo'+(campo.full?' org-campo-full':''));label.append(criar('span','',campo.rotulo));
        const input=criar(campo.opcoes?'select':campo.tipo==='textarea'?'textarea':'input');input.name=campo.nome;
        if(campo.opcoes)for(const [valor,nome]of campo.opcoes){const op=criar('option','',nome);op.value=valor;input.append(op)}
        else if(campo.tipo!=='textarea')input.type=campo.tipo||'text';
        input.value=campo.valor??'';if(campo.req)input.required=true;if(campo.placeholder)input.placeholder=campo.placeholder;
        if(campo.tipo==='number'){input.min=campo.min??'0';input.max=campo.max??'100';input.step='any'}
        if(campo.tipo==='textarea')input.rows=campo.rows||3;
        label.append(input);if(campo.dica)label.append(criar('small','',campo.dica));f.append(label);controles[campo.nome]=input;
      }
      const erro=criar('p','org-erro');erro.setAttribute('role','alert');const acoes=criar('div','org-form-acoes');acoes.append(botao('Cancelar',fechar));const ok=botao(rotulo,()=>{},'');ok.type='submit';acoes.append(ok);f.append(erro,acoes);
      f.onsubmit=ev=>{ev.preventDefault();erro.textContent='';try{salvar(Object.fromEntries(Object.entries(controles).map(([k,c])=>[k,c.value])),fechar)}catch(e){erro.textContent=e.message;erro.scrollIntoView?.({block:'nearest'})}};
      corpo.append(f);return {f,controles,erro};
    }
    function editarDiagrama(o) {
      const assinatura=JSON.stringify(o);
      abrir(o?'Editar organograma':'Novo organograma','Defina o título e as observações. As empresas continuam nos próprios cadastros.',(c,fechar)=>{
        form(c,fechar,[{nome:'titulo',rotulo:'Título',valor:o?.titulo,req:true,full:true,placeholder:'Ex.: Estrutura do grupo'},{nome:'tema',rotulo:'Aparência',valor:o?.tema||'claro',opcoes:[['claro','Claro'],['escuro','Escuro']],full:true},{nome:'subtitulo',rotulo:'Descrição curta',valor:o?.subtitulo,full:true},{nome:'observacoes',rotulo:'Observações gerais',valor:o?.observacoes,tipo:'textarea',full:true}],v=>{mudar({...clone(o||{id:id(),nos:[]}),...v,titulo:texto(v.titulo),atualizadoEm:new Date().toISOString()},o,assinatura);fechar()});
      });
    }
    function editarNo(o,n,paiId='') {
      const assinatura=JSON.stringify(o);
      const descendentes=new Set(n?recorte(o,n.id).nos.map(x=>x.id):[]),empresas=[...(state().empresasPJ||[])].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
      const opcoes=[['','Item livre, sem cadastro vinculado'],...empresas.map(e=>[e.id,e.nome])];
      if(n?.empresaId&&!empresas.some(e=>e.id===n.empresaId))opcoes.push([n.empresaId,(n.nome||'Empresa')+' · cadastro não encontrado']);
      abrir(n?'Editar item':'Adicionar item','A ligação organiza o desenho. Ela não define participação societária.',(c,fechar)=>{
        const campos=[{nome:'empresaId',rotulo:'Empresa do cadastro',valor:n?.empresaId,opcoes,full:true,dica:'Ao vincular, o nome e a logo acompanham o cadastro da empresa.'},{nome:'nome',rotulo:'Nome do item',valor:n?.nome,full:true,placeholder:'Empresa, pessoa, área ou escritório'},{nome:'tipo',rotulo:'Tipo',valor:n?.tipo||'Empresa',opcoes:tipos.map(t=>[t,t])},{nome:'parentId',rotulo:'Ligação no organograma',valor:n?.parentId||paiId,opcoes:[['','No topo, sem ligação superior'],...o.nos.filter(x=>!descendentes.has(x.id)).map(x=>[x.id,identificar(x,state(),ctx).nome])]},...['cnpj','regime','banco','contabilidade'].map((chave,i)=>({nome:chave,rotulo:['CNPJ de referência','Regime tributário informado','Banco informado','Contabilidade'][i],valor:n?.[chave],dica:chave==='cnpj'?'Referência do desenho; não altera o cadastro empresarial.':undefined})),{nome:'atividade',rotulo:'Atividade / função',valor:n?.atividade,tipo:'textarea',full:true,rows:2},{nome:'socios',rotulo:'Sócios e composição informada',valor:n?.socios,tipo:'textarea',full:true,dica:'Preencha conforme seus documentos. Não é calculado a partir das linhas do desenho.'},{nome:'relacao',rotulo:'Descrição da ligação (opcional)',valor:n?.relacao,placeholder:'Ex.: contabilidade, gestão, participação informada'},{nome:'percentual',rotulo:'Percentual informado (opcional)',valor:n?.percentual,tipo:'number',dica:'Somente quando essa informação estiver confirmada.'},{nome:'observacoes',rotulo:'Observações',valor:n?.observacoes,tipo:'textarea',full:true}];
        const {controles}=form(c,fechar,campos,v=>{
          const emp=(state().empresasPJ||[]).find(e=>e.id===v.empresaId);
          if(v.empresaId&&!emp&&v.empresaId!==n?.empresaId)throw Error('Escolha uma empresa cadastrada.');
          const valor={...clone(n||{id:id(),ordem:o.nos.length}),...v,nome:emp?.nome||texto(v.nome),percentual:v.percentual===''?'':Number(v.percentual)};
          mudar(salvarNo(o,valor),o,assinatura);fechar();
        });
        controles.empresaId.onchange=()=>{const e=empresas.find(e=>e.id===controles.empresaId.value);if(e)controles.nome.value=e.nome;controles.nome.readOnly=!!e;};
        controles.nome.readOnly=!!empresas.find(e=>e.id===n?.empresaId);
      });
    }
    function excluirNo(o,n) {
      const assinatura=JSON.stringify(o);
      abrir('Remover item do organograma','O cadastro da empresa e seus dados continuam preservados.',(c,fechar)=>{
        const caixa=criar('div','org-confirmacao');caixa.append(criar('p','',`Remover “${identificar(n,state(),ctx).nome}” deste desenho?`));
        const qtd=filhos(o,n.id).length;if(qtd)caixa.append(criar('p','',`${qtd} item(ns) abaixo serão mantidos e ligados ao nível superior deste item.`));
        const acoes=criar('div','org-form-acoes');acoes.append(botao('Cancelar',fechar),botao('Remover item',()=>{try{mudar(removerNo(o,n.id),o,assinatura);fechar()}catch(e){caixa.append(criar('p','org-erro',e.message))}},'org-perigo'));caixa.append(acoes);c.append(caixa);
      });
    }
    function excluirDiagrama(o) {
      const assinatura=JSON.stringify(o);
      abrir('Excluir organograma','Essa ação remove apenas este desenho, sem excluir empresas.',(c,fechar)=>{const caixa=criar('div','org-confirmacao');caixa.append(criar('p','',`Excluir “${o.titulo}” e seus ${o.nos.length} itens?`));const acoes=criar('div','org-form-acoes');acoes.append(botao('Cancelar',fechar),botao('Excluir organograma',()=>{try{conferirAtual(o,assinatura);persistir((state().organogramas||[]).filter(x=>x.id!==o.id),'');fechar()}catch(e){caixa.append(criar('p','org-erro',e.message))}},'org-perigo'));caixa.append(acoes);c.append(caixa)});
    }
    function exportar(o) {
      abrir('Exportar organograma em PDF','Escolha o desenho completo ou apenas uma parte. A exportação abre em outra janela.',(c,fechar)=>{
        const {f}=form(c,fechar,[{nome:'raizId',rotulo:'O que exportar',opcoes:[['','Organograma completo'],...o.nos.map(n=>[n.id,identificar(n,state(),ctx).nome+' e itens abaixo'])],full:true},{nome:'formato',rotulo:'Formato',opcoes:[['resumo','Estrutura visual + dados completos nas páginas seguintes'],['completo','Todos os textos dentro do desenho']],full:true},{nome:'tema',rotulo:'Aparência do PDF',valor:o.tema||'claro',opcoes:[['claro','Claro'],['escuro','Escuro']],full:true},{nome:'notas',rotulo:'Observações',opcoes:[['sim','Incluir observações'],['nao','Somente estrutura e dados dos itens']],full:true}],v=>{
          const html=htmlExportacao(o,state(),{raizId:v.raizId,notas:v.notas==='sim',tema:v.tema,formato:v.formato},ctx);
          const janela=ctx.openWindow?ctx.openWindow():global.open?.('','_blank');
          if(!janela)throw Error('O navegador bloqueou a nova janela. Permita pop-ups para abrir o PDF.');
          try{janela.opener=null;janela.document.open();janela.document.write(html);janela.document.close()}catch(e){janela.close?.();throw Error('Não foi possível abrir a prévia de impressão. Tente novamente.');}
          fechar();
        },'Abrir PDF');
        f.prepend(criar('p','org-campo-full org-ajuda','Na prévia, clique em “Salvar em PDF / Imprimir”. O formato é A3 na horizontal. Em estruturas grandes, os textos também aparecem em páginas de leitura.'));
      });
    }
    function importarArquivo(arquivo) {
      if(!arquivo)return;
      abrir('Importar organograma','Confira a prévia antes de salvar. Os organogramas existentes serão mantidos.',(c,fechar)=>{
        const area=criar('div','org-importacao');area.append(criar('p','','Lendo arquivo…'));c.append(area);
        if(arquivo.size>5*1024*1024){area.textContent='O arquivo deve ter até 5 MB.';area.append(botao('Fechar',fechar));return}
        arquivo.text().then(conteudo=>{
          if (!area.isConnected) return;
          const lista=listaImportacao(conteudo);area.replaceChildren();
          if(!lista.length)throw Error('O arquivo não contém organogramas.');
          area.append(criar('p','',`${lista.length} organograma(s), ${lista.reduce((s,o)=>s+o.nos.length,0)} itens. Nada foi salvo ainda.`));
          for(const o of lista){const bloco=criar('section','org-importacao-previa');bloco.append(criar('h3','',o.titulo));const nomes=o.nos.map(n=>identificar(n,state(),ctx).nome);bloco.append(criar('p','',nomes.join(' · ')));area.append(bloco)}
          const erro=criar('p','org-erro');erro.setAttribute('role','alert');area.append(erro);const acoes=criar('div','org-form-acoes');acoes.append(botao('Cancelar',fechar),botao('Salvar importação',()=>{try{const nova=importarNoEstado(state(),lista);persistir(nova,nova.at(-1).id);fechar()}catch(e){erro.textContent=e.message}},''));area.append(acoes);
        }).catch(e=>{if(!area.isConnected)return;area.replaceChildren(criar('p','org-erro','Não foi possível importar: '+e.message),botao('Fechar',fechar))});
      });
    }
    function pintar() {
      const lista=state().organogramas||[];
      container.replaceChildren();container.classList.add('organograma-area');
      const topo=criar('div','org-topo'),textoTopo=criar('div');textoTopo.append(criar('p','org-eyebrow','ESTRUTURA DO GRUPO'),criar('h2','','Organograma'),criar('p','org-ajuda','Empresas, pessoas e conexões em um desenho que você pode editar.'));topo.append(textoTopo);
      const acoes=criar('div','org-acoes');acoes.append(botao('+ Novo organograma',()=>editarDiagrama()));
      const input=criar('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.onchange=()=>{importarArquivo(input.files?.[0]);input.value=''};
      acoes.append(botao('Importar arquivo',()=>input.click()),input);topo.append(acoes);if(!lista.length)container.append(topo);
      try{validar(lista)}catch(e){container.append(criar('p','org-erro','Confira os dados do organograma: '+e.message));return}
      if(!lista.length){const vazio=criar('section','org-vazio');vazio.append(criar('div','org-simbolo','⌘'),criar('h3','','Seu grupo, visto por inteiro'),criar('p','','Crie a estrutura, vincule suas empresas e registre as observações de cada ligação.'),botao('Criar primeiro organograma',()=>editarDiagrama(),''));container.append(vazio);return}
      const o=lista.find(x=>x.id===selecionado)||lista[0];selecionar(o.id);
      const barra=criar('div','org-barra');const escolha=criar('select');escolha.setAttribute('aria-label','Escolher organograma');for(const item of lista){const op=criar('option','',item.titulo);op.value=item.id;escolha.append(op)}escolha.value=o.id;escolha.onchange=()=>{selecionar(escolha.value);pintar()};barra.append(escolha);
      const comandos=criar('div','org-acoes');comandos.append(botao('+ Adicionar item',()=>editarNo(o),''),botao('Exportar PDF',()=>exportar(o)));
      const organizar=criar('details','org-organizar'),sumario=criar('summary','','Organizar');organizar.append(sumario,acoes);acoes.prepend(botao('Editar título e notas',()=>editarDiagrama(o)));comandos.append(organizar);barra.append(comandos);container.append(barra);
      const painel=criar('section','org-painel'+(o.tema==='escuro'?' org-tema-escuro':'')),cab=criar('header','org-painel-cab'),txt=criar('div');txt.append(criar('h3','',o.titulo));if(o.subtitulo)txt.append(criar('p','',o.subtitulo));cab.append(txt,criar('span','org-contagem',o.nos.length+' itens'));painel.append(cab);
      if(!o.nos.length){const vazio=criar('div','org-vazio');vazio.append(criar('p','','Adicione o primeiro item no topo da estrutura.'),botao('Adicionar primeiro item',()=>editarNo(o),''));painel.append(vazio)}
      else {
        painel.append(criar('p','org-orientacao','As linhas mostram as ligações que você informar. Sócios e participações são descritos separadamente.'));
        const visual=criar('div','org-visual-controles');visual.append(botao('Visão geral',()=>{modo='geral';pintar()},modo==='geral'?'':'ghost'),botao('Detalhar',()=>{modo='detalhes';pintar()},modo==='detalhes'?'':'ghost'),criar('span','org-ajuda',modo==='geral'?'Clique em um item para editar os dados.':'Role o desenho para ver todos os itens e suas informações.'));painel.append(visual);
        if(modo==='geral'){const geral=criar('div','org-visao-geral');geral.innerHTML=diagramaSVG(o,state(),{notas:false,resumo:true},ctx).svg;const editarPeloDesenho=ev=>{const alvo=ev.target.closest?.('[data-no-id]');if(!alvo)return;const no=o.nos.find(n=>n.id===alvo.getAttribute('data-no-id'));if(no)editarNo(o,no)};geral.onclick=editarPeloDesenho;geral.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();editarPeloDesenho(ev)}};painel.append(geral)}
        const viewport=criar('div','org-viewport');viewport.hidden=modo!=='detalhes';viewport.tabIndex=0;viewport.setAttribute('aria-label','Desenho do organograma. Use a rolagem horizontal para ver todos os itens.');
        function ramo(n){
          const info=identificar(n,state(),ctx),li=criar('li','org-ramo'),cartao=criar('article','org-no');cartao.dataset.noId=n.id;
          const titulo=criar('div','org-no-titulo'),icone=criar('span','org-no-logo');if(info.logoFundo)icone.style.background=info.logoFundo;if(info.logo){const img=criar('img');img.src=info.logo;img.alt='';if(info.logoFundo)img.style.background=info.logoFundo;img.onerror=()=>{icone.replaceChildren();icone.textContent=info.nome.slice(0,1)};icone.append(img)}else icone.textContent=info.nome.slice(0,1);
          const nome=criar('div');nome.append(criar('small','',n.tipo||'Empresa'),criar('h4','',info.nome));titulo.append(icone,nome);cartao.append(titulo);
          for(const [chave,rotulo]of [['cnpj','CNPJ'],['regime','Regime'],['banco','Banco'],['contabilidade','Contabilidade']])if(n[chave]){const dado=criar('p','org-no-referencia');dado.append(criar('b','',rotulo+': '),doc.createTextNode(n[chave]));cartao.append(dado)}
          if(n.atividade)cartao.append(criar('p','org-no-atividade',n.atividade));
          if(n.socios){const d=criar('div','org-no-dado');d.append(criar('small','','Composição informada'),criar('p','',n.socios));cartao.append(d)}
          if(n.relacao||n.percentual!==''&&n.percentual!=null)cartao.append(criar('p','org-no-relacao',[n.relacao,n.percentual!==''&&n.percentual!=null?n.percentual.toLocaleString('pt-BR')+'%':''].filter(Boolean).join(' · ')));
          if(n.observacoes){const nota=criar('div','org-no-nota');nota.append(criar('small','','Observações'),criar('p','',n.observacoes));cartao.append(nota)}
          if(info.ausente)cartao.append(criar('p','org-aviso','Cadastro não encontrado. O nome foi preservado.'));
          const acoes=criar('div','org-no-acoes');acoes.append(botao('Editar',()=>editarNo(o,n)),botao('+ Abaixo',()=>editarNo(o,null,n.id)),botao('Remover',()=>excluirNo(o,n),'ghost org-texto-perigo'));
          if(info.empresa&&ctx.openCompany)acoes.append(botao('Abrir empresa',()=>ctx.openCompany(info.empresa.id)));
          cartao.append(acoes);li.append(cartao);const fs=filhos(o,n.id);if(fs.length){const ul=criar('ul','org-filhos');for(const f of fs)ul.append(ramo(f));li.append(ul)}return li;
        }
        const ul=criar('ul','org-arvore');for(const raiz of filhos(o))ul.append(ramo(raiz));viewport.append(ul);painel.append(viewport);if(modo==='detalhes'){const centralizar=()=>{const primeira=viewport.querySelector('.org-arvore>.org-ramo>.org-no');if(primeira)viewport.scrollLeft=Math.max(0,primeira.offsetLeft+primeira.offsetWidth/2-viewport.clientWidth/2)};if(global.requestAnimationFrame)global.requestAnimationFrame(centralizar);else centralizar()}
      }
      container.append(painel);
      const rodape=criar('div','org-rodape');const notas=criar('section','org-notas');notas.append(criar('h3','','Observações gerais'),criar('p','',o.observacoes||'Registre orientações, contexto e pontos a conferir sobre esta estrutura.'),botao('Editar observações',()=>editarDiagrama(o)));rodape.append(notas);const manutencao=criar('div','org-manutencao');if(o.atualizadoEm){const d=new Date(o.atualizadoEm);if(!Number.isNaN(d.valueOf()))manutencao.append(criar('small','','Atualizado em '+d.toLocaleDateString('pt-BR')))}manutencao.append(botao('Excluir organograma',()=>excluirDiagrama(o),'ghost org-texto-perigo'));rodape.append(manutencao);container.append(rodape);
    }
    pintar();
    return {render:pintar,importarArquivo};
  }
  global.LeoOrganograma={render,validar,salvarNo,removerNo,listaImportacao,importarNoEstado,identificar,recorte,diagramaSVG,htmlExportacao};
})(globalThis);
