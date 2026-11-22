/* Biblioteca esportiva. Conteúdo editorial e consultas públicas, sem dados clínicos. */
var SaudeEsportesUI={modalidade:'',secao:'training',busca:''};
var _saudeEsportesInstancia=0;

function saudeEsportes(){
  const dados=typeof SaudeEsportesDados==='object'&&SaudeEsportesDados?SaudeEsportesDados:{};
  const guias=typeof SaudeEsportesGuias==='object'?SaudeEsportesGuias:{};
  const complementos=typeof SaudeEsportesGuiasComplementos==='object'?SaudeEsportesGuiasComplementos:{};
  const modalidades=(Array.isArray(dados.modalities)?dados.modalities:[]).map(m=>({...m,...(complementos[m.id]||{}),...(m.id==='musculacao'&&typeof SaudeEsportesForcaComplementos==='object'?SaudeEsportesForcaComplementos:{}),training:m.id==='musculacao'&&typeof SaudeEsportesForca!=='undefined'?SaudeEsportesForca:guias[m.id]||m.training}));
  const fontes={...(dados.sources||{}),...(typeof SaudeEsportesGuiasFontes==='object'?SaudeEsportesGuiasFontes:{}),...(typeof SaudeEsportesForcaFontes==='object'?SaudeEsportesForcaFontes:{})};
  const secoes=[['training','Praticar'],['glossary','Vocabulário'],['gear','Equipamentos'],['care','Cuidados'],['studies','Estudos']];
  const prefixo='esp-'+(++_saudeEsportesInstancia);
  const raiz=no('section','esp-biblioteca');
  raiz.dataset.esportes='biblioteca';
  raiz.setAttribute('aria-label','Biblioteca de esportes');
  let ocupado=false,feedback='',erroLocal='';
  let tenisEdicao=null,tenisAviso='',tenisErro='',tenisConfirmar='',tenisProcessando=false,tenisFotoVersao=0;

  function no(tag,classe,texto){const n=document.createElement(tag);if(classe)n.className=classe;if(texto!=null)n.textContent=String(texto);return n}
  function lista(valor){return Array.isArray(valor)?valor:[]}
  function normalizar(valor){return String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
  function corresponde(valor){return normalizar(valor).includes(normalizar(SaudeEsportesUI.busca.trim()))}
  function textoItem(item){return typeof item==='string'?item:[item?.title,item?.text,item?.cue,item?.care,item?.label,item?.application,item?.limitation,item?.authors,item?.journal,item?.year,item?.brand,item?.name,item?.category,item?.use,item?.limit,item?.muscles,item?.explanation,item?.breathing,item?.dose,item?.progression,item?.stop,item?.notes,...lista(item?.setup),...lista(item?.steps),...lista(item?.adaptations),...lista(item?.examples),...lista(item?.selection),...lista(item?.commonMistakes),...lista(item?.checks),...lista(item?.alternatives)].filter(Boolean).join(' ')}
  function data(valor,comHora=false){
    if(!valor)return 'Ainda não consultado';
    const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(valor))?valor+'T12:00:00':valor);
    if(!Number.isFinite(d.getTime()))return 'Data não informada';
    return d.toLocaleDateString('pt-BR')+(comHora?' às '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'');
  }
  function modelo(){return typeof SaudeEsportesModelo==='object'&&SaudeEsportesModelo?SaudeEsportesModelo:null}
  function consulta(id){try{return modelo()?.get(id)||{items:[],checkedAt:'',error:'',loading:false}}catch(e){return{items:[],checkedAt:'',error:'Não foi possível ler as consultas salvas.',loading:false}}}
  function modalidadeAtual(){return modalidades.find(m=>m.id===SaudeEsportesUI.modalidade)}
  function botao(rotulo,fn,classe=''){const b=no('button','esp-botao '+classe,rotulo);b.type='button';b.onclick=fn;return b}
  function urlSegura(valor){try{const u=new URL(String(valor));return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return ''}}
  function link(rotulo,url){const href=urlSegura(url);if(!href)return no('span','esp-link-invalido',rotulo);const a=no('a','esp-link',rotulo);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}
  function tag(texto,classe=''){return no('span','esp-tag '+classe,texto)}
  function estadoVazio(titulo,texto){const v=no('div','esp-vazio');v.append(no('strong','',titulo),no('p','',texto));return v}
  function imagem(src,alt,classe){const img=no('img',classe);img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.width=1672;img.height=941;return img}
  function origemImagem(m){return m.image||'assets/esportes/'+String(m.id).replace(/[^a-z0-9-]/g,'')+'.webp'}
  function visualItem(item,index,m,secao){
    const chave=m.id+'/'+secao+'/'+index;
    return typeof SaudeEsportesVisuais==='object'?SaudeEsportesVisuais[chave]:null;
  }
  function idsFontes(m){return [...new Set([...lista(m.sources),...['training','glossary','gear'].flatMap(k=>lista(m[k]).flatMap(x=>lista(x.sources)))])].filter(id=>fontes[id])}
  function referencias(ids){
    const encontrados=lista(ids).filter(id=>fontes[id]);if(!encontrados.length)return null;
    const box=no('div','esp-referencias');box.append(no('span','esp-referencias-rotulo','Fontes:'));
    encontrados.forEach(id=>box.append(link(fontes[id].label||id,fontes[id].url)));return box;
  }
  function inventarioModelo(){return typeof SaudeEsportesTenis==='object'&&SaudeEsportesTenis?SaudeEsportesTenis:null}
  function abrirTenis(item,modalidade){
    tenisEdicao=item?{id:item.id,brand:item.brand,model:item.model,modality:item.modality,photo:item.photo}:{brand:'',model:'',modality:modalidade||'',photo:''};
    tenisAviso='';tenisErro='';tenisConfirmar='';tenisProcessando=false;tenisFotoVersao++;renderizar();focar('[data-esp-tenis-form] [name=brand]');
  }
  function fecharTenis(){tenisEdicao=null;tenisErro='';tenisProcessando=false;tenisFotoVersao++;renderizar();focar('[data-esp-tenis-add]')}
  function formTenis(){
    const draft=tenisEdicao,form=no('form','esp-tenis-form');form.dataset.espTenisForm='';form.noValidate=true;
    form.append(no('h4','',draft.id?'Editar tênis':'Adicionar um tênis'));
    const campos=no('div','esp-tenis-campos');
    [['brand','Marca',80],['model','Modelo',120]].forEach(([name,label,max])=>{const l=no('label'),inp=no('input');inp.name=name;inp.type='text';inp.maxLength=max;inp.required=true;inp.value=draft[name]||'';inp.oninput=()=>{draft[name]=inp.value};l.append(no('span','',label+' *'),inp);campos.append(l)});
    const l=no('label'),select=no('select');select.name='modality';select.required=true;const vazio=no('option','','Selecione a modalidade');vazio.value='';select.append(vazio);modalidades.forEach(m=>{const o=no('option','',m.title);o.value=m.id;select.append(o)});select.value=draft.modality||'';select.onchange=()=>{draft.modality=select.value};l.append(no('span','','Uso principal *'),select);campos.append(l);form.append(campos,no('p','esp-tenis-nota','Um par pode servir a mais de um esporte. Selecione aqui o uso principal; o cadastro não avalia se o modelo é adequado para você.'));
    const foto=no('div','esp-tenis-foto-editor'),fl=no('label'),input=no('input');input.type='file';input.name='photo';input.accept='image/jpeg,image/png,image/webp';input.disabled=tenisProcessando;fl.append(no('span','','Foto opcional'),input);foto.append(fl,no('small','','JPEG, PNG ou WebP · até 5 MB. A foto será reduzida neste navegador.'));
    if(draft.photo){const img=no('img','esp-tenis-preview');img.src=draft.photo;img.alt='Foto do tênis em edição';foto.append(img);const remover=botao('Retirar foto',()=>{draft.photo='';tenisFotoVersao++;renderizar();focar('[data-esp-tenis-form] [name=photo]')},'esp-botao-suave');remover.disabled=tenisProcessando;foto.append(remover)}
    if(tenisProcessando)foto.append(no('p','esp-tenis-nota','Preparando foto…'));
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;const versao=++tenisFotoVersao;tenisProcessando=true;tenisErro='';renderizar();
      try{const photo=await inventarioModelo().preparePhoto(file);if(tenisEdicao===draft&&versao===tenisFotoVersao)draft.photo=photo}
      catch(e){if(tenisEdicao===draft&&versao===tenisFotoVersao)tenisErro=e.message||'Não foi possível preparar esta foto.'}
      finally{if(tenisEdicao===draft&&versao===tenisFotoVersao){tenisProcessando=false;renderizar();focar('[data-esp-tenis-form] [name=photo]')}}
    };
    form.append(foto);const erro=no('p','esp-erro',tenisErro);erro.setAttribute('role','alert');erro.hidden=!tenisErro;form.append(erro);
    const acoes=no('div','esp-tenis-acoes'),cancelar=botao('Cancelar',fecharTenis,'esp-botao-suave'),salvar=botao(tenisProcessando?'Preparando foto…':'Salvar neste navegador',null,'esp-botao-primario');salvar.type='submit';salvar.disabled=tenisProcessando;acoes.append(cancelar,salvar);form.append(acoes);
    form.onsubmit=e=>{e.preventDefault();if(tenisProcessando)return;try{inventarioModelo().save(draft);tenisEdicao=null;tenisErro='';tenisAviso='Salvo neste navegador.';renderizar();focar('[data-esp-tenis-add]')}catch(error){tenisErro=error.message||'Não foi possível salvar. Seu preenchimento foi mantido.';erro.textContent=tenisErro;erro.hidden=false;erro.tabIndex=-1;erro.focus()}};
    return form;
  }
  function inventarioTenis(modalidade=''){
    const sec=no('section','esp-tenis');sec.dataset.espTenis='';const cab=no('div','esp-tenis-cabecalho'),t=no('div');t.append(no('span','esp-eyebrow','SEU EQUIPAMENTO'),no('h3','','Meus tênis'));cab.append(t);
    const model=inventarioModelo(),adicionar=botao('＋ Adicionar tênis',()=>abrirTenis(null,modalidade));adicionar.dataset.espTenisAdd='';adicionar.disabled=!model;cab.append(adicionar);sec.append(cab,no('p','esp-tenis-nota','Salvo neste navegador · não sincroniza entre computador e celular. Suas fotos ficam aqui e não são publicadas.'));
    if(tenisAviso){const status=no('p','esp-feedback',tenisAviso);status.setAttribute('role','status');status.setAttribute('aria-live','polite');sec.append(status)}
    if(!model){sec.append(estadoVazio('Cadastro indisponível','Recarregue a página para abrir seu inventário local.'));return sec}
    const state=model.get();if(state.error){const error=no('p','esp-erro',state.error);error.setAttribute('role','alert');sec.append(error);adicionar.disabled=true;return sec}
    if(tenisEdicao)sec.append(formTenis());
    const items=lista(state.items).filter(item=>!modalidade||item.modality===modalidade);
    if(!items.length){sec.append(estadoVazio(modalidade?'Nenhum tênis cadastrado para esta modalidade':'Nenhum tênis cadastrado ainda','Você pode adicionar os modelos e as fotos depois. Nenhum equipamento foi presumido.'));return sec}
    const grade=no('div','esp-tenis-lista');items.forEach(item=>{
      const card=no('article','esp-tenis-card');card.dataset.espTenisItem=item.id;
      if(item.photo){const img=no('img','esp-tenis-foto');img.src=item.photo;img.alt='Foto de '+item.brand+' '+item.model;img.loading='lazy';card.append(img)}else card.append(no('div','esp-tenis-sem-foto','Sem foto'));
      const body=no('div','esp-tenis-corpo');body.append(no('small','',item.brand),no('h4','',item.model),tag(modalidades.find(m=>m.id===item.modality)?.title||item.modality));
      const acoes=no('div','esp-tenis-acoes'),editar=botao('Editar',()=>abrirTenis(item,modalidade),'esp-botao-suave'),remover=botao('Remover',()=>{tenisConfirmar=item.id;tenisErro='';renderizar();focar('[data-esp-tenis-confirm="'+item.id+'"]')},'esp-botao-suave');editar.dataset.espTenisEdit=item.id;remover.dataset.espTenisRemove=item.id;acoes.append(editar,remover);body.append(acoes);
      if(tenisConfirmar===item.id){const confirmacao=no('div','esp-tenis-confirmacao');confirmacao.append(no('p','','Remover este tênis e sua foto deste navegador?'));const sim=botao('Confirmar remoção',()=>{try{model.remove(item.id);tenisConfirmar='';tenisErro='';tenisAviso='Tênis removido deste navegador.';if(tenisEdicao?.id===item.id)tenisEdicao=null;renderizar();focar('[data-esp-tenis-add]')}catch(e){tenisErro=e.message;renderizar();focar('[data-esp-tenis-confirm="'+item.id+'"]')}},'esp-botao-remover');sim.dataset.espTenisConfirm=item.id;const nao=botao('Manter',()=>{tenisConfirmar='';tenisErro='';renderizar();focar('[data-esp-tenis-remove="'+item.id+'"]')},'esp-botao-suave');confirmacao.append(sim,nao);if(tenisErro&&!tenisEdicao){const error=no('p','esp-erro',tenisErro);error.setAttribute('role','alert');confirmacao.append(error)}body.append(confirmacao)}
      card.append(body);grade.append(card);
    });sec.append(grade);return sec;
  }
  function produtos(m,painel){
    const encontrados=lista(m.products).filter(p=>corresponde(textoItem(p)));const sec=no('section','esp-produtos');sec.append(no('h3','','Modelos para conhecer'),no('p','esp-produtos-nota','Exemplos de fabricantes para comparar categorias e uso. Não indicam que você possui esses modelos nem substituem experimentar o ajuste.'));
    if(!encontrados.length){sec.append(estadoVazio('Nenhum modelo nesta busca',SaudeEsportesUI.busca?'Tente a marca, o modelo ou a categoria.':'Os exemplos de modelos serão incluídos em uma próxima revisão.'));painel.append(sec);return}
    if(m.productsCheckedAt)sec.append(no('p','esp-produtos-data','Modelos conferidos em '+data(m.productsCheckedAt)));const grade=no('div','esp-produtos-grade');encontrados.forEach(p=>{const card=no('article','esp-produto');if(urlSegura(p.image)){const foto=imagem(p.image,p.imageAlt||p.name,'esp-produto-foto');foto.referrerPolicy='no-referrer';foto.onerror=()=>foto.replaceWith(no('p','esp-produto-foto-falha','Foto indisponível agora. Abra a página do fabricante para visualizar o modelo.'));card.append(foto)}card.append(tag(p.category||'Equipamento'),no('small','esp-produto-marca',p.brand||''),no('h4','',p.name||'Modelo'));if(p.use)card.append(no('p','',p.use));if(p.limit){const limit=no('p','esp-produto-limite');limit.append(no('strong','','Observe: '),document.createTextNode(p.limit));card.append(limit)}card.append(link('Ver no fabricante ↗',p.url));grade.append(card)});sec.append(grade,no('p','esp-produtos-creditos','Fotos oficiais dos fabricantes, carregadas de suas páginas. Cores e disponibilidade podem variar.'));painel.append(sec);
  }
  function focar(seletor){const alvo=raiz.querySelector(seletor);if(alvo&&typeof alvo.focus==='function')alvo.focus({preventScroll:true})}
  function abrir(id){SaudeEsportesUI.modalidade=id;SaudeEsportesUI.secao='training';SaudeEsportesUI.busca='';renderizar();focar('.esp-titulo-modalidade')}
  function trocarSecao(id){SaudeEsportesUI.secao=id;renderizar();focar('[data-esp-tab="'+id+'"]')}

  async function atualizar(id){
    if(ocupado)return;
    const servico=modelo(),metodo=id?'atualizar':'atualizarTodas';
    if(typeof servico?.[metodo]!=='function'){erroLocal='A consulta de estudos está indisponível. Tente novamente mais tarde.';feedback='';renderizar();return}
    ocupado=true;erroLocal='';feedback=id?'Buscando estudos de '+(modalidades.find(m=>m.id===id)?.title||'esporte')+'…':'Buscando estudos das quatro modalidades…';renderizar();
    try{
      await (id?servico.atualizar(id):servico.atualizarTodas());
      const alvo=id?modalidades.filter(m=>m.id===id):modalidades;
      const falhas=alvo.filter(m=>consulta(m.id).error);
      if(falhas.length){erroLocal=alvo.length===1?String(consulta(id).error):'A consulta não terminou para '+falhas.map(m=>m.title).join(', ')+'. Os resultados já salvos continuam disponíveis.';feedback=''}
      else{feedback=id?'Consulta concluída. Veja os resultados em Estudos.':'Consultas concluídas. Abra Estudos em cada modalidade para ver os resultados.';const avisos=[...new Set(alvo.map(m=>consulta(m.id).cacheWarning).filter(Boolean))];if(avisos.length)feedback+=' '+avisos.join(' ')}
    }catch(e){erroLocal='Não foi possível atualizar agora. Confira a conexão e tente novamente. Os resultados anteriores foram preservados.';feedback=''}
    finally{ocupado=false;renderizar();focar('[data-esp-atualizar]')}
  }
  function botaoAtualizar(id){const b=botao(ocupado?'Consultando…':'Atualizar estudos',()=>atualizar(id),'esp-botao-primario');b.dataset.espAtualizar=id||'todas';b.disabled=ocupado||!!(id&&consulta(id).loading);b.setAttribute('aria-label',id?'Atualizar estudos de '+(modalidades.find(m=>m.id===id)?.title||'esporte'):'Atualizar estudos das quatro modalidades');return b}
  function avisoAtualizacao(){
    const b=no('div','esp-feedback');b.setAttribute('role','status');b.setAttribute('aria-live','polite');b.setAttribute('aria-atomic','true');
    if(erroLocal){b.dataset.nivel='erro';b.textContent=erroLocal}else b.textContent=feedback;
    b.hidden=!b.textContent;return b;
  }
  function rodape(){
    const f=no('footer','esp-rodape');f.append(no('span','',dados.purpose||'Biblioteca educativa; exemplos não são uma prescrição individual.'),no('span','','Cenas ilustrativas geradas por IA · diagramas educativos · fotos de produtos identificadas com a fonte.'));return f;
  }
  function busca(aoBuscar){
    const barra=no('div','esp-busca-barra'),label=no('label','esp-busca');
    const input=no('input');input.type='search';input.id=prefixo+'-busca';input.value=SaudeEsportesUI.busca;input.placeholder=SaudeEsportesUI.modalidade?'Buscar nesta seção':'Buscar modalidade, exercício ou termo';input.autocomplete='off';input.setAttribute('aria-label',SaudeEsportesUI.modalidade?'Buscar na seção atual':'Buscar na biblioteca de esportes');
    label.append(no('span','esp-busca-icone','⌕'),input);barra.append(label);
    const limpar=botao('Limpar',()=>{SaudeEsportesUI.busca='';input.value='';aoBuscar();limpar.hidden=true;input.focus()},'esp-botao-suave');limpar.hidden=!input.value;barra.append(limpar);
    input.oninput=()=>{SaudeEsportesUI.busca=input.value;limpar.hidden=!input.value;aoBuscar()};return barra;
  }

  function renderizarResumo(){
    const header=no('header','esp-cabecalho'),titulos=no('div');
    titulos.append(no('span','esp-eyebrow','MOVIMENTO COM CONHECIMENTO'),no('h2','','Esportes'),no('p','','Quatro modalidades. Técnica, equipamentos e evidências para treinar com mais critério.'));
    header.append(titulos,botaoAtualizar(''));raiz.append(header,avisoAtualizacao());
    const meta=no('div','esp-meta');meta.append(tag('Conteúdo revisado'),no('span','','Revisão editorial: '+data(dados.revisedAt)));raiz.append(meta);
    const resultados=no('div','esp-resultados'),contador=no('p','esp-contador');contador.setAttribute('role','status');contador.setAttribute('aria-live','polite');
    const pintar=()=>{
      resultados.replaceChildren();
      const visiveis=modalidades.filter(m=>corresponde([m.title,m.intro,...['training','glossary','gear','care','products'].flatMap(k=>lista(m[k]).map(textoItem))].join(' ')));
      contador.textContent=SaudeEsportesUI.busca?visiveis.length+' modalidade'+(visiveis.length===1?' encontrada':'s encontradas'):'';
      if(!visiveis.length){resultados.append(estadoVazio('Nenhum resultado','Tente outro termo, como cadência, tênis, força ou trilha.'));return}
      const grade=no('div','esp-modalidades');
      visiveis.forEach(m=>{
        const b=botao('',()=>abrir(m.id),'esp-modalidade');b.dataset.espModalidade=m.id;b.setAttribute('aria-label','Explorar '+m.title);
        const capa=no('div','esp-modalidade-capa');capa.append(imagem(origemImagem(m),'Cena ilustrativa de '+m.title,'esp-modalidade-imagem'));
        const corpo=no('div','esp-modalidade-corpo'),linha=no('div','esp-modalidade-titulo');linha.append(no('h3','',m.title),no('span','esp-seta','↗'));
        corpo.append(linha,no('p','',m.intro||''));
        const chips=no('div','esp-modalidade-chips');chips.append(tag(lista(m.training).length+' práticas'),tag('Vocabulário'),tag('Equipamentos'));corpo.append(chips);
        const c=consulta(m.id);if(c.checkedAt)corpo.append(no('small','esp-consulta-data','Estudos consultados em '+data(c.checkedAt)));if(c.error)corpo.append(no('small','esp-consulta-erro','Última consulta incompleta · tente atualizar'));if(c.cacheWarning)corpo.append(no('small','esp-consulta-erro',c.cacheWarning));
        b.append(capa,corpo);grade.append(b);
      });resultados.append(grade);
    };
    raiz.append(busca(pintar),contador,resultados);pintar();raiz.append(inventarioTenis());
    const nota=no('details','esp-nota-compartilhada');nota.append(no('summary','','Como combinar os quatro esportes'));
    nota.append(no('p','','A carga se soma: corrida, HYROX, pedal e musculação podem exigir os mesmos músculos em dias próximos. Considere esforço, duração, sono e sintomas ao organizar a semana.'));
    nota.append(no('p','','O botão Atualizar estudos consulta novas publicações. Ele não altera as orientações revisadas nem monta uma prescrição de treino.'));raiz.append(nota,rodape());
  }

  const atlas={
    peito:['supino','Supino reto com barra'],
    quadriceps:['agachamento','Agachamento com barra nas costas'],
    biceps:['rosca','Rosca com halteres']
  };
  function linkAtlas(movimento){
    const [vista,titulo]=movimento;
    const a=no('a','esp-botao',titulo);
    a.href='atlas/?vista='+vista+'&animar=1';a.target='_blank';a.rel='noopener noreferrer';
    a.setAttribute('aria-label','Abrir '+titulo+' no atlas 3D em nova aba');
    return a;
  }
  function cardConteudo(item,index,m,secao){
    const detalhe=no('details','esp-item');detalhe.dataset.espItem='';
    const summary=no('summary'),grupo=no('span','esp-summary-text'),linha=no('span','esp-item-resumo');
    const visual=visualItem(item,index,m,secao);
    if(visual){detalhe.dataset.espVisual=visual.kind;summary.append(imagem(visual.src,'','esp-item-miniatura'))}
    linha.append(no('span','esp-item-numero',String(index+1).padStart(2,'0')),no('strong','',item.title||'Conteúdo'));grupo.append(linha,no('span','esp-item-texto',(item.text||'').split(/(?<=[.!?])\s+/)[0]));summary.append(grupo,no('span','esp-expandir','+'));detalhe.append(summary);
    const conteudo=no('div','esp-item-detalhes');
    if(visual){const fig=no('figure','esp-guia-figura');fig.append(imagem(visual.src,visual.alt,'esp-item-imagem'),no('figcaption','',visual.kind==='diagram'?'Esquema educativo · exemplos visuais não são metas individuais.':secao==='training'?'Imagem ilustrativa · confira os pontos de execução abaixo.':'Imagem ilustrativa da categoria · compare os critérios de escolha abaixo.'));const ampliar=no('a','esp-ampliar-imagem','Ver imagem em tamanho maior ↗');ampliar.href=visual.src;ampliar.target='_blank';ampliar.rel='noopener noreferrer';ampliar.setAttribute('aria-label','Ampliar imagem de '+item.title+' em nova aba');fig.append(ampliar);conteudo.append(fig)}
    if(secao==='training'&&typeof SaudeEsportes3D==='object'){const studio=SaudeEsportes3D.create(m.id,index,item);if(studio)conteudo.prepend(studio)}
    if(secao==='training'&&m.id==='musculacao'&&atlas[item.id]){
      const bloco=no('section','esp-guia-bloco');
      bloco.append(no('h4','','Atlas do movimento em 3D'),linkAtlas(atlas[item.id]));
      conteudo.prepend(bloco);
    }
    function paragrafo(titulo,texto,classe=''){if(!texto)return;const bloco=no('section','esp-guia-bloco '+classe);bloco.append(no('h4','',titulo),no('p','',texto));conteudo.append(bloco)}
    function pontos(titulo,itens,ordenada=false){if(!lista(itens).length)return;const bloco=no('section','esp-guia-bloco'),ul=no(ordenada?'ol':'ul');bloco.append(no('h4','',titulo));itens.forEach(x=>ul.append(no('li','',x)));bloco.append(ul);conteudo.append(bloco)}
    paragrafo(secao==='training'?'Entenda o movimento':'O conceito',item.text);
    paragrafo('O que trabalha',item.muscles);
    paragrafo('Entenda em profundidade',item.explanation);
    pontos('Antes de começar',item.setup);
    pontos('Execução passo a passo',item.steps,true);
    paragrafo('Respiração e ritmo',item.breathing);
    pontos('Erros comuns e como ajustar',item.commonMistakes);
    pontos('Variações e adaptações',item.adaptations);
    pontos('Exemplos na prática',item.examples);
    pontos('Como escolher',item.selection);
    pontos('O que conferir',item.checks);
    pontos('Alternativas',item.alternatives);
    paragrafo('Como dosar o esforço',item.dose);
    paragrafo('Como progredir',item.progression);
    paragrafo('Ponto de atenção',item.cue,'esp-dica');
    paragrafo('Cuidados',item.care,'esp-atencao');
    paragrafo('Quando interromper',item.stop,'esp-atencao');
    paragrafo('Para combinar com sua rotina',item.notes);
    const refs=referencias(item.sources);if(refs)conteudo.append(refs);
    detalhe.append(conteudo);return detalhe;
  }
  function fonteCard(fonte){
    const card=no('article','esp-fonte');const meta=no('div','esp-fonte-meta');meta.append(tag(fonte.type||'Referência'),no('span','',fonte.year||'Ano não informado'));card.append(meta);
    const h=no('h4');h.append(link(fonte.label||'Abrir referência',fonte.url));card.append(h);
    if(fonte.application){const p=no('p');p.append(no('strong','','Aplicação: '),document.createTextNode(fonte.application));card.append(p)}
    if(fonte.limitation){const p=no('p','esp-fonte-limite');p.append(no('strong','','Limite: '),document.createTextNode(fonte.limitation));card.append(p)}
    return card;
  }
  function estudos(m,painel){
    const c=consulta(m.id),editoriais=idsFontes(m).map(id=>fontes[id]).filter(f=>corresponde(textoItem(f))),novos=lista(c.items).filter(x=>corresponde(textoItem(x)));
    const cab=no('div','esp-estudos-intro');cab.append(no('h3','','Evidências para ler com contexto'),no('p','','Referências revisadas sustentam os conteúdos desta biblioteca. Resultados novos ficam separados até a leitura crítica.'));painel.append(cab);
    const datas=no('div','esp-datas');datas.append(no('span','','Revisão do conteúdo: '+data(dados.revisedAt)),no('span','','Última consulta: '+data(c.checkedAt,true)));painel.append(datas);
    const sec=no('section','esp-estudos-grupo');sec.append(no('h3','','Referências revisadas'));
    if(editoriais.length){const grade=no('div','esp-fontes');editoriais.forEach(f=>grade.append(fonteCard(f)));sec.append(grade)}else sec.append(estadoVazio('Nenhuma referência nesta busca','Limpe o filtro para ver as fontes desta modalidade.'));painel.append(sec);
    const recentes=no('section','esp-estudos-grupo esp-recentes');const head=no('div','esp-recentes-head');head.append(no('h3','','Publicações encontradas'),tag('Ainda não revisadas','esp-tag-pendente'));recentes.append(head,no('p','esp-recentes-nota','Título e dados bibliográficos não demonstram qualidade ou aplicabilidade. Novos resultados não mudam automaticamente seus treinos.'));
    if(c.loading||ocupado)recentes.append(no('p','esp-consulta-andamento','Consulta em andamento…'));
    if(c.error){const aviso=no('p','esp-erro',String(c.error));aviso.setAttribute('role','alert');recentes.append(aviso)}
    if(c.cacheWarning)recentes.append(no('p','esp-cache-aviso',String(c.cacheWarning)));
    if(novos.length){const grade=no('div','esp-fontes');novos.forEach(item=>{
      const card=no('article','esp-fonte esp-fonte-nova'),topo=no('div','esp-fonte-meta');topo.append(tag(item.year||'Ano não informado'),tag('Não revisado','esp-tag-pendente'));card.append(topo);const h=no('h4');h.append(link(item.title||'Publicação sem título',item.url));card.append(h);
      const autores=Array.isArray(item.authors)?item.authors.join(', '):item.authors;if(autores)card.append(no('p','esp-autores',autores));if(item.journal)card.append(no('p','esp-revista',item.journal));grade.append(card);
    });recentes.append(grade)}else recentes.append(estadoVazio(c.checkedAt?'Nenhuma publicação nesta seleção':'Estudos novos ainda não consultados',c.checkedAt?(SaudeEsportesUI.busca?'Tente outro termo ou limpe o filtro.':'A consulta não retornou publicações. Isso não significa ausência de evidência.'):'Use Atualizar estudos para buscar publicações desta modalidade.'));
    painel.append(recentes);
  }
  function renderizarModalidade(m){
    const topo=no('div','esp-detalhe-topo');topo.append(botao('← Esportes',()=>{SaudeEsportesUI.modalidade='';SaudeEsportesUI.busca='';renderizar();focar('[data-esp-modalidade="'+m.id+'"]')},'esp-voltar'),botaoAtualizar(m.id));raiz.append(topo,avisoAtualizacao());
    const cab=no('header','esp-modalidade-header'),titulos=no('div');const h=no('h2','esp-titulo-modalidade',m.title);h.tabIndex=-1;titulos.append(no('span','esp-eyebrow','BIBLIOTECA DE ESPORTES'),h,no('p','',m.intro||''));cab.append(titulos);raiz.append(cab);
    const tabs=no('div','esp-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Conteúdo de '+m.title);
    if(!secoes.some(([id])=>id===SaudeEsportesUI.secao))SaudeEsportesUI.secao='training';
    secoes.forEach(([id,rotulo])=>{
      const b=botao(rotulo,()=>trocarSecao(id),'esp-tab');b.dataset.espTab=id;b.id=prefixo+'-tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(SaudeEsportesUI.secao===id));b.setAttribute('aria-controls',prefixo+'-painel');b.tabIndex=SaudeEsportesUI.secao===id?0:-1;
      b.onkeydown=e=>{const pos=secoes.findIndex(x=>x[0]===id);let proximo;if(e.key==='ArrowRight')proximo=(pos+1)%secoes.length;else if(e.key==='ArrowLeft')proximo=(pos+secoes.length-1)%secoes.length;else if(e.key==='Home')proximo=0;else if(e.key==='End')proximo=secoes.length-1;else return;e.preventDefault();trocarSecao(secoes[proximo][0])};tabs.append(b);
    });raiz.append(tabs);
    const painel=no('div','esp-painel');painel.id=prefixo+'-painel';painel.setAttribute('role','tabpanel');painel.setAttribute('aria-labelledby',prefixo+'-tab-'+SaudeEsportesUI.secao);painel.tabIndex=0;
    const contador=no('p','esp-contador');contador.setAttribute('role','status');contador.setAttribute('aria-live','polite');
    const pintar=()=>{
      painel.querySelectorAll('.esp-movimento').forEach(n=>n.espDispose?.());painel.replaceChildren();const atual=SaudeEsportesUI.secao;
      if(atual==='studies'){contador.textContent='';estudos(m,painel);return}
      const originais=lista(m[atual]),visiveis=originais.filter(x=>corresponde(textoItem(x)) ||
        (m.id==='musculacao' && atual==='training' && atlas[x.id] && corresponde(atlas[x.id][1])));
      if(m.id==='musculacao' && atual==='training'){
        const encontrados=Object.values(atlas).filter(([,titulo])=>corresponde(titulo));
        if(encontrados.length){
          const nav=no('nav','esp-atlas');nav.setAttribute('aria-label','Atlas do movimento em 3D');
          nav.append(no('h3','','Atlas do movimento em 3D'),...encontrados.map(linkAtlas));painel.append(nav);
        }
      }
      const total=visiveis.length+(atual==='gear'?lista(m.products).filter(p=>corresponde(textoItem(p))).length:0);
      contador.textContent=SaudeEsportesUI.busca?total+' resultado'+(total===1?'':'s'):'';
      if(!visiveis.length){painel.append(estadoVazio('Nenhum conteúdo encontrado',SaudeEsportesUI.busca?'Tente outro termo ou limpe a busca.':'O conteúdo desta seção será incluído na próxima revisão.'));if(atual!=='gear')return}
      if(atual==='care'){
        const visual=typeof SaudeEsportesVisuais==='object'?SaudeEsportesVisuais[m.id+'/care']:null;
        if(visual)painel.append(imagem(visual.src,visual.alt,'esp-cuidados-imagem'));
        const titulo=no('h3','esp-cuidado-titulo','Cuidados que acompanham a prática');painel.append(titulo);const ul=no('ul','esp-cuidados');visiveis.forEach(item=>{const li=no('li');li.append(no('span','esp-cuidado-marca','✓'),no('p','',textoItem(item)));ul.append(li)});painel.append(ul);
        const refs=referencias(idsFontes(m));if(refs)painel.append(refs);
      }else if(visiveis.length){if(atual==='training'&&m.id==='musculacao')painel.append(no('p','esp-cobertura-corpo','Corpo todo: peito, costas, ombros, braços e pegada, abdômen e lombar, quadril, glúteos, coxas e panturrilhas. Abra uma região para estudar a técnica e as variações.'));const grade=no('div','esp-conteudos');visiveis.forEach(item=>grade.append(cardConteudo(item,originais.indexOf(item),m,atual)));painel.append(grade);painel.append(no('p','esp-ajuda-detalhes','Abra cada item para ver aplicação, cuidados e fontes disponíveis.'))}
      if(atual==='gear'){produtos(m,painel);painel.append(inventarioTenis(m.id))}
    };
    raiz.append(busca(pintar),contador,painel);pintar();raiz.append(rodape());
  }
  function renderizar(){raiz.querySelectorAll('.esp-movimento').forEach(n=>n.espDispose?.());raiz.replaceChildren();raiz.setAttribute('aria-busy',String(ocupado));const m=modalidadeAtual();if(m)renderizarModalidade(m);else{SaudeEsportesUI.modalidade='';renderizarResumo()}}
  renderizar();return raiz;
}
