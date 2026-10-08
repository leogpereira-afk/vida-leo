/* Demandas por obra. O estado permanece em E.obras e usa o salvamento da Central. */
const FMD_SITUACOES = ['A fazer', 'Em andamento', 'Aguardando terceiro', 'Bloqueada', 'Resolvida'];
const FMD_CLASSES = {'A fazer':'fmd-fazer','Em andamento':'fmd-andamento','Aguardando terceiro':'fmd-aguardando','Bloqueada':'fmd-bloqueada','Resolvida':'fmd-resolvida'};

function fmDemandasContexto() {
  return {now:new Date().toISOString(), uid:()=>uid(), autor:'Usuário'};
}
function fmDemandasBase(o) {
  return {referencia:o.fmDemandas, texto:JSON.stringify(o.fmDemandas), tinha:Object.hasOwn(o,'fmDemandas')};
}
function fmDemandasGravar(o, dados, base) {
  if (!Array.isArray(E.obras) || !E.obras.includes(o)) throw Error('Esta obra mudou. Reabra a obra para continuar. Seu rascunho continua nesta janela.');
  if (o.fmDemandas !== base.referencia || JSON.stringify(o.fmDemandas) !== base.texto) throw Error('As demandas foram atualizadas enquanto você editava. Seu rascunho foi mantido; confira as alterações antes de reabrir a edição.');
  const mt=E._mt, tinhaMt=Object.hasOwn(E,'_mt');
  o.fmDemandas=dados;
  try { salvar(); }
  catch (e) {
    if(base.tinha)o.fmDemandas=base.referencia;else delete o.fmDemandas;
    if(tinhaMt)E._mt=mt;else delete E._mt;
    throw Error('Não foi possível salvar. Os dados anteriores e seu rascunho foram mantidos. Tente novamente.');
  }
  return dados;
}
function fmDemandasResumo(o) {
  const dados=FortemaisDemandasModelo.dados(o), r=FortemaisDemandasModelo.resumo(dados,hoje());
  const c=el('<span class="fmd-obra-resumo" aria-label="Resumo de demandas"></span>');
  c.dataset.fmdObraSummary=o.id;
  c.hidden=!dados.itens.length;
  if(!c.hidden) {
    c.appendChild(el('<span><b>'+r.abertas+'</b> '+(r.abertas===1?'demanda aberta':'demandas abertas')+'</span>'));
    if(r.atrasadas)c.appendChild(el('<span class="fmd-texto-alerta">'+r.atrasadas+' '+(r.atrasadas===1?'atrasada':'atrasadas')+'</span>'));
    if(r.bloqueadas)c.appendChild(el('<span class="fmd-texto-alerta">'+r.bloqueadas+' '+(r.bloqueadas===1?'bloqueada':'bloqueadas')+'</span>'));
    if(!r.abertas&&r.resolvidas)c.appendChild(el('<span>'+r.resolvidas+' '+(r.resolvidas===1?'resolvida':'resolvidas')+'</span>'));
  }
  return c;
}
function fmDemandasAtualizarResumo(o) {
  document.querySelectorAll('[data-fmd-obra-summary]').forEach(no=>{if(no.dataset.fmdObraSummary===String(o.id))no.replaceWith(fmDemandasResumo(o));});
}
function fmDemandasBotao(texto,fn,estilo='ghost') {
  const b=acao(texto,fn,estilo);b.type='button';return b;
}
function fmDemandasCampo(nome,rotulo,valor='',tipo='text',opcoes=[]) {
  const campo=el('<label class="fmd-campo"><span></span></label>');campo.firstElementChild.textContent=rotulo;
  const input=document.createElement(tipo==='textarea'?'textarea':tipo==='select'?'select':'input');input.name=nome;
  if(tipo==='select')opcoes.forEach(([v,t])=>{const op=document.createElement('option');op.value=v;op.textContent=t;input.appendChild(op);});
  else if(tipo==='textarea')input.rows=3;else input.type=tipo;
  input.value=valor??'';campo.appendChild(input);return campo;
}
function fmDemandasDetalhes(titulo,aberto=false) {
  const d=el('<details class="fmd-detalhes"><summary></summary><div class="fmd-detalhes-corpo"></div></details>');d.querySelector('summary').textContent=titulo;d.open=aberto;return d;
}
function fmDemandasEditor(o,item,aoSalvar) {
  let base=fmDemandasBase(o), salvo=false, ler=()=>'', inicial='';
  const dados=FortemaisDemandasModelo.dados(o), estado=item||{titulo:'',situacao:'A fazer',prioridade:'normal',etapaId:'',checklist:[],links:[]};
  abrirModal(item?'Detalhes da demanda':'Nova demanda','Registre o que precisa acontecer e acompanhe cada avanço.',(corpo,fechar)=>{
    corpo.classList.add('fmd-editor');
    const form=el('<form class="fmd-form"></form>'), principal=el('<div class="fmd-editor-principal"></div>');
    const titulo=fmDemandasCampo('titulo','O que precisa ser feito?',estado.titulo);titulo.querySelector('input').required=true;titulo.querySelector('input').maxLength=240;
    titulo.querySelector('input').placeholder='Dê um título claro à demanda';
    principal.appendChild(titulo);
    const grade=el('<div class="fmd-form-grid"></div>');
    grade.append(fmDemandasCampo('situacao','Situação',estado.situacao,'select',FMD_SITUACOES.map(x=>[x,x])),fmDemandasCampo('etapaId','Etapa',estado.etapaId,'select',[['','Sem etapa'],...dados.etapas.map(x=>[x.id,x.nome])]));
    grade.append(fmDemandasCampo('responsavel','Responsável',estado.responsavel),fmDemandasCampo('prazo','Prazo',estado.prazo,'date'));
    principal.appendChild(grade);
    const bloqueio=fmDemandasCampo('motivoBloqueio','O que impede o avanço?',estado.motivoBloqueio,'textarea');
    bloqueio.classList.add('fmd-campo-condicional');
    const espera=el('<div class="fmd-form-grid fmd-campo-condicional"></div>');
    espera.append(fmDemandasCampo('aguardandoQuem','Aguardando quem?',estado.aguardandoQuem),fmDemandasCampo('retornoPendente','Qual retorno está pendente?',estado.retornoPendente));
    const situacao=grade.querySelector('[name=situacao]');
    const condicionais=()=>{bloqueio.hidden=situacao.value!=='Bloqueada';espera.hidden=situacao.value!=='Aguardando terceiro';};
    situacao.addEventListener('change',condicionais);condicionais();principal.append(bloqueio,espera);
    form.appendChild(principal);

    const detalhes=fmDemandasDetalhes('Descrição e próximos passos',Boolean(item&&(item.descricao||item.proximaAcao||item.envolvidos)));
    const campos=detalhes.querySelector('.fmd-detalhes-corpo');
    campos.append(fmDemandasCampo('descricao','Descrição',estado.descricao,'textarea'),fmDemandasCampo('proximaAcao','Próxima ação',estado.proximaAcao,'textarea'));
    const complemento=el('<div class="fmd-form-grid"></div>');
    complemento.append(fmDemandasCampo('envolvidos','Outras pessoas envolvidas',estado.envolvidos),fmDemandasCampo('prioridade','Prioridade',estado.prioridade||'normal','select',[['baixa','Baixa'],['normal','Normal'],['alta','Alta']]));campos.appendChild(complemento);form.appendChild(detalhes);

    const checklist=fmDemandasDetalhes('Checklist'+(estado.checklist?.length?' · '+estado.checklist.length:''));
    const linhasChecklist=el('<div class="fmd-checklist"></div>');
    const adicionarCheck=(x={})=>{
      const linha=el('<div class="fmd-check-linha"><label class="fmd-check-alvo"><input type="checkbox" aria-label="Concluído"></label><input type="text" aria-label="Item do checklist" placeholder="Uma pequena ação"></div>');
      linha.dataset.id=x.id||'';linha.querySelector('[type=checkbox]').checked=!!x.feito;linha.querySelector('[type=text]').value=x.texto||'';
      const remover=fmDemandasBotao('Remover',()=>{linha.remove();},'ghost');remover.classList.add('fmd-remover');remover.setAttribute('aria-label','Remover item do checklist');linha.appendChild(remover);linhasChecklist.appendChild(linha);
      return linha;
    };
    (estado.checklist||[]).forEach(adicionarCheck);
    checklist.lastElementChild.append(linhasChecklist,fmDemandasBotao('+ Adicionar item',()=>{adicionarCheck().querySelector('[type=text]').focus();}));form.appendChild(checklist);

    const links=fmDemandasDetalhes('Links'+(estado.links?.length?' · '+estado.links.length:'')), linhasLinks=el('<div class="fmd-links"></div>');
    const adicionarLink=(x={})=>{
      const linha=el('<div class="fmd-link-linha"></div>');linha.dataset.id=x.id||'';
      linha.append(fmDemandasCampo('linkNome','Nome do link',x.nome),fmDemandasCampo('linkUrl','Endereço',x.url));
      const entrada=linha.querySelector('[name=linkUrl]');entrada.placeholder='https://…';entrada.inputMode='url';entrada.autocapitalize='none';entrada.spellcheck=false;
      const acoes=el('<div class="fmd-link-acoes"></div>');
      if(x.url) {try {const u=new URL(x.url);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password) {const a=el('<a class="btn ghost mini" target="_blank" rel="noopener noreferrer">Abrir ↗</a>');a.href=u.href;a.setAttribute('aria-label','Abrir '+(x.nome||'link')+' em nova aba');acoes.appendChild(a);}} catch(_){} }
      acoes.appendChild(fmDemandasBotao('Remover',()=>linha.remove()));linha.appendChild(acoes);linhasLinks.appendChild(linha);return linha;
    };
    (estado.links||[]).forEach(adicionarLink);links.lastElementChild.append(linhasLinks,fmDemandasBotao('+ Adicionar link',()=>adicionarLink().querySelector('input').focus()));form.appendChild(links);

    const arquivos=fmDemandasDetalhes('Arquivos');
    // Os botões de anexos podem nascer de uma leitura assíncrona. Nenhum deles
    // deve acionar o submit do formulário da demanda por comportamento nativo.
    arquivos.addEventListener('click',e=>{if(e.target.closest('button'))e.preventDefault();});
    if(item)arquivos.lastElementChild.appendChild(areaArquivos('obra:'+o.id+':demanda:'+item.id,'Adicionar arquivos à demanda'));
    else arquivos.lastElementChild.appendChild(el('<p class="fmd-nota">Salve a demanda e abra seus detalhes para adicionar arquivos.</p>'));
    form.appendChild(arquivos);
    {
      const historico=fmDemandasDetalhes(item?'Histórico'+(item.historico?.length?' · '+item.historico.length:''):'Observações');
      historico.lastElementChild.appendChild(fmDemandasCampo('observacao',item?'Registrar uma observação':'Observação inicial','', 'textarea'));
      const lista=el('<ol class="fmd-historico"></ol>');
      [...(item?.historico||[])].reverse().forEach(x=>{
        const linha=el('<li><p></p><small></small></li>');linha.querySelector('p').textContent=x.texto||'';
        const data=new Date(x.em);linha.querySelector('small').textContent=[Number.isNaN(+data)?'':data.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}),x.autor||'Usuário'].filter(Boolean).join(' · ');lista.appendChild(linha);
      });
      if(!lista.children.length)historico.lastElementChild.appendChild(el('<p class="fmd-nota">As alterações ficam registradas aqui.</p>'));else historico.lastElementChild.appendChild(lista);
      form.appendChild(historico);
    }
    const erro=el('<p class="fmd-erro" role="alert" hidden></p>'), rodape=el('<div class="fmd-editor-acoes"></div>'), gravar=el('<button type="submit" class="btn">Salvar demanda</button>');
    rodape.append(fmDemandasBotao('Cancelar',fechar),gravar);form.append(erro,rodape);corpo.appendChild(form);
    ler=()=>{
      const valores={};['titulo','situacao','etapaId','responsavel','prazo','motivoBloqueio','aguardandoQuem','retornoPendente','descricao','proximaAcao','envolvidos','prioridade','observacao'].forEach(k=>{const campo=form.querySelector('[name='+k+']');if(campo)valores[k]=campo.value;});
      valores.checklist=[...linhasChecklist.children].map(l=>({id:l.dataset.id||undefined,texto:l.querySelector('[type=text]').value,feito:l.querySelector('[type=checkbox]').checked}));
      valores.links=[...linhasLinks.children].map(l=>({id:l.dataset.id||undefined,nome:l.querySelector('[name=linkNome]').value,url:l.querySelector('[name=linkUrl]').value}));
      return valores;
    };
    inicial=JSON.stringify(ler());
    form.onsubmit=e=>{
      e.preventDefault();erro.hidden=true;
      if(!form.reportValidity())return;
      try {
        const valores=ler();valores.checklist=valores.checklist.filter(x=>x.texto.trim());valores.links=valores.links.filter(x=>x.nome.trim()||x.url.trim());
        const novos=FortemaisDemandasModelo.salvarDemanda(FortemaisDemandasModelo.dados(o),valores,item?.id,fmDemandasContexto());
        fmDemandasGravar(o,novos,base);salvo=true;aoSalvar();fechar();
      } catch(e) {erro.textContent=e.message||'Não foi possível salvar a demanda.';erro.hidden=false;erro.scrollIntoView({block:'nearest'});}
    };
  },null,{recarregar:false,antesFechar:()=>salvo||JSON.stringify(ler())===inicial||confirm('Descartar as alterações desta demanda?')});
}

