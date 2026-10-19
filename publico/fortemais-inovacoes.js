/* Caderno privado da Fortemais. Uma ideia é registrada uma vez, fora das obras. */
const FMI_ROTULOS = {'Para avaliar':'Para avaliar','Aplicar nas próximas obras':'Próximas obras','Adotada':'Adotada','Arquivada':'Arquivada'};

function fmInovacoesDados() {
  FortemaisInovacoesModelo.validar(E.fortemaisInovacoes);
  return E.fortemaisInovacoes || [];
}
function fmInovacoesBase() {
  return {estado:E,referencia:E.fortemaisInovacoes,texto:JSON.stringify(E.fortemaisInovacoes),tinha:Object.hasOwn(E,'fortemaisInovacoes')};
}
function fmGravarInovacoes(lista,base=fmInovacoesBase()) {
  if(E!==base.estado||E.fortemaisInovacoes!==base.referencia||JSON.stringify(E.fortemaisInovacoes)!==base.texto)
    throw Error('As inovações foram atualizadas enquanto você editava. Seu rascunho foi mantido; confira os dados e reabra a edição.');
  FortemaisInovacoesModelo.validar(lista);
  if(lista===E.fortemaisInovacoes)return lista;
  const mt=E._mt,tinhaMt=Object.hasOwn(E,'_mt');
  E.fortemaisInovacoes=lista;
  try{salvar()}catch(e){
    if(base.tinha)E.fortemaisInovacoes=base.referencia;else delete E.fortemaisInovacoes;
    if(tinhaMt)E._mt=mt;else delete E._mt;
    throw Error('Não foi possível salvar. Os dados anteriores e seu rascunho foram mantidos. Tente novamente.');
  }
  return lista;
}
function fmInovacoesContexto(base) {
  return {now:new Date().toISOString(),uid:()=>uid(),autor:'Usuário',...(base?{base}:{})};
}
function fmInovacoesBotao(texto,click,classe='ghost') {
  const b=el('<button type="button" class="btn"></button>');b.textContent=texto;
  if(classe)b.classList.add(classe);b.onclick=click;return b;
}
function fmInovacoesNavegacao(m,visao,recarregar) {
  const nav=el('<nav class="fm-visoes" aria-label="Áreas da Fortemais"></nav>');
  let aAplicar=0;try{aAplicar=FortemaisInovacoesModelo.resumo(fmInovacoesDados()).aAplicar}catch(e){}
  for(const [id,nome] of [['obras','Obras'],['inovacoes','Inovações'],['ferramentas','Ferramentas de IA'],['dicas','Dicas de obra']]){
    const b=fmInovacoesBotao(nome,()=>{
      if(id===visao)return;
      if([...m.querySelectorAll('[data-fm-pagina]')].some(p=>p._fmDirty)){
        alert('Salve ou cancele as alterações antes de trocar de aba.');return;
      }
      filtro.fmVisao=id;recarregar();
    },'');
    b.dataset.fmVisao=id;b.setAttribute('aria-pressed',String(id===visao));
    if(id==='inovacoes'){
      const n=el('<span class="fmi-contagem"></span>');n.textContent=aAplicar;
      n.hidden=!aAplicar;
      n.title=aAplicar+' para aplicar nas próximas obras';b.appendChild(n);
    }
    nav.appendChild(b);
  }
  return nav;
}
function fmInovacoesCampo(nome,rotulo,valor,tipo='text',maximo) {
  const label=el('<label class="fmi-campo"><span></span></label>');
  label.firstElementChild.textContent=rotulo;
  const input=tipo==='textarea'?el('<textarea rows="3"></textarea>'):tipo==='select'?el('<select></select>'):el('<input>');
  input.name=nome;
  if(tipo==='select')for(const s of FortemaisInovacoesModelo.SITUACOES){
    const option=el('<option></option>');option.value=s;option.textContent=s;option.selected=s===valor;input.appendChild(option);
  }
  else if(tipo!=='textarea')input.type=tipo;
  if(maximo)input.maxLength=maximo;
  input.value=valor||'';label.appendChild(input);return label;
}
function fmInovacoesHistorico(item) {
  const detalhes=el('<details class="fmi-historico"><summary>Histórico de alterações</summary><ol></ol></details>');
  for(const registro of [...(item.historico||[])].reverse()){
    const li=el('<li><span></span><p></p></li>');
    li.firstElementChild.textContent=new Date(registro.em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})+' · '+registro.autor;
    li.lastElementChild.textContent=registro.texto;detalhes.lastElementChild.appendChild(li);
  }
  return detalhes;
}
function fmInovacoesEditor(item,aoSalvar) {
  let lista;try{lista=fmInovacoesDados()}catch(e){alert(e.message);return}
  if(item&&!lista.includes(item)){alert('Esta inovação mudou. Reabra a ficha para continuar.');return}
  const base=fmInovacoesBase(),estado=item?structuredClone(item):{situacao:'Para avaliar'};
  let salvo=false,mudou=()=>false;
  abrirModal(item?'Editar inovação':'Nova inovação','Guarde o que descobriu e como pretende usar nas próximas obras.',(corpo,fechar)=>{
    corpo.classList.add('fmi-editor');
    const form=el('<form class="fmi-form"></form>');
    const titulo=fmInovacoesCampo('titulo','O que você descobriu?',estado.titulo,'text',160);
    titulo.querySelector('input').required=true;titulo.querySelector('input').placeholder='Dê um título à ideia';
    const grade=el('<div class="fmi-form-grade"></div>');
    const etapa=fmInovacoesCampo('etapa','Etapa ou área da obra',estado.etapa,'text',80),opcoes=el('<datalist></datalist>');
    opcoes.id=uid();etapa.querySelector('input').setAttribute('list',opcoes.id);
    etapa.querySelector('input').placeholder='Ex.: Projeto, Elétrica, Acabamentos';
    for(const nome of CFG('especialidades')||[]){const o=el('<option></option>');o.value=nome;opcoes.appendChild(o)}
    etapa.appendChild(opcoes);grade.append(etapa,fmInovacoesCampo('situacao','Situação',estado.situacao,'select'));
    const descricao=fmInovacoesCampo('descricao','Descoberta e benefício esperado',estado.descricao,'textarea',6000);
    descricao.querySelector('textarea').placeholder='O que é e por que vale considerar?';
    const aplicacao=fmInovacoesCampo('aplicacao','Onde e como aplicar nas próximas obras',estado.aplicacao,'textarea',3000);
    aplicacao.querySelector('textarea').placeholder='Ambiente, serviço ou cuidado a revisar no próximo projeto';
    const referencia=fmInovacoesCampo('referencia','Link de referência (opcional)',estado.referencia,'url',2000);
    referencia.querySelector('input').placeholder='https://…';referencia.querySelector('input').inputMode='url';
    form.append(titulo,grade,descricao,aplicacao,referencia);
    const erro=el('<p class="fmi-erro" role="alert" tabindex="-1" hidden></p>'),acoes=el('<div class="fmi-form-acoes"></div>');
    const submit=el('<button type="submit" class="btn">Salvar inovação</button>');
    acoes.append(submit,fmInovacoesBotao('Cancelar',fechar));
    form.append(erro,acoes);corpo.appendChild(form);
    if(item?.historico?.length)corpo.appendChild(fmInovacoesHistorico(item));
    const ler=()=>Object.fromEntries(['titulo','descricao','aplicacao','etapa','referencia','situacao'].map(k=>[k,form.querySelector('[name="'+k+'"]').value]));
    const inicial=JSON.stringify(ler());mudou=()=>JSON.stringify(ler())!==inicial;
    form.onsubmit=e=>{
      e.preventDefault();if(salvo)return;
      try{
        const novos=FortemaisInovacoesModelo.salvar(fmInovacoesDados(),ler(),item?.id,fmInovacoesContexto(item?estado:null));
        fmGravarInovacoes(novos,base);salvo=true;submit.disabled=true;
      }catch(ex){erro.hidden=false;erro.textContent=ex.message;erro.focus();return}
      fechar();if(aoSalvar)aoSalvar();
    };
  },null,{recarregar:false,antesFechar:()=>salvo||!mudou()||confirm('Descartar as alterações não salvas desta inovação?')});
}
function fmInovacoesPainel() {
  const sec=el('<section class="fmi-painel" aria-label="Inovações da Fortemais"></section>');
  const cab=el('<header class="fmi-cab"><div><h2>Inovações</h2><p>O que aprender hoje pode melhorar a próxima obra.</p></div></header>');
  sec.appendChild(cab);
  try{fmInovacoesDados()}catch(e){
    const erro=el('<p class="fmi-erro" role="alert"></p>');erro.textContent='Não foi possível ler as inovações. Os dados anteriores foram mantidos. Confira seu backup antes de continuar.';sec.appendChild(erro);return sec;
  }
  const valores=filtro.fmInovacoes||(filtro.fmInovacoes={texto:'',situacao:'ativas',etapa:''});
  const aviso=el('<p class="fmi-aviso" role="status" hidden></p>');
  cab.appendChild(fmInovacoesBotao('+ Nova inovação',()=>fmInovacoesEditor(null,()=>atualizar('Inovação salva neste navegador. Acompanhe a sincronização no topo da Central.')),''));
  const chips=el('<div class="fmi-situacoes" role="group" aria-label="Filtrar inovações por situação"></div>');
  const defs=[['ativas','Em acompanhamento','ativas'],['Para avaliar','Para avaliar','avaliar'],['Aplicar nas próximas obras','Próximas obras','aAplicar'],['Adotada','Adotadas','adotadas'],['Arquivada','Arquivadas','arquivadas']];
  for(const [situacao,rotulo,chave] of defs){
    const b=fmInovacoesBotao(rotulo,()=>{valores.situacao=situacao;atualizar()});
    b.dataset.fmiSituacao=situacao;b.dataset.fmiResumo=chave;
    const n=el('<b></b>');b.appendChild(n);chips.appendChild(b);
  }
  const filtros=el('<div class="fmi-filtros"><label><span>Buscar</span><input name="texto" type="search" placeholder="Buscar descoberta, benefício ou aplicação"></label><label><span>Etapa ou área</span><select name="etapa" aria-label="Filtrar por etapa"><option value="">Todas as etapas</option></select></label></div>');
  const busca=filtros.querySelector('input'),etapa=filtros.querySelector('select');
  busca.value=valores.texto;busca.oninput=()=>{valores.texto=busca.value;atualizar()};
  etapa.onchange=()=>{valores.etapa=etapa.value;atualizar()};
  const limpar=fmInovacoesBotao('Limpar filtros',()=>{valores.texto='';valores.etapa='';valores.situacao='ativas';busca.value='';atualizar()});filtros.appendChild(limpar);
  const contagem=el('<p class="fmi-resultado" role="status"></p>'),lista=el('<div class="fmi-lista"></div>');
  sec.append(aviso,chips,filtros,contagem,lista);
  function cartao(item) {
    const artigo=el('<article class="fmi-item"><details class="fmi-detalhe"><summary><span class="fmi-item-titulo"></span><span class="fmi-item-meta"></span><span class="fmi-expandir">Ver detalhes</span></summary><div class="fmi-item-corpo"></div></details><div class="fmi-item-acoes"></div></article>');
    artigo.dataset.inovacaoId=item.id;
    const detalhes=artigo.querySelector('.fmi-detalhe');
    detalhes.ontoggle=()=>{artigo.querySelector('.fmi-expandir').textContent=detalhes.open?'Recolher detalhes':'Ver detalhes'};
    artigo.querySelector('.fmi-item-titulo').textContent=item.titulo;
    const meta=artigo.querySelector('.fmi-item-meta'),badge=el('<span class="fmi-etiqueta"></span>');
    badge.textContent=FMI_ROTULOS[item.situacao];badge.title=item.situacao;meta.appendChild(badge);
    if(item.etapa){const e=el('<span></span>');e.textContent=item.etapa;meta.appendChild(e)}
    const data=el('<span></span>');data.textContent='Atualizada em '+new Date(item.atualizadoEm).toLocaleDateString('pt-BR');meta.appendChild(data);
    const corpo=artigo.querySelector('.fmi-item-corpo'),dl=el('<dl></dl>');
    for(const [campo,rotulo] of [['descricao','Descoberta e benefício esperado'],['aplicacao','Onde e como aplicar']]){
      const bloco=el('<div><dt></dt><dd></dd></div>');bloco.firstElementChild.textContent=rotulo;bloco.lastElementChild.textContent=item[campo]||'Ainda não informado.';dl.appendChild(bloco);
    }
    corpo.appendChild(dl);
    if(item.referencia){
      const a=el('<a class="btn ghost" target="_blank" rel="noopener noreferrer">Abrir referência ↗</a>');
      a.href=item.referencia;a.setAttribute('aria-label','Abrir referência de '+item.titulo+' em outra aba');corpo.appendChild(a);
    }
    if(item.historico?.length)corpo.appendChild(fmInovacoesHistorico(item));
    const acoes=artigo.querySelector('.fmi-item-acoes');
    const editar=fmInovacoesBotao('Editar',()=>fmInovacoesEditor(item,()=>atualizar('Inovação salva neste navegador. Acompanhe a sincronização no topo da Central.')));
    editar.setAttribute('aria-label','Editar inovação: '+item.titulo);acoes.appendChild(editar);
    if(item.situacao!=='Arquivada'){
      const arquivar=fmInovacoesBotao('Arquivar',()=>{
        try{
          const base=fmInovacoesBase();
          const novos=FortemaisInovacoesModelo.salvar(fmInovacoesDados(),{situacao:'Arquivada'},item.id,fmInovacoesContexto(item));
          fmGravarInovacoes(novos,base);atualizar('Inovação arquivada. Ela continua no filtro Arquivadas e pode ser reaberta em Editar.');
        }catch(e){atualizar(e.message)}
      });
      arquivar.setAttribute('aria-label','Arquivar inovação: '+item.titulo);acoes.appendChild(arquivar);
    }
    return artigo;
  }
  function atualizar(texto) {
    if(texto){aviso.hidden=false;aviso.textContent=texto}
    let dados;try{dados=fmInovacoesDados()}catch(e){contagem.textContent='As inovações estão indisponíveis. Reabra a aba para conferir os dados.';lista.replaceChildren();return}
    const resumo=FortemaisInovacoesModelo.resumo(dados);resumo.ativas=resumo.total-resumo.arquivadas;
    chips.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(valores.situacao===b.dataset.fmiSituacao));b.querySelector('b').textContent=resumo[b.dataset.fmiResumo]});
    const etapas=[...new Set(dados.map(x=>x.etapa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(valores.etapa&&!etapas.includes(valores.etapa))etapas.push(valores.etapa);
    etapa.replaceChildren(el('<option value="">Todas as etapas</option>'));
    for(const nome of etapas){const o=el('<option></option>');o.value=nome;o.textContent=nome;etapa.appendChild(o)}etapa.value=valores.etapa;
    const encontrados=FortemaisInovacoesModelo.filtrar(dados,{...valores,situacao:valores.situacao==='ativas'?'':valores.situacao}).filter(x=>valores.situacao!=='ativas'||x.situacao!=='Arquivada');
    lista.replaceChildren();contagem.textContent=encontrados.length+' de '+dados.length+' '+(dados.length===1?'inovação':'inovações');
    limpar.hidden=!valores.texto&&!valores.etapa&&valores.situacao==='ativas';
    for(const item of encontrados)lista.appendChild(cartao(item));
    if(!encontrados.length){
      const vazio=el('<div class="fmi-vazio"><h3></h3><p></p></div>');
      vazio.firstElementChild.textContent=dados.length?'Nenhuma inovação neste filtro':'Uma descoberta hoje, uma obra melhor amanhã';
      vazio.lastElementChild.textContent=dados.length?'Ajuste a busca ou os filtros para consultar suas ideias.':'Use Nova inovação para guardar um material, solução ou cuidado que quer levar para as próximas obras.';
      lista.appendChild(vazio);
    }
    const n=document.querySelector('.fm-visoes [data-fm-visao="inovacoes"] .fmi-contagem');
    if(n){n.textContent=resumo.aAplicar;n.hidden=!resumo.aAplicar;n.title=resumo.aAplicar+' para aplicar nas próximas obras'}
  }
  atualizar();return sec;
}
