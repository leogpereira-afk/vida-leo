/* Painel pessoal de Saúde. Usa os cadastros, autenticação e anexos da Central. */
var SaudeUI={area:'resumo',de:'',ate:'',busca:'',filtros:{},densidade:'compacta'};
var SAUDE_AREAS=[['resumo','🏠 Hoje'],['exames','🧪 Exames'],['medidas','📏 Medidas'],['queixas','🩺 Consultas e sintomas'],['tratamentos','💊 Tratamentos'],['cuidados','💚 Cuidados'],['documentos','📂 Documentos']];
var SAUDE_TIPOS={comparacao:'Exames comparados',exames:'Exames',peso:'Peso e medidas',vitais:'Sinais vitais',queixas:'Sintomas e queixas',consultas:'Consultas',fisio:'Fisioterapia',vacinas:'Vacinas',histFamiliar:'Histórico familiar',tratamentos:'Medicamentos em uso',tratamentosConferencia:'Cadastros legados ativos para conferência',planos:'Planos de saúde vinculados',rastreios:'Prevenção',usos:'Histórico de usos e cuidados',estoque:'Estoque atual'};
var _saudePagina=null,_saudeGravacao={estado:'',em:''},_saudeConfirmadoEm='';
function saudeNotificarSync(t){if(t==='sincronizado')_saudeConfirmadoEm=new Date().toISOString()}
function saudeNotificarGravacao(){_saudeGravacao={estado:'Salvo neste dispositivo',em:new Date().toISOString()}}
function saudeListaDados(k){return Array.isArray(E[k])?E[k]:[]}
function saudeNome(r,k){return r.oque||r.exame||r.vacina||r.profissional||r.especialidade||r.doenca||SAUDE_TIPOS[k]||'Registro'}
function saudeData(d){return dataISOValida(d)?fmtDataAno(d):'Data a confirmar'}
function saudeValor(v){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:10}):String(v??'')}
function saudeIr(area,gravar=true){
  if(!SAUDE_AREAS.some(x=>x[0]===area))return;SaudeUI.area=area;abaSaude=area;
  if(gravar&&typeof history!=='undefined')history.pushState({...history.state,saudeArea:area},'','#saude');
  if(_saudePagina?.isConnected)saudePainel(_saudePagina);else tela();
}
function saudeGravar(fn){
  const antes=structuredClone(E);
  try{fn();salvar();_saudeGravacao={estado:'Salvo neste dispositivo',em:new Date().toISOString()};return true}
  catch(e){for(const k of Object.keys(E))delete E[k];Object.assign(E,antes);_saudeGravacao={estado:'Falha ao salvar. Seu preenchimento foi mantido.',em:''};throw e}
}
function saudeEstadoSync(texto){
  const t=String(texto||'').toLowerCase();
  if(t==='sincronizado')return{titulo:'Dados confirmados no servidor'+(_saudeConfirmadoEm?' às '+new Date(_saudeConfirmadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''),tipo:'ok'};
  if(/enviando|baixando|conferindo/.test(t))return{titulo:'Sincronização em andamento',tipo:'neutro'};
  if(/não enviado|sem conexão|recarregue/.test(t))return{titulo:'Dados locais; envio pendente',tipo:'atencao'};
  if(/outro acesso/.test(t))return{titulo:'Atualizado por outro acesso; confira textos preservados',tipo:'atencao'};
  return{titulo:DEV?'Prévia local; sem envio de dados':_saudeGravacao.estado||'Confira a sincronização',tipo:'neutro'};
}
function saudeStatusGravacao(){
  const box=el('<div class="sui-sync" role="status"><span></span><button type="button" class="btn ghost mini">Conferir sincronização</button></div>');
  const pintar=()=>{const info=saudeEstadoSync(document.getElementById('stSync')?.textContent?.replace(/^☁\s*/,''));box.dataset.nivel=info.tipo;box.querySelector('span').textContent=info.titulo+(_saudeGravacao.em?' · salvo às '+new Date(_saudeGravacao.em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'')};pintar();
  box.querySelector('button').onclick=async()=>{const b=box.querySelector('button');b.disabled=true;try{if(!DEV)await sincronizarAgora();else pintar()}finally{b.disabled=false}};
  if(typeof MutationObserver!=='undefined'){const alvo=document.getElementById('stSync');if(alvo){const o=new MutationObserver(()=>{if(!box.isConnected){o.disconnect();return}pintar()});o.observe(alvo,{childList:true,subtree:true,characterData:true})}}
  return box;
}
function saudeForm(titulo,defs,base,gravar,{sub='Preencha somente informações confirmadas. Os documentos originais ficam preservados.'}={}){
  abrirModal(esc(titulo),esc(sub),(c,fechar)=>{
    const form=el('<form data-saude-form class="sui-form"><div class="sui-form-grid"></div><p role="alert" aria-live="polite"></p><footer><button class="btn ghost" type="button" data-cancelar>Cancelar</button><button class="btn" type="submit">Salvar</button></footer></form>'),grade=form.querySelector('.sui-form-grid');
    defs.forEach(d=>{
      const l=el('<label><span>'+esc(d.t)+(d.required?' *':'')+'</span></label>');
      const inp=d.opcoes?el('<select>'+opcoesSelect(d.opcoes,base[d.k]??'')+'</select>'):d.tipo==='textarea'?el('<textarea rows="3"></textarea>'):el('<input type="'+(d.tipo||'text')+'">');
      inp.name=d.k;if(d.tipo==='checkbox')inp.checked=base[d.k]===true;else if(d.opcoes){const escolhido=[...inp.options].find(o=>o.value===String(base[d.k]??''));if(escolhido)escolhido.selected=true}else inp.value=base[d.k]??'';
      if(d.tipo==='number'){inp.step='any';inp.inputMode='decimal';if(d.min!=null)inp.min=String(d.min);if(d.max!=null)inp.max=String(d.max)}
      inp.required=!!d.required;if(d.full||d.tipo==='textarea')l.classList.add('sui-full');if(d.tipo==='checkbox')l.classList.add('sui-check');l.append(inp);if(d.nota)l.append(el('<small>'+esc(d.nota)+'</small>'));grade.append(l);
    });
    form.querySelector('[data-cancelar]').onclick=fechar;let ocupado=false;
    form.onsubmit=e=>{e.preventDefault();if(ocupado)return;const erro=form.querySelector('[role=alert]');erro.textContent='';try{
      const d={};for(const f of defs){const i=form.querySelector('[name="'+f.k+'"]'),v=i.type==='checkbox'?i.checked:String(i.value??'').trim();if(f.required&&!v)throw Error('Preencha '+f.t.toLowerCase()+'.');if(f.tipo==='date'&&v&&!SaudePainelModelo.data(v))throw Error('Confira '+f.t.toLowerCase()+'.');if(f.tipo==='time'&&v&&!SaudePainelModelo.hora(v))throw Error('Confira '+f.t.toLowerCase()+'.');if(f.tipo==='number'&&v!==''&&(!Number.isFinite(+v)||(f.min!=null&&+v<f.min)||(f.max!=null&&+v>f.max)))throw Error('Confira '+f.t.toLowerCase()+'.');d[f.k]=f.tipo==='number'&&v!==''?+v:v}
      ocupado=true;gravar(d);fechar();
    }catch(err){ocupado=false;erro.textContent=err.message}};c.append(form);
  },null,{antesFechar:()=>true});
}
function saudeCampos(tipo){
  const date={k:'data',t:'Data',tipo:'date',required:true},obs={k:'obs',t:'Observações',tipo:'textarea'},fonte={k:'fonte',t:'Fonte da informação',nota:'Ex.: balança, laudo, relato ou orientação profissional.'},hora={k:'hora',t:'Horário',tipo:'time'};
  const vinculo={k:'tratamentoId',t:'Tratamento relacionado',opcoes:[{v:'',t:'Sem vínculo'},...gruposTratamento().map(g=>({v:g.plano.id,t:g.plano.oque}))]};
  const queixa={k:'queixaId',t:'Sintoma / episódio relacionado',opcoes:opcoesDeQueixa()};
  return{
    peso:[date,hora,{k:'peso',t:'Peso (kg)',tipo:'number',min:0.1,required:true},{k:'altura',t:'Altura (m ou cm)',tipo:'number',min:0.1},{k:'cintura',t:'Cintura (cm)',tipo:'number',min:0},...['gordura','massaGorda','massaMagra'].map(k=>({k,t:k==='gordura'?'Gordura corporal (%)':k==='massaGorda'?'Massa de gordura (kg)':'Massa livre de gordura (kg)',tipo:'number',min:0,max:k==='gordura'?100:500})),{k:'metodo',t:'Método / equipamento'},fonte,vinculo,obs],
    vitais:[date,hora,{k:'sis',t:'Pressão sistólica (mmHg)',tipo:'number',min:1},{k:'dia',t:'Pressão diastólica (mmHg)',tipo:'number',min:1},{k:'fc',t:'Frequência cardíaca (bpm)',tipo:'number',min:1},fonte,obs],
    exames:[{k:'exame',t:'Nome conforme o laudo',required:true},date,{k:'emissao',t:'Data de emissão',tipo:'date'},{k:'valor',t:'Resultado original',nota:'Preserve sinais como < ou > e resultados qualitativos.'},{k:'unidade',t:'Unidade conforme o laudo'},{k:'referenciaLaudo',t:'Referência do próprio laudo',tipo:'textarea'},{k:'metodo',t:'Método / contexto da coleta'},{k:'medico',t:'Laboratório / profissional'},{k:'resultado',t:'Situação no documento',opcoes:['','Aguardando','Normal','Atenção','Alterado']},{k:'proximo',t:'Próxima data indicada',tipo:'date'},fonte,vinculo,obs],
    queixas:[{k:'oque',t:'O que estou sentindo',required:true},date,{k:'onde',t:'Local / região'},{k:'intensidade',t:'Intensidade declarada (0 a 10)',tipo:'number',min:0,max:10},{k:'situacao',t:'Situação',opcoes:['Ativa','Melhorando','Piorando','Resolvida']},{k:'fatores',t:'O que melhora ou piora',tipo:'textarea'},obs],
    consultas:[date,hora,{k:'situacao',t:'Situação',opcoes:['A confirmar','Agendada','Realizada','Cancelada']},{k:'profissional',t:'Profissional',required:true},{k:'especialidade',t:'Especialidade'},{k:'local',t:'Local / clínica'},{k:'contato',t:'Contato',tipo:'tel'},queixa,vinculo,{k:'motivo',t:'Motivo da consulta',tipo:'textarea'},{k:'perguntas',t:'Perguntas para levar',tipo:'textarea'},{k:'conduta',t:'O que ficou combinado',tipo:'textarea'},{k:'retorno',t:'Retorno combinado',tipo:'date'},{k:'retornoConcluido',t:'Retorno já resolvido / realizado',tipo:'checkbox'},obs],
    fisio:[{k:'oque',t:'Objetivo informado',required:true},date,queixa,vinculo,{k:'sessao',t:'Sessão nº',tipo:'number',min:1},{k:'total',t:'Total previsto',tipo:'number',min:1},{k:'dorAntes',t:'Dor antes (0 a 10)',tipo:'number',min:0,max:10},{k:'dorDepois',t:'Dor depois (0 a 10)',tipo:'number',min:0,max:10},{k:'profissional',t:'Profissional'},{k:'funcional',t:'Atividades / evolução relatada',tipo:'textarea'},obs],
    vacinas:[{k:'vacina',t:'Vacina',required:true},date,{k:'situacao',t:'Situação',opcoes:['A confirmar','Agendada','Realizada']},{k:'dose',t:'Dose conforme o comprovante'},{k:'lote',t:'Lote'},{k:'local',t:'Local'},{k:'proxima',t:'Próxima data indicada',tipo:'date'},{k:'comprovante',t:'Comprovante conferido',tipo:'checkbox'},fonte,obs],
    histFamiliar:[{k:'parente',t:'Parente',required:true,opcoes:['','Pai','Mãe','Irmão','Irmã','Avô paterno','Avó paterna','Avô materno','Avó materna','Outro']},{k:'doenca',t:'Condição declarada',required:true},{k:'idade',t:'Idade na ocasião, se conhecida',tipo:'number',min:0},{k:'situacao',t:'Situação declarada',opcoes:['','Vivo','Faleceu','Não informado']},fonte,obs],
    rastreios:[{k:'oque',t:'Acompanhamento / cuidado',required:true},{k:'profissional',t:'Responsável pela orientação'},{k:'fonte',t:'Fonte / documento da orientação',required:true},{k:'data',t:'Data em que foi indicado',tipo:'date',required:true},{k:'proxima',t:'Próxima data confirmada',tipo:'date'},{k:'situacao',t:'Situação',opcoes:['A confirmar','Confirmado','Realizado','Cancelado']},obs]
  }[tipo]||[];
}
function saudeEditarRegistro(tipo,registro){
  if(tipo==='tratamentos'){const plano=!registro||registro.tipo==='Plano de tratamento'||saudeListaDados('tratamentos').some(t=>t.origemTratamentoId===registro.id);if(plano)editarPlanoTratamento(registro);else editarTratamento(registro);return}
  if(tipo==='saudeDocumentos'){saudeIr('documentos');return}
  const original=registro?structuredClone(registro):{data:hoje(),situacao:tipo==='queixas'?'Ativa':['consultas','vacinas','rastreios'].includes(tipo)?'A confirmar':'',fonte:'',parente:'',doenca:''};
  original.retornoConcluido=!!original.retornoConcluidoEm;
  saudeForm((registro?'Editar ':'Novo registro · ')+SAUDE_TIPOS[tipo],saudeCampos(tipo),original,d=>{
    if(d.data>hoje()&&!(['consultas','vacinas'].includes(tipo)&&d.situacao==='Agendada'))throw Error('Uma realização não pode ter data futura. Para consulta ou vacina, selecione Agendada.');
    if(d.retorno&&d.retorno<d.data)throw Error('O retorno não pode ser anterior à consulta.');
    if(tipo==='vitais'&&!['sis','dia','fc'].some(k=>+d[k]>0))throw Error('Informe pelo menos uma medição.');
    if(tipo==='fisio'&&d.sessao&&d.total&&d.sessao>d.total)throw Error('A sessão não pode superar o total informado.');
    const id=registro?.id||uid();saudeGravar(()=>{
      if(!Array.isArray(E[tipo]))E[tipo]=[];const pos=E[tipo].findIndex(x=>x.id===id),antes=pos>=0?E[tipo][pos]:null;
      const item={...(antes||{}),...d,id,atualizadoEm:new Date().toISOString()};
      if(tipo==='exames')item.origemDocumental=true;
      if(tipo==='consultas'){item.retornoConcluidoEm=d.retornoConcluido?(antes?.retornoConcluidoEm||new Date().toISOString()):'';delete item.retornoConcluido}
      if(antes)item.revisoes=[...(antes.revisoes||[]),{em:new Date().toISOString(),campos:Object.fromEntries(Object.keys(d).map(k=>[k,antes[k]??'']))}];
      if(pos<0)E[tipo].push(item);else E[tipo][pos]=item;
    });
  });
}
function saudeNoVazio(titulo,descricao,rotulo,fn){const x=el('<div class="sui-vazio"><b>'+esc(titulo)+'</b><p>'+esc(descricao)+'</p></div>');if(fn)x.append(acao(rotulo,fn));return x}
function saudeCabecalho(titulo,sub,acoes=[]){const x=el('<header class="sui-section-head"><div><h2>'+esc(titulo)+'</h2><p>'+esc(sub||'')+'</p></div><div class="sui-actions"></div></header>');acoes.forEach(a=>x.lastElementChild.append(a));return x}
function saudeCard(titulo,valor,meta,estado,acoes=[]){const x=el('<article class="sui-card"><div class="sui-card-top"><h3>'+esc(titulo)+'</h3>'+(estado?'<span class="sui-tag">'+esc(estado)+'</span>':'')+'</div>'+(valor!==''?'<strong class="sui-value">'+esc(valor)+'</strong>':'')+'<p class="sui-meta">'+esc(meta||'')+'</p><div class="sui-actions"></div></article>');acoes.forEach(a=>x.lastElementChild.append(a));return x}
function saudeColunas(tipo){
  const n=(r,k)=>r[k]!==''&&r[k]!=null?saudeValor(r[k]):'—';
  const data=['Data',r=>saudeData(r.data)+(r.hora?' · '+r.hora:'')],estado=['Situação',r=>r.situacao||r.status||r.resultado||'Registrado'];
  return {
    exames:[data,['Exame',r=>saudeNome(r,tipo)],['Resultado',r=>r.valor!==''&&r.valor!=null?String(r.valor):'Sem resultado'],['Unidade',r=>r.unidade||'—'],estado,['Laboratório / fonte',r=>r.medico||r.laboratorio||r.fonte||'Não informado']],
    peso:[data,['Peso (kg)',r=>n(r,'peso')],['Altura',r=>r.altura?saudeValor(r.altura)+(Number(r.altura)>3?' cm':' m'):'—'],['Cintura (cm)',r=>n(r,'cintura')],['Gordura (%)',r=>n(r,'gordura')],['Massa gorda (kg)',r=>n(r,'massaGorda')],['Massa magra (kg)',r=>n(r,'massaMagra')],['Fonte / método',r=>[r.fonte,r.metodo].filter(Boolean).join(' · ')||'Não informado']],
    vitais:[data,['Sistólica (mmHg)',r=>n(r,'sis')],['Diastólica (mmHg)',r=>n(r,'dia')],['Batimentos (bpm)',r=>n(r,'fc')],['Fonte',r=>r.fonte||'Não informado']],
    consultas:[data,['Profissional',r=>r.profissional||'Não informado'],['Especialidade',r=>r.especialidade||'—'],estado,['Local',r=>r.local||'—'],['Retorno',r=>r.retorno?saudeData(r.retorno)+(r.retornoConcluidoEm?' · realizado':''):'—']],
    queixas:[data,['Sintoma / queixa',r=>saudeNome(r,tipo)],['Local / região',r=>r.onde||'—'],['Intensidade',r=>r.intensidade!==''&&r.intensidade!=null?saudeValor(r.intensidade)+'/10':'—'],estado],
    fisio:[data,['Objetivo',r=>saudeNome(r,tipo)],['Sessão',r=>r.sessao?String(r.sessao)+(r.total?' / '+r.total:''):'—'],['Dor antes / depois',r=>n(r,'dorAntes')+' / '+n(r,'dorDepois')],['Profissional',r=>r.profissional||'—']]
  }[tipo];
}
function saudeTabela(tipo,itens,titulo){
  const defs=saudeColunas(tipo),rol=el('<div class="sui-tabela-scroll" tabindex="0" role="region"><table class="sui-tabela"><caption></caption><thead><tr></tr></thead><tbody></tbody></table></div>');
  rol.setAttribute('aria-label',titulo+' em linhas');rol.querySelector('caption').textContent=itens.length+' registro(s) · '+titulo;
  for(const label of [...defs.map(d=>d[0]),'Ações']){const th=document.createElement('th');th.scope='col';th.textContent=label;rol.querySelector('thead tr').append(th)}
  for(const r of itens){
    const tr=document.createElement('tr');tr.dataset.saudeRegistro=r.id||'';
    defs.forEach(([label,fn])=>{const td=document.createElement('td');td.dataset.coluna=label;td.textContent=fn(r);if(label==='Situação'){const tag=el('<span class="sui-tag"></span>');tag.textContent=fn(r);td.replaceChildren(tag)}tr.append(td)});
    const td=document.createElement('td'),acoes=el('<div class="sui-linha-acoes"></div>');
    const abrir=acao(tipo==='consultas'?'🩺 Abrir consulta':'✏️ Ver / editar',()=>saudeEditarRegistro(tipo,r),'ghost mini');abrir.setAttribute('aria-label','Editar '+saudeNome(r,tipo)+' em '+saudeData(r.data));acoes.append(abrir);
    if(tipo==='consultas')acoes.append(acao('📋 Preparar consulta',()=>saudePrepararConsulta(r),'ghost mini'));
    if(tipo==='queixas')acoes.append(acao('🔎 Ver episódio',()=>saudeEpisodio(r),'ghost mini'));
    const docs=acao('📎 Documentos',()=>saudeDocumentosRegistro(tipo,r),'ghost mini');docs.setAttribute('aria-label','Documentos de '+saudeNome(r,tipo)+' em '+saudeData(r.data));acoes.append(docs);
    const outrasMedidas=tipo==='peso'&&typeof METRICAS_TRATAMENTO!=='undefined'?METRICAS_TRATAMENTO.filter(([k])=>!['peso','gordura','massaGorda','massaMagra'].includes(k)&&r[k]!==''&&r[k]!=null).map(([k,nome,u])=>[nome,saudeValor(r[k])+(u?' '+u:'')]):[];
    const detalhes=[...outrasMedidas,['Frequência',r.frequencia],...(['peso','vitais','fisio'].includes(tipo)?[['Situação',r.situacao||r.status]]:[]),['Referência do laudo',r.referenciaLaudo],['Método',r.metodo],['Fonte',r.fonte],['Motivo',r.motivo],['Conduta',r.conduta],['Perguntas',r.perguntas],['Observações',r.obs],['Fatores',r.fatores],['Evolução',r.funcional]].filter(([,v])=>v!==''&&v!=null);
    if(detalhes.length){const det=el('<details class="sui-linha-detalhes"><summary>🔎 Detalhes</summary><dl></dl></details>');detalhes.forEach(([label,valor])=>{const div=el('<div><dt></dt><dd></dd></div>');div.firstElementChild.textContent=label;div.lastElementChild.textContent=String(valor);det.querySelector('dl').append(div)});acoes.append(det)}
    td.append(acoes);tr.append(td);rol.querySelector('tbody').append(tr);
  }
  return rol;
}
function saudeLista(tipo,itens,{titulo=SAUDE_TIPOS[tipo],descricao='',criar=true}={}){
  const box=el('<section class="sui-lista"></section>');box.append(saudeCabecalho(titulo,descricao,criar?[acao('+ Adicionar',()=>saudeEditarRegistro(tipo))]:[]));
  const ferramentas=el('<div class="sui-filtros"><label>Buscar<input type="search" placeholder="Nome, profissional ou observação"></label><label>Situação<select><option value="">Todas</option></select></label></div>');
  const guardado=(SaudeUI.filtros||{})[tipo]||{};ferramentas.querySelector('input').value=guardado.busca||'';
  const estados=[...new Set(itens.map(x=>x.situacao||x.status||x.resultado).filter(Boolean))];estados.forEach(s=>ferramentas.querySelector('select').append(el('<option>'+esc(s)+'</option>')));const estadoGuardado=[...ferramentas.querySelector('select').options].find(x=>x.value===guardado.estado);if(estadoGuardado)estadoGuardado.selected=true;box.append(ferramentas);const compacta=!!saudeColunas(tipo),grade=el('<div class="'+(compacta?'sui-linhas':'sui-grid')+'"></div>');box.append(grade);if(compacta)box.dataset.formato='linhas';
  const pintar=()=>{grade.innerHTML='';const busca=normaliza(ferramentas.querySelector('input').value),estado=ferramentas.querySelector('select').value;SaudeUI.filtros=SaudeUI.filtros||{};SaudeUI.filtros[tipo]={busca:ferramentas.querySelector('input').value,estado};
    const filtrados=itens.filter(x=>(!SaudeUI.de||!x.data||x.data>=SaudeUI.de)&&(!SaudeUI.ate||!x.data||x.data<=SaudeUI.ate)&&(!estado||(x.situacao||x.status||x.resultado)===estado)&&normaliza([saudeNome(x,tipo),x.profissional,x.especialidade,x.medico,x.laboratorio,x.unidade,x.metodo,x.obs,x.fonte].filter(Boolean).join(' ')).includes(busca)).slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')||(b.hora||'').localeCompare(a.hora||''));
    if(!filtrados.length){grade.append(saudeNoVazio('Nenhum registro neste recorte','Adicione um registro ou ajuste a busca e o período.',criar?'Adicionar registro':'',criar?()=>saudeEditarRegistro(tipo):null));return}
    if(compacta){grade.append(saudeTabela(tipo,filtrados,titulo));return}
    filtrados.forEach(r=>{
      let valor='',meta=[saudeData(r.data),r.hora,r.fonte||'Fonte não informada'].filter(Boolean).join(' · ');
      if(tipo==='peso'){valor=r.peso!==''&&r.peso!=null?saudeValor(r.peso)+' kg':'Peso a confirmar';meta+=' · '+(r.metodo||'Método não informado')}
      if(tipo==='vitais'){valor=r.sis&&r.dia?saudeValor(r.sis)+'/'+saudeValor(r.dia)+' mmHg':r.fc?saudeValor(r.fc)+' bpm':'Medição incompleta';if(r.fc&&r.sis)meta+=' · '+saudeValor(r.fc)+' bpm'}
      if(tipo==='exames'){valor=r.valor!==''&&r.valor!=null?r.valor+' '+(r.unidade||''):'Aguardando resultado';meta+=' · '+(r.medico||'Laboratório não informado')}
      if(tipo==='queixas')valor=r.intensidade!==''&&r.intensidade!=null?'Intensidade '+r.intensidade+'/10':'Relato em acompanhamento';
      if(tipo==='fisio')valor=r.sessao?'Sessão '+r.sessao+(r.total?' de '+r.total:''):'Sessão registrada';
      if(tipo==='vacinas')valor=r.dose||'Dose a confirmar';
      if(tipo==='consultas')valor=r.especialidade||'Consulta / retorno';
      if(tipo==='histFamiliar')meta=[r.parente,r.idade!==''&&r.idade!=null?r.idade+' anos':'Idade não informada',r.fonte||'Relato sem origem registrada'].join(' · ');
      const a=[acao(tipo==='consultas'?'Abrir consulta':'Ver / editar',()=>saudeEditarRegistro(tipo,r),'ghost mini')];
      if(tipo==='consultas')a.push(acao('Preparar consulta',()=>saudePrepararConsulta(r),'ghost mini'));
      if(tipo==='queixas')a.push(acao('Ver episódio',()=>saudeEpisodio(r),'ghost mini'));
      const card=saudeCard(saudeNome(r,tipo),valor,meta,r.situacao||r.status||r.resultado||'Registrado',a);
      if(r.obs||r.frequencia||r.conduta){const det=el('<details><summary>Informações registradas</summary><p></p></details>');det.querySelector('p').textContent=r.obs||r.frequencia||r.conduta;card.insertBefore(det,card.lastElementChild)}
      const docs=acao('Documentos',()=>saudeDocumentosRegistro(tipo,r),'ghost mini');card.lastElementChild.append(docs);grade.append(card);
    });
  };ferramentas.querySelector('input').oninput=pintar;ferramentas.querySelector('select').onchange=pintar;pintar();return box;
}
function saudeDocumentosRegistro(tipo,r){
  const mapa={exames:'exame',tratamentos:'tratamento',consultas:'consulta',queixas:'queixa',vacinas:'vacina',peso:'peso',vitais:'vitais',fisio:'fisio'};
  abrirModal('Documentos · '+esc(saudeNome(r,tipo)),'Originais deste registro, sem alterar outros vínculos.',c=>{
    c.append(areaArquivos((mapa[tipo]||tipo)+':'+r.id,'Adicionar PDF ou foto'));
    if(tipo==='peso'||tipo==='tratamentos'){
      c.append(el('<h3>'+ (tipo==='peso'?'Fotos da medição':'Fotos da evolução')+'</h3>'));
      c.append(areaArquivos((tipo==='peso'?'medida:':'evolucao-tratamento:')+r.id,'Adicionar foto'));
    }
  });
}
function saudeOcorrencia(o){
  const t=saudeListaDados('tratamentos').find(t=>t.id===o.registroId);if(!t)return;
  saudeForm('Registrar cuidado · '+t.oque,[{k:'estado',t:'Situação',opcoes:['Registrado','Não utilizado','Adiado']},{k:'quantidade',t:'Quantidade utilizada ('+(SaudeTratamentos.unidadeExibida(t.unidade)||'unidade a definir')+')',tipo:'number',min:0},{k:'hora',t:'Horário real do uso',tipo:'time'},{k:'adiadoPara',t:'Novo horário de hoje, se adiou',tipo:'time'},{k:'obs',t:'Observação',tipo:'textarea'}],{estado:'Registrado',quantidade:SaudeTratamentos.numeroCampo(t.consumoPorCiclo),hora:new Date().toTimeString().slice(0,5)},d=>{
    const atual=saudeListaDados('tratamentos').find(x=>x.id===t.id);tratamentoCommit(atual,()=>SaudePainelModelo.registrarOcorrencia(atual,{...d,ocorrenciaId:o.id,data:o.data},uso=>SaudeTratamentos.registrarUso(atual,uso)));
  },{sub:o.hora==='dia'?'Uso diário configurado. Registre somente o que aconteceu.':'Horário planejado '+o.hora+'. O estoque só baixa no uso confirmado.'});
}
function saudeAbrirPrioridade(p){
  if(p.tipo==='uso'){saudeOcorrencia(p);return}
  if(['reposicao','cuidado'].includes(p.tipo)){const t=saudeListaDados('tratamentos').find(t=>t.id===p.registroId);if(!t)return;tratamentoGrupoSelecionado=t.origemTratamentoId||t.id;tratamentoSelecionado=t.id;tratamentoVisao='itens';saudeIr('tratamentos');return}
  const k=p.tipo==='consulta'||p.tipo==='retorno'?'consultas':p.tipo;const r=saudeListaDados(k).find(x=>x.id===p.registroId);if(r)saudeEditarRegistro(k,r);
}
function saudeHoje(){
  const box=el('<section class="sui-hoje"></section>'),prioridades=SaudePainelModelo.hoje(E,hoje()),q=SaudePainelModelo.qualidade(E,hoje()),i=SaudePainelModelo.indicadores(E,hoje());
  box.append(saudeCabecalho('Seu próximo passo','Cuidados configurados, datas informadas e conferências do seu histórico.',[acao('Preparar consulta',()=>saudePrepararConsulta(),'ghost')]));
  const kpis=el('<div class="sui-kpis"></div>');
  const usos=saudeListaDados('tratamentos').flatMap(t=>SaudePainelModelo.ocorrencias(t,hoje())),done=usos.filter(o=>o.estado==='Registrado'||o.estado==='Não utilizado').length;
  for(const [titulo,valor,meta,fn]of[['Cuidados de hoje',usos.length?done+'/'+usos.length:'Sem plano diário',usos.length?'Registros concluídos; não é medida de adesão':'Configure quando houver orientação',()=>saudeIr('tratamentos')],['Próximas datas',prioridades.filter(p=>p.tipo!=='uso'&&p.tipo!=='reposicao').length,'Datas registradas para acompanhar',()=>saudeIr('queixas')],['Para conferir',q.length,'Campos e documentos, sem avaliação clínica',saudeQualidade],['Última pesagem',i.peso.valor===null?'Adicionar':saudeValor(i.peso.valor)+' kg',i.peso.data?saudeData(i.peso.data):'Comece seu histórico',()=>i.peso.valor===null?saudeEditarRegistro('peso'):saudeIr('medidas')]]){
    const k=acao('',fn,'ghost sui-kpi');k.innerHTML='<small>'+esc(titulo)+'</small><strong>'+esc(valor)+'</strong><span>'+esc(meta)+'</span>';kpis.append(k);
  }box.append(kpis);
  const lista=el('<div class="sui-prioridades"></div>');
  if(!prioridades.length)lista.append(saudeNoVazio('Nenhuma ação configurada para hoje','Novas datas, horários confirmados e avisos de reposição aparecerão aqui.','Adicionar registro',saudeAdicionar));
  prioridades.slice(0,12).forEach(p=>{const item=p.tipo==='reposicao'?E.tratamentos.find(t=>t.id===p.registroId):null,motivo=item?SaudeTratamentos.formatarNumero(SaudeTratamentos.saldo(item))+' '+SaudeTratamentos.unidadeExibida(item.unidade)+' disponíveis':p.motivo;const row=el('<article class="sui-prioridade"><span class="sui-ponto" aria-hidden="true"></span><div><small>'+esc(p.tipo==='uso'?(p.estado==='Adiado'?'Adiado pelo usuário':'Cuidado de hoje'):p.tipo==='reposicao'?'Reposição':'Data informada')+'</small><h3>'+esc(p.titulo)+'</h3><p>'+esc(motivo||'')+'</p></div><b>'+esc(p.tipo==='uso'?(p.adiadoPara||(p.hora==='dia'?'Hoje':p.hora)):saudeData(p.data))+'</b></article>');row.dataset.nivel=p.tipo==='reposicao'?'atencao':'neutro';row.append(acao(p.tipo==='uso'?'Registrar':p.tipo==='reposicao'?'Conferir estoque':'Abrir',()=>saudeAbrirPrioridade(p),'ghost mini'));lista.append(row)});box.append(lista);
  if(prioridades.length>12)box.append(el('<p class="sui-meta">Mais '+(prioridades.length-12)+' ações nas respectivas áreas.</p>'));
  if(q.length){const pend=el('<section class="sui-pendencias"><h3>Conferências que ajudam a completar seu histórico</h3><ul></ul></section>');q.slice(0,3).forEach(a=>{const li=el('<li></li>');li.textContent=a.titulo+': '+a.motivo;pend.querySelector('ul').append(li)});pend.append(acao('Conferir '+q.length+' pendências',saudeQualidade,'ghost mini'));box.append(pend)}
  return box;
}
function saudeQualidade(){
  abrirModal('Conferir dados da Saúde','Pendências de cadastro e origem documental. Uma ficha pode ter mais de uma pendência.',c=>{
    const q=SaudePainelModelo.qualidade(E,hoje());if(!q.length){c.append(saudeNoVazio('Sem pendências nas regras verificadas','Isso não representa validação clínica.'));return}
    const filtro=el('<label class="sui-filtro-solo">Área<select><option value="">Todas as áreas</option></select></label>'),lista=el('<div class="sui-grid"></div>');[...new Set(q.map(x=>x.tipo))].forEach(k=>filtro.querySelector('select').append(el('<option value="'+esc(k)+'">'+esc(SAUDE_TIPOS[k]||k)+'</option>')));c.append(filtro,lista);
    const pintar=()=>{lista.innerHTML='';q.filter(x=>!filtro.querySelector('select').value||x.tipo===filtro.querySelector('select').value).forEach(a=>{const r=saudeListaDados(a.tipo).find(x=>x.id===a.registroId);lista.append(saudeCard(a.titulo,'',a.motivo,'Conferir',[acao('Conferir registro',()=>r?saudeEditarRegistro(a.tipo,r):saudeIr('documentos'),'ghost mini')]))})};filtro.querySelector('select').onchange=pintar;pintar();
  });
}
function saudeEpisodio(q){
  abrirModal('Episódio · '+esc(q.oque),'Registros vinculados pelo mesmo ID; nenhum cadastro é duplicado.',c=>{
    const ep=SaudePainelModelo.episodios(E).find(x=>x.id===q.id);if(!ep)return;
    c.append(saudeCard(q.oque,q.intensidade!==''&&q.intensidade!=null?'Intensidade '+q.intensidade+'/10':'',saudeData(q.data),q.situacao,[acao('Editar relato',()=>saudeEditarRegistro('queixas',q),'ghost mini')]));
    const eventos=[...ep.consultas.map(r=>({tipo:'consultas',r})),...ep.sessoes.map(r=>({tipo:'fisio',r}))].sort((a,b)=>(b.r.data||'').localeCompare(a.r.data||''));
    if(!eventos.length)c.append(el('<p>Nenhuma consulta ou sessão vinculada ainda.</p>'));
    eventos.forEach(({tipo,r})=>c.append(saudeCard(SAUDE_TIPOS[tipo],saudeNome(r,tipo),saudeData(r.data),r.situacao||'Registrado',[acao('Abrir',()=>saudeEditarRegistro(tipo,r),'ghost mini')])));
    const b=el('<div class="sui-actions"></div>');b.append(acao('+ Consulta',()=>saudeEditarRegistro('consultas',{id:uid(),data:hoje(),queixaId:q.id,situacao:'A confirmar'}),'ghost'),acao('+ Sessão',()=>saudeEditarRegistro('fisio',{id:uid(),data:hoje(),queixaId:q.id}),'ghost'));c.append(b);
  });
}
function saudeVisoes(tipo,linhas,evolucao){
  const box=el('<div class="sui-visoes"><nav class="sui-visoes-nav"></nav><div class="sui-visoes-linhas"></div><div class="sui-visoes-evolucao"></div></div>');
  box.querySelector('nav').setAttribute('aria-label','Visualização de '+tipo);box.querySelector('.sui-visoes-linhas').append(linhas);box.querySelector('.sui-visoes-evolucao').append(evolucao);
  SaudeUI.visoes=SaudeUI.visoes||{};const mudar=modo=>{SaudeUI.visoes[tipo]=modo;box.querySelector('.sui-visoes-linhas').hidden=modo==='evolucao';box.querySelector('.sui-visoes-evolucao').hidden=modo==='linhas';box.querySelectorAll('[data-saude-visao]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.saudeVisao===modo)))};
  for(const [id,nome]of [['linhas','📋 Linhas'],['evolucao','📈 Evolução'],['juntos','◫ Juntos']]){const b=acao(nome,()=>mudar(id),'ghost mini');b.dataset.saudeVisao=id;box.querySelector('nav').append(b)}mudar(SaudeUI.visoes[tipo]||'linhas');return box;
}
function saudeMedidas(){
  const b=el('<div></div>'),i=SaudePainelModelo.indicadores(E,hoje());b.append(saudeCabecalho('📏 Medidas e sinais vitais','Evolução e histórico em linhas, com a data e a fonte de cada medição.',[acao('➕ Medição',()=>saudeEditarRegistro('peso')),acao('💓 Sinais vitais',()=>saudeEditarRegistro('vitais'),'ghost')]));
  if(typeof saudeDashboardEvolucao==='function'){
    const paineis=el('<div class="sui-dash-medidas"></div>');paineis.append(saudeDashboardEvolucao('peso',saudeListaDados('peso'),{de:SaudeUI.de,ate:SaudeUI.ate}));
    if(saudeListaDados('vitais').length){const vitais=el('<details class="sui-vitais-evolucao"><summary>💓 Evolução dos sinais vitais</summary></details>');vitais.append(saudeDashboardEvolucao('vitais',saudeListaDados('vitais'),{de:SaudeUI.de,ate:SaudeUI.ate}));paineis.append(vitais)}
    const linhas=el('<div></div>');linhas.append(saudeLista('peso',saudeListaDados('peso'),{titulo:'📋 Histórico de medidas',criar:false}),saudeLista('vitais',saudeListaDados('vitais'),{titulo:'💓 Histórico de sinais vitais',criar:false}));b.append(saudeVisoes('medidas',linhas,paineis));return b;
  }
  const grade=el('<div class="sui-kpis"></div>');for(const [k,l]of[['peso','Peso'],['imc','IMC calculado'],['pressao','Pressão'],['pulso','Batimentos']])if(i[k].valor!==null){const v=saudeCard(l,saudeValor(i[k].valor)+' '+i[k].unidade,saudeData(i[k].data),null);v.classList.add('sui-kpi');if(k==='imc')v.append(el('<small>'+esc(i[k].formula)+'</small>'));grade.append(v)}if(grade.childElementCount)b.append(grade);
  const pontos=saudeListaDados('peso').filter(r=>r.data<=hoje()&&r.peso>0&&(!SaudeUI.de||r.data>=SaudeUI.de)&&(!SaudeUI.ate||r.data<=SaudeUI.ate)).slice().sort((a,b)=>a.data.localeCompare(b.data));
  if(pontos.length){
    const series=SaudePainelModelo.seriesPeso(pontos),g=el('<section class="sui-chart"><h3>Peso no período</h3><p>Valores registrados, sem projeção. Séries separadas por fonte, método e tratamento vinculado; avaliações com contexto incompleto permanecem isoladas.</p></section>');
    for(const serie of series){
      const ps=serie.pontos,primeiro=ps[0],ultimo=ps.at(-1),delta=+ultimo.peso-(+primeiro.peso),grupo=saudeListaDados('tratamentos').find(t=>t.id===serie.contexto);
      const contexto=[serie.fonte||'Fonte não informada',serie.metodo||'Método não informado',serie.contexto?(grupo?.oque||'Vínculo '+serie.contexto):'Sem tratamento vinculado'].join(' · ');
      g.append(el('<h4>'+esc(contexto)+'</h4><p class="sui-meta">'+(ps.length>1?'Variação nesta série: '+esc((delta>0?'+':'')+saudeValor(+delta.toFixed(3)))+' kg · '+saudeData(primeiro.data)+' a '+saudeData(ultimo.data)+'. Fonte e método declarados nesta série.':saudeData(primeiro.data)+' · Ponto isolado; comparação indisponível.')+'</p>'));
      g.append(graficoEl(gLinha(ps.map(r=>({r:saudeData(r.data),v:+r.peso})),{fmt:v=>v+' kg'})));
    }b.append(g);
  }
  b.append(saudeLista('peso',saudeListaDados('peso'),{criar:false}),saudeLista('vitais',saudeListaDados('vitais'),{criar:false}));return b;
}
function saudeExames(){const b=el('<div></div>');b.append(saudeCabecalho('🧪 Exames e laudos','Evolução por marcador e resultados em linhas. As referências são as do próprio laudo.',[acao('➕ Exame',()=>saudeEditarRegistro('exames')),acao('⚖️ Comparar coletas',()=>abrirModal('Comparação de exames','Compatibilidade dos registros e evolução numérica.',c=>c.append(dashboardExamesSaude({registros:saudeListaDados('exames').filter(x=>(!SaudeUI.de||x.data>=SaudeUI.de)&&(!SaudeUI.ate||x.data<=SaudeUI.ate))}))),'ghost'),acao('📥 Importar JSON',importarExamesRotina,'ghost')]));
  const linhas=saudeLista('exames',saudeListaDados('exames'),{titulo:'📋 Histórico de exames',criar:false,descricao:'Uma linha por resultado; detalhes e documentos nas ações.'});
  if(typeof saudeDashboardEvolucao==='function')b.append(saudeVisoes('exames',linhas,saudeDashboardEvolucao('exames',saudeListaDados('exames'),{de:SaudeUI.de,ate:SaudeUI.ate})));else b.append(linhas);
  const x=el('<details class="sui-detalhes"><summary>📂 Documentos e transcrição</summary><p>Adicione o PDF ou a foto em Documentos. A conferência é manual; não há extração automática por OCR nesta versão.</p></details>');x.append(acao('Abrir biblioteca',()=>saudeIr('documentos'),'ghost mini'));b.append(x);return b}
function saudeConsultas(){const b=el('<div></div>');b.append(saudeCabecalho('🩺 Consultas, sintomas e acompanhamento','Consultas, episódios e sessões em linhas. Abra os detalhes quando precisar.',[acao('📋 Preparar consulta',()=>saudePrepararConsulta(),'ghost')]));for(const k of ['consultas','queixas','fisio'])b.append(saudeLista(k,saudeListaDados(k),{titulo:({consultas:'🩺 Consultas',queixas:'💬 Sintomas e queixas',fisio:'🏃 Fisioterapia'})[k]}));return b}
function saudeCuidados(){const b=el('<div></div>');b.append(saudeLista('vacinas',saudeListaDados('vacinas'),{descricao:'Dose, comprovante e próxima data informada.'}));b.append(saudeLista('rastreios',saudeListaDados('rastreios'),{titulo:'Acompanhamentos indicados',descricao:'Datas confirmadas e respectivas orientações; sem calendário individual presumido.'}));const d=el('<details class="sui-detalhes"><summary>Pautas para conversar com o profissional</summary><p>Sugestões gerais do catálogo existente. Não definem necessidade, periodicidade ou situação individual.</p></details>');const sugestões=typeof rastreiosPendentes==='function'?rastreiosPendentes(true):[];sugestões.forEach(r=>d.append(el('<p><b>'+esc(r.nome)+'</b> · A confirmar'+(r.ultima?' · última data registrada: '+saudeData(r.ultima):' · sem realização comprovada')+'</p>')));b.append(d,saudeLista('histFamiliar',saudeListaDados('histFamiliar'),{descricao:'Somente informações declaradas; nenhum risco individual é calculado.'}));return b}
function saudeAdicionar(){abrirModal('Adicionar registro de Saúde','Escolha o tipo. Você pode completar os detalhes depois.',c=>{const g=el('<div class="sui-grid"></div>');for(const k of ['peso','vitais','exames','consultas','queixas','fisio','vacinas','histFamiliar','rastreios','tratamentos'])g.append(acao(SAUDE_TIPOS[k],()=>saudeEditarRegistro(k),'ghost'));c.append(g)})}
function saudeRelatorioHTML(r){
  const campos={comparacao:['data','valor','unidade','anterior','variacao','referenciaLaudo','metodo'],exames:['exame','data','valor','unidade','referenciaLaudo','medico','metodo'],peso:['data','hora','peso','altura','cintura','gordura','massaGorda','massaMagra','metodo','fonte'],vitais:['data','hora','sis','dia','fc','fonte'],queixas:['oque','data','onde','intensidade','situacao','fatores'],consultas:['data','hora','profissional','especialidade','situacao','motivo','conduta','retorno','perguntas'],fisio:['data','oque','sessao','total','dorAntes','dorDepois','funcional','profissional'],vacinas:['vacina','data','dose','lote','situacao','proxima','local'],tratamentos:['oque','status','frequencia','unidade','inicio'],histFamiliar:['parente','doenca','idade','fonte'],rastreios:['oque','data','proxima','profissional','fonte','situacao'],usos:['oque','data','hora','horaPrevista','quantidade','unidade','situacao','adiadoPara','obs'],estoque:['oque','status','saldo','unidade','consumoPorCiclo','alertaEstoque']};
  campos.tratamentosConferencia=campos.tratamentos;campos.planos=['quem','operadora','plano','carteirinha','acomodacao','status'];
  const labels={quem:'Titular / beneficiário cadastrado',operadora:'Operadora',plano:'Plano',carteirinha:'Carteirinha',acomodacao:'Acomodação',sis:'Sistólica (mmHg)',dia:'Diastólica (mmHg)',fc:'Batimentos (bpm)',peso:'Peso (kg)',frequencia:'Orientação original',data:'Data',valor:'Resultado',referenciaLaudo:'Referência do laudo',oque:'Item',exame:'Marcador',unidade:'Unidade',medico:'Laboratório / profissional',metodo:'Método / contexto',hora:'Horário',altura:'Altura (m ou cm)',cintura:'Cintura (cm)',gordura:'Gordura corporal (%)',massaGorda:'Massa de gordura (kg)',massaMagra:'Massa livre de gordura (kg)',fonte:'Fonte',onde:'Local / região',intensidade:'Intensidade declarada (0 a 10)',situacao:'Situação',fatores:'Fatores relatados',profissional:'Profissional',especialidade:'Especialidade',motivo:'Motivo',conduta:'Decisões registradas',retorno:'Retorno combinado',perguntas:'Perguntas para levar',sessao:'Sessão nº',total:'Total previsto',dorAntes:'Dor antes (0 a 10)',dorDepois:'Dor depois (0 a 10)',funcional:'Evolução funcional relatada',vacina:'Vacina',dose:'Dose declarada',lote:'Lote',proxima:'Próxima data indicada',local:'Local',status:'Situação do cadastro',inicio:'Início confirmado',parente:'Parente',doenca:'Condição declarada',idade:'Idade informada',horaPrevista:'Horário planejado',quantidade:'Quantidade',adiadoPara:'Adiado para',obs:'Observações',saldo:'Saldo disponível',consumoPorCiclo:'Quantidade por uso configurado',alertaEstoque:'Limite de aviso cadastrado',anterior:'Resultado anterior',variacao:'Variação numérica'};
  const s=r.secoes.map(s=>'<section><h2>'+esc(SAUDE_TIPOS[s.tipo]||s.tipo)+'</h2>'+(s.registros.length?s.registros.map(x=>'<article><h3>'+esc(saudeNome(x,s.tipo))+'</h3><dl>'+((campos[s.tipo]||[]).filter(k=>k==='saldo'||x[k]!==''&&x[k]!=null).map(k=>'<div><dt>'+esc(labels[k]||k)+'</dt><dd>'+esc(x[k]==null?'Não informado':String(x[k]))+'</dd></div>').join(''))+'</dl></article>').join(''):'<p>Sem registros no período selecionado.</p>')+'</section>').join('');
  return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Resumo pessoal de Saúde</title><style>body{font:14px/1.5 system-ui;color:#17372f;max-width:900px;margin:30px auto;padding:0 20px}h1{font-size:24px}h2{border-bottom:1px solid #ccc;font-size:18px}article{break-inside:avoid;border-bottom:1px solid #ddd;padding:8px 0}h3{font-size:15px}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}dt{font-size:11px;color:#555}dd{margin:0;overflow-wrap:anywhere}footer{font-size:11px;color:#555;margin-top:20px}button{padding:10px}@media print{button{display:none}body{margin:0;max-width:none}h2{break-after:avoid}section{margin-bottom:15px}}</style><h1>Resumo pessoal de Saúde</h1><p>Confidencial · conteúdo selecionado para revisão pessoal / consulta</p><p>Período: '+esc(r.de?saudeData(r.de):'todo o histórico')+' a '+esc(r.ate?saudeData(r.ate):'hoje')+' · gerado em '+esc(new Date(r.geradoEm).toLocaleString('pt-BR'))+'</p>'+ (r.perguntas?'<h2>Perguntas para a consulta</h2><p>'+esc(r.perguntas).replace(/\n/g,'<br>')+'</p>':'')+s+'<footer>Origem: registros pessoais da Central do Léo. Dados ausentes continuam ausentes. Este resumo não interpreta resultados nem substitui os documentos originais.</footer></html>';
}
function saudePrepararConsulta(consulta){
  abrirModal('Preparar consulta / relatório','Escolha o período e o conteúdo. Confira antes de imprimir ou salvar em PDF.',c=>{
    const form=el('<form class="sui-form"><div class="sui-form-grid"><label>Desde<input name="de" type="date"></label><label>Até<input name="ate" type="date"></label><label class="sui-full">Perguntas para levar<textarea name="perguntas" rows="3"></textarea></label></div><fieldset><legend>Conteúdo do resumo</legend></fieldset><p role="alert"></p><footer><button type="submit" class="btn">Revisar resumo</button></footer></form>');form.querySelector('[name=de]').value=SaudeUI.de||'';form.querySelector('[name=ate]').value=SaudeUI.ate||hoje();form.querySelector('[name=perguntas]').value=consulta?.perguntas||'';
    for(const k of ['tratamentos','exames','peso','vitais','queixas','consultas','fisio','vacinas','histFamiliar','planos','usos','estoque']){const l=el('<label class="sui-check"><input type="checkbox" name="tipos" value="'+k+'">'+esc(k==='tratamentos'?'Medicamentos em uso e legados para conferência':SAUDE_TIPOS[k])+'</label>');l.querySelector('input').checked=false;form.querySelector('fieldset').append(l)}
    form.onsubmit=e=>{e.preventDefault();const de=form.querySelector('[name=de]').value,ate=form.querySelector('[name=ate]').value||hoje(),tipos=[...form.querySelectorAll('[name=tipos]:checked')].map(x=>x.value);if((de&&!dataISOValida(de))||!dataISOValida(ate)||de>ate||!tipos.length){form.querySelector('[role=alert]').textContent='Confira o período e selecione pelo menos uma área.';return}const r=SaudePainelModelo.resumoConsulta(E,{de,ate,tipos,perguntas:form.querySelector('[name=perguntas]').value});saudeRevisarRelatorio(r)};c.append(form);
  });
}
function saudeRevisarRelatorio(r){abrirModal('Revisar resumo selecionado','Nenhum arquivo ou mensagem será enviado.',c=>{const info=el('<div class="sui-resumo-consulta"></div>');r.secoes.forEach(s=>info.append(el('<p><b>'+esc(SAUDE_TIPOS[s.tipo])+'</b> · '+s.registros.length+' registro(s)</p>')));c.append(info);const detalhes=el('<details><summary>Ver conteúdo antes de exportar</summary><div></div></details>');r.secoes.forEach(s=>{const sec=el('<section><h4>'+esc(SAUDE_TIPOS[s.tipo])+'</h4></section>');s.registros.forEach(x=>sec.append(el('<p>'+esc(saudeNome(x,s.tipo))+' · '+esc(x.data?saudeData(x.data):x.status||'')+'</p>')));detalhes.lastElementChild.append(sec)});c.append(detalhes);const frame=el('<iframe class="sui-report-preview" title="Conteúdo selecionado do relatório" sandbox=""></iframe>');frame.srcdoc=saudeRelatorioHTML(r);c.append(frame);c.append(acao('Imprimir / salvar PDF',()=>{const w=window.open('','_blank');if(!w){alert('Permita a abertura do relatório para imprimir.');return}w.opener=null;w.document.write(saudeRelatorioHTML(r));w.document.close();w.focus();w.print()}))})}
function saudeEditarEmergencia(){
  const s=E.sos||{};saudeForm('Ficha de emergência',[
    {k:'nome',t:'Nome para identificação',nota:'Nome declarado da pessoa a quem esta ficha pertence.'},{k:'sangue',t:'Tipo sanguíneo declarado',opcoes:['','A+','A-','B+','B-','AB+','AB-','O+','O-']},{k:'plano',t:'Plano de saúde'},{k:'carteirinha',t:'Número da carteirinha'},{k:'alergias',t:'Alergias declaradas',tipo:'textarea',nota:'Não informado não significa ausência de alergias.'},{k:'alergiasConfirmadas',t:'As informações de alergias foram conferidas',tipo:'checkbox'},{k:'doencas',t:'Condições declaradas',tipo:'textarea'},{k:'cirurgias',t:'Cirurgias anteriores',tipo:'textarea'},{k:'contato1',t:'Contato 1: nome e telefone'},{k:'contato2',t:'Contato 2: nome e telefone'},{k:'medico',t:'Profissional de confiança'},{k:'obs',t:'Observações',tipo:'textarea'}],s,d=>saudeGravar(()=>E.sos={...s,...d,atualizadoEm:new Date().toISOString()}),{sub:'Última revisão: '+(s.atualizadoEm?new Date(s.atualizadoEm).toLocaleString('pt-BR'):'não informada')+'. Registre somente dados confirmados.'});
}
function saudeEmergenciaHTML(tipos){
  const s=E.sos||{},p=E.pessoal||{},linha=(t,v)=>'<p><b>'+esc(t)+':</b> '+esc(v||'Não informado')+'</p>',secoes=[];
  if(tipos.includes('identificacao'))secoes.push('<h2>Identificação e atendimento</h2>'+linha('Nome',s.nome||p.nome||E.nome)+linha('Tipo sanguíneo declarado',s.sangue)+linha('Plano de saúde',s.plano)+linha('Carteirinha',s.carteirinha));
  if(tipos.includes('alergias'))secoes.push('<h2>Alergias e condições declaradas</h2>'+linha('Alergias',s.alergias||'Não informado; ausência de registro não significa ausência de alergias')+linha('Conferência das alergias',s.alergiasConfirmadas?'Informação declarada como conferida':'Ainda não confirmada')+linha('Condições declaradas',s.doencas)+linha('Cirurgias anteriores',s.cirurgias));
  if(tipos.includes('medicamentos')){const ts=saudeListaDados('tratamentos').filter(t=>SaudePainelModelo.ativo(t)&&['Medicamento','Suplemento'].includes(t.tipo));secoes.push('<h2>Itens com uso confirmado no cadastro</h2>'+(ts.length?ts.map(t=>linha(t.oque,t.frequencia||'Orientação não registrada')).join(''):'<p>Nenhum item confirmado no cadastro. Confira com a pessoa e os documentos.</p>'))}
  if(tipos.includes('medicamentos')){
    const legados=saudeListaDados('tratamentos').filter(t=>SaudePainelModelo.ativo(t)&&!t.tipo);
    if(legados.length)secoes.push('<h2>Cadastros legados ativos para conferência</h2><p>Tipo e uso atual precisam de conferência. A seleção não altera o cadastro.</p>'+legados.map(t=>linha(t.oque,t.frequencia||'Orientação não registrada')).join(''));
  }
  if(tipos.includes('planos')){const planos=saudeListaDados('planos').filter(p=>p.status!=='Cancelado');secoes.push('<h2>Planos de saúde vinculados a Gastos</h2>'+(planos.length?planos.map(p=>linha(p.quem||'Beneficiário não informado',[p.operadora,p.plano].filter(Boolean).join(' · '))+linha('Carteirinha',p.carteirinha)+linha('Acomodação',p.acomodacao)).join(''):'<p>Nenhum plano ativo cadastrado.</p>'))}
  if(tipos.includes('histFamiliar'))secoes.push('<h2>Histórico familiar declarado</h2>'+saudeListaDados('histFamiliar').map(f=>linha(f.parente||'Parente não informado',[f.doenca,f.idade!=null&&f.idade!==''?'Idade na ocasião: '+f.idade:'',f.fonte].filter(Boolean).join(' · '))).join(''));
  if(tipos.includes('contatos'))secoes.push('<h2>Contatos</h2>'+linha('Contato 1',s.contato1)+linha('Contato 2',s.contato2)+linha('Profissional de confiança',s.medico));
  if(tipos.includes('observacoes'))secoes.push('<h2>Observações</h2>'+linha('Informação declarada',s.obs));
  return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Ficha de emergência pessoal</title><style>body{font:16px/1.6 system-ui;color:#183b32;max-width:800px;margin:25px auto;padding:20px}h1{font-size:26px}h2{font-size:18px;border-bottom:1px solid #ccc}p{overflow-wrap:anywhere}small{color:#555}section{break-inside:avoid}@media print{body{margin:0}}</style><h1>Ficha de emergência pessoal</h1><p>CONFIDENCIAL · informações declaradas, sujeitas a conferência</p><small>Última revisão: '+esc(s.atualizadoEm?new Date(s.atualizadoEm).toLocaleString('pt-BR'):'não informada')+' · gerado em '+esc(new Date().toLocaleString('pt-BR'))+'</small>'+secoes.map(x=>'<section>'+x+'</section>').join('')+'<footer><small>Origem: cadastro pessoal da Central do Léo. Não substitui documento médico ou identificação oficial.</small></footer></html>';
}
function saudeConsultarEmergencia(){
  abrirModal('Revisar ficha de emergência','Selecione o conteúdo antes de imprimir. A ficha não será publicada nem enviada.',c=>{
    const box=el('<div class="sui-form"><fieldset><legend>Conteúdo da ficha</legend></fieldset></div>'),frame=el('<iframe class="sui-report-preview" title="Prévia da ficha de emergência" sandbox=""></iframe>');
    const selecionados=()=>[...box.querySelectorAll('input:checked')].map(x=>x.value),pintar=()=>frame.srcdoc=saudeEmergenciaHTML(selecionados());
    for(const [v,t]of[['identificacao','Identificação e atendimento'],['alergias','Alergias e condições declaradas'],['medicamentos','Medicamentos em uso e legados para conferência'],['planos','Planos de saúde vinculados a Gastos'],['histFamiliar','Histórico familiar declarado'],['contatos','Contatos'],['observacoes','Observações']]){const l=el('<label class="sui-check"><input type="checkbox" value="'+v+'">'+esc(t)+'</label>');l.querySelector('input').onchange=pintar;box.querySelector('fieldset').append(l)}
    c.append(box,frame);pintar();c.append(acao('Imprimir / salvar PDF',()=>{if(!selecionados().length)return;const w=window.open('','_blank');if(!w){alert('Permita a abertura da ficha para imprimir.');return}w.opener=null;w.document.write(saudeEmergenciaHTML(selecionados()));w.document.close();w.focus();w.print()}));
  });
}
function saudeEmergencia(){abrirModal('Ficha de emergência','Informações declaradas e contatos, com acesso privado.',c=>{c.append(acao('Consultar ficha / PDF',saudeConsultarEmergencia),acao('Editar dados da ficha',saudeEditarEmergencia,'ghost'));c.append(el('<p class="sui-meta">Última revisão: '+esc(E.sos?.atualizadoEm?new Date(E.sos.atualizadoEm).toLocaleString('pt-BR'):'não informada')+'. Confira os dados antes de utilizar.</p>'))})}
function saudePainel(m){
  _saudePagina=m;
  if(typeof history!=='undefined'){
    const valida=area=>SAUDE_AREAS.some(x=>x[0]===area);
    if(valida(history.state?.saudeArea))SaudeUI.area=history.state.saudeArea;
    else {if(!valida(SaudeUI.area))SaudeUI.area='resumo';if(typeof history.replaceState==='function')history.replaceState({...history.state,saudeArea:SaudeUI.area},'')}
    abaSaude=SaudeUI.area;
  }
  m.replaceChildren();m.dataset.saudeWorkbench='1';m.dataset.saudeArea=SaudeUI.area;m.classList.add('saude-workbench');m.dataset.densidade=E.saudePreferencias?.densidade||SaudeUI.densidade;
  const header=el('<header class="sui-header"><div><small>CENTRAL DO LÉO · CUIDADO PESSOAL</small><h1>Saúde, com clareza.</h1><p>Seu histórico organizado. O próximo cuidado à mão.</p></div><div class="sui-actions"></div></header>'),status=saudeStatusGravacao();header.lastElementChild.append(acao('Ficha de emergência',saudeEmergencia,'ghost'),acao('+ Registrar',saudeAdicionar));m.append(header);if(SaudeUI.area!=='tratamentos')m.append(status);
  const nav=el('<nav class="sui-nav" aria-label="Áreas de saúde"></nav>');SAUDE_AREAS.forEach(([id,n])=>{const b=acao(n,()=>{if(id==='tratamentos'&&typeof tratamentoAbrirVisaoGeral==='function')tratamentoAbrirVisaoGeral();else saudeIr(id)},'ghost');b.setAttribute('aria-pressed',String(id===SaudeUI.area));b.setAttribute('aria-controls','sui-area');nav.append(b)});m.append(nav);
  const tools=el('<div class="sui-periodo"><label>Desde<input type="date" name="saude-de" aria-label="Desde"></label><label>Até<input type="date" name="saude-ate" aria-label="Até"></label><button type="button" class="btn ghost mini" data-limpar>Todo o histórico</button><span class="cresce"></span><label>Densidade<select aria-label="Densidade"><option value="compacta">Compacta</option><option value="confortavel">Confortável</option></select></label></div>');tools.querySelector('[name=saude-de]').value=SaudeUI.de;tools.querySelector('[name=saude-ate]').value=SaudeUI.ate;const sel=tools.querySelector('select');[...sel.options].forEach(o=>o.selected=o.value===m.dataset.densidade);
  const mudarPeriodo=()=>{const de=tools.querySelector('[name=saude-de]').value,ate=tools.querySelector('[name=saude-ate]').value;if(de&&ate&&de>ate){tools.querySelector('[name=saude-ate]').setCustomValidity('A data final deve ser posterior à inicial.');tools.querySelector('[name=saude-ate]').reportValidity?.();return}tools.querySelector('[name=saude-ate]').setCustomValidity('');SaudeUI.de=de;SaudeUI.ate=ate;saudePainel(m)};tools.querySelectorAll('input').forEach(i=>i.onchange=mudarPeriodo);tools.querySelector('[data-limpar]').onclick=()=>{SaudeUI.de='';SaudeUI.ate='';saudePainel(m)};sel.onchange=()=>{try{saudeGravar(()=>E.saudePreferencias={...(E.saudePreferencias||{}),densidade:sel.value});SaudeUI.densidade=sel.value;saudePainel(m)}catch(e){alert(e.message)}};const filtros=el('<details class="sui-periodo-detalhes"><summary></summary></details>');filtros.querySelector('summary').textContent=(SaudeUI.de||SaudeUI.ate?saudeData(SaudeUI.de)+' a '+saudeData(SaudeUI.ate):'Todo o histórico')+' · filtros e visualização';filtros.append(tools);m.append(filtros);
  if(SaudeUI.area==='tratamentos'){const contexto=el('<div class="trat-contexto"></div>');contexto.append(filtros,status);m.append(contexto)}
  const corpo=el('<section id="sui-area" class="sui-corpo"></section>');m.append(corpo);
  if(SaudeUI.area==='exames')corpo.append(saudeExames());else if(SaudeUI.area==='medidas')corpo.append(saudeMedidas());else if(SaudeUI.area==='queixas')corpo.append(saudeConsultas());else if(SaudeUI.area==='tratamentos')corpo.append(quadroTratamentos());else if(SaudeUI.area==='cuidados')corpo.append(saudeCuidados());else if(SaudeUI.area==='documentos')corpo.append(typeof quadroDocumentosSaude==='function'?quadroDocumentosSaude():saudeNoVazio('Biblioteca de Saúde','Carregue a versão completa para consultar os documentos.'));else corpo.append(saudeHoje());
  const footer=el('<footer class="sui-footer"><span>Dados pessoais · fontes e documentos preservados</span><div class="sui-actions"></div></footer>');footer.lastElementChild.append(acao('Conferir dados',saudeQualidade,'ghost mini'),acao('Relatórios / PDF',()=>saudePrepararConsulta(),'ghost mini'));m.append(footer);
}
if(typeof window!=='undefined')window.addEventListener('popstate',e=>{if(typeof atual!=='undefined'&&atual==='saude'&&e.state?.saudeArea)saudeIr(e.state.saudeArea,false)});