function fmDemandasEditarEtapas(o,aoSalvar) {
  const base=fmDemandasBase(o), dados=FortemaisDemandasModelo.dados(o);
  let salvo=false,ler=()=>[],inicial='';
  abrirModal('Organizar etapas','As etapas agrupam demandas da obra. Você pode começar sem etapas.',(corpo,fechar)=>{
    corpo.classList.add('fmd-editor');const form=el('<form class="fmd-form fmd-etapas-editor"></form>'),lista=el('<div class="fmd-etapas-lista"></div>');
    const adicionar=(x={})=>{
      const linha=el('<div class="fmd-etapa-linha"><input type="text" aria-label="Nome da etapa" placeholder="Nome da etapa" maxlength="100" required></div>');linha.dataset.id=x.id||'';linha.querySelector('input').value=x.nome||'';
      linha.appendChild(fmDemandasBotao('Remover',()=>{
        const n=dados.itens.filter(i=>i.etapaId===x.id&&x.id).length;
        if(n&&!confirm('Remover esta etapa? '+n+' '+(n===1?'demanda será mantida':'demandas serão mantidas')+' em “Sem etapa”.'))return;
        linha.remove();
      }));lista.appendChild(linha);return linha;
    };
    dados.etapas.forEach(adicionar);
    const acoes=el('<div class="fmd-acoes"></div>');acoes.append(fmDemandasBotao('+ Adicionar etapa',()=>adicionar().querySelector('input').focus()));
    const sugestoes=fmDemandasBotao('Usar 5 etapas sugeridas',()=>{
      const nomes=new Set([...lista.querySelectorAll('input')].map(x=>x.value.trim().toLocaleLowerCase('pt-BR')));
      ['Documentação e regularização','Projetos e aprovações','Contratações','Execução e acabamentos','Entrega e encerramento'].forEach(nome=>{if(!nomes.has(nome.toLocaleLowerCase('pt-BR')))adicionar({nome});});
    });acoes.appendChild(sugestoes);
    const erro=el('<p class="fmd-erro" role="alert" hidden></p>'),rodape=el('<div class="fmd-editor-acoes"></div>');rodape.append(fmDemandasBotao('Cancelar',fechar),el('<button type="submit" class="btn">Salvar etapas</button>'));
    form.append(el('<p class="fmd-nota">Crie as etapas que fazem sentido para esta obra. A sugestão adiciona apenas nomes de etapas.</p>'),lista,acoes,erro,rodape);corpo.appendChild(form);
    ler=()=>[...lista.children].map(l=>({id:l.dataset.id||undefined,nome:l.querySelector('input').value}));inicial=JSON.stringify(ler());
    form.onsubmit=e=>{e.preventDefault();erro.hidden=true;if(!form.reportValidity())return;try {
      fmDemandasGravar(o,FortemaisDemandasModelo.salvarEtapas(FortemaisDemandasModelo.dados(o),ler(),fmDemandasContexto()),base);salvo=true;aoSalvar();fechar();
    }catch(e){erro.textContent=e.message||'Não foi possível salvar as etapas.';erro.hidden=false;}};
  },null,{recarregar:false,antesFechar:()=>salvo||JSON.stringify(ler())===inicial||confirm('Descartar as alterações das etapas?')});
}

function fmDemandasPainel(o) {
  const sec=el('<section class="fmd-painel" aria-label="Demandas e etapas"><header class="fmd-cab"><div><h3>Demandas e etapas</h3><p class="fmd-nota">O que precisa avançar nesta obra, organizado por etapa.</p></div><div class="fmd-acoes"></div></header><div class="fmd-resumos" aria-label="Filtrar demandas pelo resumo"></div><p class="fmd-legenda">Atrasadas e bloqueadas também fazem parte das demandas abertas.</p><div class="fmd-filtros"></div><div class="fmd-aviso" role="status" aria-live="polite" hidden></div><div class="fmd-listagem"></div></section>');
  const valores={texto:'',etapa:'',responsavel:'',situacao:'',resumo:''}, abertos=new Set(), resumos=sec.querySelector('.fmd-resumos'), filtros=sec.querySelector('.fmd-filtros'), lista=sec.querySelector('.fmd-listagem'),aviso=sec.querySelector('.fmd-aviso');
  let desfazer=null;
  const opcoes=(select,opts)=>{const valor=select.value;select.replaceChildren();opts.forEach(([v,t])=>{const opt=document.createElement('option');opt.value=v;opt.textContent=t;select.appendChild(opt);});select.value=opts.some(x=>x[0]===valor)?valor:'';};
  const texto=fmDemandasCampo('texto','Buscar demanda','','search');texto.classList.add('fmd-busca');texto.querySelector('input').placeholder='Título, descrição ou pessoa…';
  const etapa=fmDemandasCampo('etapa','Etapa','','select',[['','Todas as etapas']]),resp=fmDemandasCampo('responsavel','Responsável','','select',[['','Todos os responsáveis']]),situacao=fmDemandasCampo('situacao','Situação','','select',[['','Todas as situações'],...FMD_SITUACOES.map(x=>[x,x])]);
  const limpar=fmDemandasBotao('Limpar filtros',()=>{Object.keys(valores).forEach(k=>valores[k]='');filtros.querySelectorAll('input,select').forEach(x=>x.value='');pintarLista();});limpar.classList.add('fmd-limpar');
  filtros.append(texto,etapa,resp,situacao,limpar);
  filtros.querySelectorAll('input,select').forEach(input=>input.addEventListener(input.tagName==='INPUT'?'input':'change',()=>{valores[input.name]=input.value;if(input.name==='situacao')valores.resumo='';pintarLista();}));
  const resumoBotoes={};
  [['abertas','Abertas'],['atrasadas','Atrasadas'],['bloqueadas','Bloqueadas'],['resolvidas','Resolvidas']].forEach(([key,nome])=>{
    const b=el('<button type="button" class="fmd-resumo"><span></span><b>0</b></button>');b.dataset.resumo=key;b.firstElementChild.textContent=nome;
    b.onclick=()=>{valores.resumo=valores.resumo===key?'':key;valores.situacao='';situacao.querySelector('select').value='';pintarLista();};resumoBotoes[key]=b;resumos.appendChild(b);
  });
  function mensagem(texto,undo) {
    aviso.replaceChildren();aviso.hidden=!texto;if(!texto)return;
    aviso.appendChild(document.createTextNode(texto));
    if(undo)aviso.appendChild(fmDemandasBotao('Desfazer',()=>{
      try{undo();desfazer=null;mensagem('A resolução foi desfeita.');atualizar();}catch(e){mensagem(e.message);}
    }));
  }
  function mudarSituacao(item,nova,base) {
    const antes=item.situacao;
    try {
      const novos=FortemaisDemandasModelo.situacao(FortemaisDemandasModelo.dados(o),item.id,nova,fmDemandasContexto());
      fmDemandasGravar(o,novos,base);const depois=fmDemandasBase(o);
      desfazer=nova==='Resolvida'?()=>{fmDemandasGravar(o,FortemaisDemandasModelo.situacao(FortemaisDemandasModelo.dados(o),item.id,antes,fmDemandasContexto()),depois);}:null;
      atualizar();mensagem(nova==='Resolvida'?'Demanda resolvida.':'Demanda reaberta.',desfazer);
      aviso.querySelector('button')?.focus({preventScroll:true});
    }catch(e){mensagem(e.message);}
  }
  function cartao(item) {
    const base=fmDemandasBase(o),atrasada=FortemaisDemandasModelo.atrasada(item,hoje()), artigo=el('<article class="fmd-card '+(FMD_CLASSES[item.situacao]||'fmd-fazer')+'"></article>');artigo.dataset.demandaId=item.id;
    const abrir=el('<button type="button" class="fmd-card-abre"></button>');abrir.setAttribute('aria-label','Abrir demanda: '+item.titulo);
    const topo=el('<div class="fmd-card-topo"><span class="fmd-badge"></span><span class="fmd-marcadores"></span></div>');topo.firstElementChild.textContent=item.situacao;
    if(item.prioridade==='alta')topo.lastElementChild.appendChild(el('<span class="fmd-prioridade">Alta prioridade</span>'));
    if(atrasada)topo.lastElementChild.appendChild(el('<span class="fmd-atrasada">Atrasada</span>'));
    const titulo=el('<h4></h4>');titulo.textContent=item.titulo;
    const meta=el('<div class="fmd-card-meta"><span></span><span></span></div>');meta.firstElementChild.textContent=item.responsavel||'Sem responsável';meta.firstElementChild.title='Responsável';meta.lastElementChild.textContent=item.prazo?'Prazo '+fmtDataAno(item.prazo):'Sem prazo';meta.lastElementChild.classList.toggle('fmd-texto-alerta',atrasada);
    abrir.append(topo,titulo,meta);abrir.onclick=()=>fmDemandasEditor(o,item,()=>{mensagem('Demanda salva.');atualizar();});
    const rodape=el('<div class="fmd-card-acoes"></div>'),resolve=fmDemandasBotao(item.situacao==='Resolvida'?'Reabrir':'Resolver',()=>mudarSituacao(item,item.situacao==='Resolvida'?'A fazer':'Resolvida',base));
    resolve.setAttribute('aria-label',(item.situacao==='Resolvida'?'Reabrir demanda: ':'Resolver demanda: ')+item.titulo);rodape.appendChild(resolve);artigo.append(abrir,rodape);return artigo;
  }
  function pintarLista() {
    const dados=FortemaisDemandasModelo.dados(o),contagem=FortemaisDemandasModelo.resumo(dados,hoje());
    Object.entries(resumoBotoes).forEach(([key,b])=>{b.querySelector('b').textContent=contagem[key];b.setAttribute('aria-pressed',String(valores.resumo===key));});
    limpar.hidden=!Object.values(valores).some(Boolean);
    const itens=FortemaisDemandasModelo.filtrar(dados,valores,hoje());lista.replaceChildren();
    if(!dados.itens.length) {
      const vazio=el('<div class="fmd-vazio"><span class="fmd-vazio-marca" aria-hidden="true">✓</span><h4>Comece pelo que precisa avançar</h4><p>Adicione uma demanda para organizar responsáveis, prazos e próximos passos desta obra.</p></div>');
      vazio.appendChild(fmDemandasBotao('+ Nova demanda',()=>fmDemandasEditor(o,null,()=>{mensagem('Demanda salva.');atualizar();}),''));lista.appendChild(vazio);return;
    }
    if(!itens.length){lista.appendChild(el('<div class="fmd-vazio fmd-sem-resultados"><h4>Nenhuma demanda neste filtro</h4><p>Ajuste a busca ou limpe os filtros para ver outras demandas.</p></div>'));return;}
    const grupos=[...dados.etapas.map(x=>({id:x.id,nome:x.nome})),{id:'',nome:'Sem etapa'}];
    const conhecidos=new Set(grupos.map(x=>x.id));if(itens.some(x=>x.etapaId&&!conhecidos.has(x.etapaId)))grupos.push({id:'fmd-sem-etapa-existente',nome:'Etapa não encontrada'});
    grupos.forEach(et=>{
      const pertence=x=>et.id==='fmd-sem-etapa-existente'?!conhecidos.has(x.etapaId):(x.etapaId||'')===et.id;
      const daEtapa=itens.filter(pertence);if(!daEtapa.length)return;
      const abertas=daEtapa.filter(x=>x.situacao!=='Resolvida'),resolvidas=daEtapa.filter(x=>x.situacao==='Resolvida');
      const totalEtapa=dados.itens.filter(pertence),concluidas=totalEtapa.filter(x=>x.situacao==='Resolvida').length,pendentes=totalEtapa.length-concluidas;
      const grupo=el('<section class="fmd-etapa"><header class="fmd-etapa-cab"><h4></h4><span></span></header></section>');grupo.querySelector('h4').textContent=et.nome;grupo.querySelector('.fmd-etapa-cab>span').textContent=pendentes+' '+(pendentes===1?'aberta':'abertas')+' · '+concluidas+' de '+totalEtapa.length+' demandas resolvidas';
      if(abertas.length){const grade=el('<div class="fmd-cards"></div>');abertas.forEach(x=>grade.appendChild(cartao(x)));grupo.appendChild(grade);}
      if(resolvidas.length) {
        const resolvido=el('<details class="fmd-resolvidas"><summary></summary><div class="fmd-cards"></div></details>');resolvido.querySelector('summary').textContent='Resolvidas ('+resolvidas.length+')';
        resolvido.open=valores.resumo==='resolvidas'||valores.situacao==='Resolvida'||abertos.has(et.id);resolvido.ontoggle=()=>{if(resolvido.open)abertos.add(et.id);else abertos.delete(et.id);};resolvidas.forEach(x=>resolvido.lastElementChild.appendChild(cartao(x)));grupo.appendChild(resolvido);
      }
      lista.appendChild(grupo);
    });
  }
  function atualizar() {
    const dados=FortemaisDemandasModelo.dados(o),responsaveis=[...new Set(dados.itens.map(x=>x.responsavel).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    opcoes(etapa.querySelector('select'),[['','Todas as etapas'],['sem-etapa','Sem etapa'],...dados.etapas.map(x=>[x.id,x.nome])]);
    opcoes(resp.querySelector('select'),[['','Todos os responsáveis'],['sem-responsavel','Sem responsável'],...responsaveis.map(x=>[x,x])]);
    valores.etapa=etapa.querySelector('select').value;valores.responsavel=resp.querySelector('select').value;pintarLista();fmDemandasAtualizarResumo(o);
  }
  sec.querySelector('.fmd-cab .fmd-acoes').append(fmDemandasBotao('Organizar etapas',()=>fmDemandasEditarEtapas(o,()=>{mensagem('Etapas salvas.');atualizar();})),fmDemandasBotao('+ Nova demanda',()=>fmDemandasEditor(o,null,()=>{mensagem('Demanda salva.');atualizar();}),''));
  atualizar();return sec;
}
