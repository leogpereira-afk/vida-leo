/* Acompanhamento pessoal de visitas. O planejamento não comprova presença ou regularidade. */
const DocumentosHabitualidade = (() => {
  const estados={planejada:'Planejada',realizada:'Presença registrada',cancelada:'Cancelada'};
  const chaves=['data','hora','status','local','obs','comprovanteUrl'];
  const objeto=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function dataValida(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v}
  function urlSegura(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
  function chaveGoogle(v){return typeof v?.googleCalendarId==='string'&&v.googleCalendarId.trim()&&typeof v.googleEventId==='string'&&v.googleEventId.trim()?v.googleCalendarId+':'+v.googleEventId:''}
  function resolverGoogle(v,agenda=E.agenda,historico=E.agendaGoogleHistorico){
    const chave=chaveGoogle(v);if(!chave)return {situacao:'local',visita:v,registro:null,link:''};
    const registro=(agenda||[]).find(a=>a.googleId===chave&&a.googleCalendar===v.googleCalendarId);
    const link=urlSegura(registro?.googleLink)||urlSegura(v.googleHtmlLink);
    if(registro&&dataValida(registro.data))return {situacao:'ativo',registro,link,visita:v.status==='realizada'?v:{...v,data:registro.data,hora:registro.hora||'',local:registro.local||''}};
    const removido=[...(historico||[])].reverse().find(h=>h.registro?.googleId===chave&&['Cancelado no Google','Recusado no Google','Removido nesta Central'].includes(h.motivo));
    return {situacao:removido?(removido.motivo==='Removido nesta Central'?'retirado':'cancelado'):'aguardando',visita:v,registro:null,link};
  }
  function habilitada(d){return d?.grupo==='armas'&&d.tipoRegistro==='arma'&&objeto(d.habitualidade)&&Number.isInteger(d.habitualidade.metaAnual)&&d.habitualidade.metaAnual>0}
  function validarEstrutura(h){
    const erro=msg=>{throw Error('documentos.habitualidade: '+msg)};
    if(!objeto(h))erro('use um objeto de acompanhamento.');
    if(!Number.isInteger(h.metaAnual)||h.metaAnual<1||h.metaAnual>365)erro('meta anual inválida.');
    if(h.clubeId!==undefined&&typeof h.clubeId!=='string')erro('vínculo do clube inválido.');
    if(!Array.isArray(h.visitas))erro('visitas deve ser uma lista.');
    const ids=new Set(),dias=new Set(),googleIds=new Set();
    for(const v of h.visitas){
      if(!objeto(v)||typeof v.id!=='string'||!v.id.trim()||ids.has(v.id))erro('cada visita precisa de um ID único.');ids.add(v.id);
      if(!dataValida(v.data))erro('data de visita inválida.');
      if(!Object.hasOwn(estados,v.status))erro('situação de visita inválida.');
      for(const k of ['hora','local','obs','comprovanteUrl'])if(v[k]!==undefined&&typeof v[k]!=='string')erro('campo '+k+' inválido.');
      if(v.hora&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.hora))erro('horário inválido.');
      if(v.comprovanteUrl&&!urlSegura(v.comprovanteUrl))erro('comprovante precisa de link https://.');
      if(['googleCalendarId','googleEventId','googleHtmlLink'].some(k=>v[k]!==undefined)){
        for(const k of ['googleCalendarId','googleEventId'])if(typeof v[k]!=='string'||!v[k].trim()||v[k]!==v[k].trim()||v[k].length>1024||/[\x00-\x1f]/.test(v[k]))erro('vínculo Google incompleto ou inválido.');
        if(v.googleHtmlLink!==undefined&&(typeof v.googleHtmlLink!=='string'||v.googleHtmlLink&&!urlSegura(v.googleHtmlLink)))erro('link Google precisa de https://.');
        const chave=chaveGoogle(v);if(googleIds.has(chave))erro('evento Google já vinculado a outra visita.');googleIds.add(chave);
      }
      if(v.status==='realizada'&&v.data>hoje())erro('presença futura não pode ser realizada.');
      if(v.status!=='cancelada'){if(dias.has(v.data))erro('visita duplicada no mesmo dia.');dias.add(v.data)}
    }
    return true;
  }
  function localizar(id){const d=E.documentos.find(x=>x.id===id&&x.grupo==='armas'&&x.tipoRegistro==='arma');if(!d)throw Error('A ficha foi removida ou alterada. Reabra os documentos.');return d}
  function gravar(d){const anterior=E.documentos,mt=E._mt;E.documentos=anterior.map(x=>x.id===d.id?d:x);try{salvar()}catch{E.documentos=anterior;E._mt=mt;throw Error('Não foi possível salvar. Os dados anteriores foram preservados; tente novamente.')}return d}
  function configurar(id,base,valores){
    const atual=localizar(id),meta=Number(valores.metaAnual),clubeId=String(valores.clubeId||'');
    if(!Number.isInteger(meta)||meta<1||meta>365)throw Error('Informe uma meta entre 1 e 365 visitas por ano.');
    if(clubeId&&!E.documentos.some(d=>d.id===clubeId&&d.grupo==='armas'&&d.tipoRegistro==='clube'))throw Error('Selecione um clube cadastrado.');
    const h=atual.habitualidade;
    if(['metaAnual','clubeId'].some(k=>String(h?.[k]??'')!==String(base?.[k]??'')))throw Error('O acompanhamento mudou em outra sessão. Reabra a ficha.');
    const d=structuredClone(atual);d.habitualidade={...(d.habitualidade||{}),metaAnual:meta,clubeId,visitas:d.habitualidade?.visitas||[]};validarEstrutura(d.habitualidade);
    d.historico=Array.isArray(d.historico)?d.historico:[];d.historico.push({data:new Date().toISOString(),acao:'Acompanhamento de visitas configurado'});d.atualizadoEm=new Date().toISOString();return gravar(d);
  }
  function salvarVisita(id,base,valores){
    const atual=localizar(id);if(!habilitada(atual))throw Error('Configure o acompanhamento antes de adicionar visitas.');
    const visitaId=String(base?.id||valores.id||'');if(!visitaId)throw Error('Identificação da visita ausente. Reabra o formulário.');
    const h=atual.habitualidade,existente=h.visitas.find(v=>v.id===visitaId);
    const novos=Object.fromEntries(chaves.map(k=>[k,String(valores[k]??'').trim()]));
    if(base&&['googleCalendarId','googleEventId'].some(k=>String(existente?.[k]??'')!==String(base[k]??'')))throw Error('O vínculo Google mudou em outra sessão. Reabra a visita.');
    if(chaveGoogle(existente)){
      for(const k of ['data','hora','local']){if(valores[k]!==undefined&&String(valores[k]).trim()!==String(existente[k]??''))throw Error('Altere data, horário e local no Google Agenda.');novos[k]=String(existente[k]??'');}
      if(novos.status==='realizada'&&existente.status!=='realizada'){
        const g=resolverGoogle(existente);if(g.situacao!=='ativo')throw Error('Confira o agendamento no Google antes de registrar a presença.');
        for(const k of ['data','hora','local'])novos[k]=g.visita[k]||'';
      }
    }
    if(!novos.data||!dataValida(novos.data))throw Error('Informe uma data válida.');
    if(!Object.hasOwn(estados,novos.status))throw Error('Selecione a situação da visita.');
    if(novos.status==='realizada'&&novos.data>hoje())throw Error('Uma visita futura não pode ser registrada como realizada.');
    if(novos.comprovanteUrl&&!urlSegura(novos.comprovanteUrl))throw Error('Use um link https:// válido para o comprovante.');
    if(novos.hora&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(novos.hora))throw Error('Informe um horário válido.');
    if(base&&!existente)throw Error('A visita foi alterada ou removida. Reabra a ficha.');
    const igual=existente&&chaves.every(k=>String(existente[k]??'')===novos[k]);if(igual)return atual;
    if(existente&&(!base||chaves.some(k=>String(existente[k]??'')!==String(base[k]??''))))throw Error('Esta visita mudou em outra sessão. Reabra para conferir antes de salvar.');
    if(novos.status!=='cancelada'&&h.visitas.some(v=>v.id!==visitaId&&v.data===novos.data&&v.status!=='cancelada'))throw Error('Já existe uma visita nessa data. Edite a visita existente para evitar duplicidade.');
    const d=structuredClone(atual),v={...(existente||{}),id:visitaId,...novos,atualizadoEm:new Date().toISOString()};
    v.historico=Array.isArray(v.historico)?v.historico:[];v.historico.push({data:v.atualizadoEm,acao:base?'Visita atualizada':'Visita planejada ou registrada',antes:base?Object.fromEntries(chaves.map(k=>[k,existente[k]??''])):{}});
    d.habitualidade.visitas=existente?d.habitualidade.visitas.map(x=>x.id===visitaId?v:x):[...d.habitualidade.visitas,v];validarEstrutura(d.habitualidade);
    d.atualizadoEm=v.atualizadoEm;d.historico=Array.isArray(d.historico)?d.historico:[];d.historico.push({data:v.atualizadoEm,acao:'Visita ao clube: '+estados[v.status]});return gravar(d);
  }
  function resumo(d,ano=Number(hoje().slice(0,4)),referencia=hoje()){
    const visitas=(Array.isArray(d?.habitualidade?.visitas)?d.habitualidade.visitas:[]).map(v=>resolverGoogle(v).visita),doAno=visitas.filter(v=>dataValida(v.data)&&Number(v.data.slice(0,4))===Number(ano)),planejadaAtiva=v=>v.status==='planejada'&&['local','ativo'].includes(resolverGoogle(v).situacao);
    const realizadas=new Set(doAno.filter(v=>v.status==='realizada'&&v.data<=referencia).map(v=>v.data)).size;
    return {ano:Number(ano),meta:Number(d?.habitualidade?.metaAnual)||0,realizadas,planejadas:doAno.filter(planejadaAtiva).length,visitas:doAno.slice().sort((a,b)=>a.data.localeCompare(b.data)||(a.hora||'').localeCompare(b.hora||'')),proxima:visitas.filter(v=>planejadaAtiva(v)&&dataValida(v.data)&&v.data>=referencia).slice().sort((a,b)=>a.data.localeCompare(b.data)||(a.hora||'').localeCompare(b.hora||''))[0]||null};
  }
  function renderResumo(d){
    if(!habilitada(d))return null;const r=resumo(d);
    const box=el('<div class="dh-resumo"><div><span>🏅 Visitas ao clube · '+r.ano+'</span><b>'+r.realizadas+' / '+r.meta+' <small>presenças registradas</small></b></div><span>'+r.planejadas+' planejada(s)</span></div>');
    const p=r.proxima;if(p)box.appendChild(el('<small>Próxima: '+esc(fmtDataAno(p.data))+(p.hora?' · '+esc(p.hora):'')+'</small>'));return box;
  }
  function render(id){
    const sec=el('<section class="secao dh-painel" aria-label="Habitualidade e visitas ao clube"></section>');let ano=Number(hoje().slice(0,4));
    function pintar(){
      const d=localizar(id),h=d.habitualidade;sec.replaceChildren();
      const head=el('<div class="dh-head"><div><h4>🏅 Habitualidade · visitas ao clube</h4><p>Meta pessoal de acompanhamento. Planejar não confirma presença.</p></div></div>');sec.appendChild(head);
      const formHost=el('<div class="dh-form-host"></div>');
      function configurarForm(){formHost.replaceChildren();const base=structuredClone(h||{}),clubes=E.documentos.filter(x=>x.grupo==='armas'&&x.tipoRegistro==='clube');
        const f=devFormulario(formHost,[{k:'metaAnual',t:'Meta pessoal de visitas por ano',tipo:'number',req:true},{k:'clubeId',t:'Clube de tiro',opcoes:['',...clubes.map(x=>x.id)]}],{metaAnual:h?.metaAnual||4,clubeId:h?.clubeId||''},'Salvar acompanhamento',v=>{configurar(id,base,v);pintar()});
        f.querySelector('[name=metaAnual]').min='1';f.querySelector('[name=metaAnual]').max='365';for(const o of f.querySelector('[name=clubeId]').options)o.textContent=o.value?(clubes.find(x=>x.id===o.value)?.nome||'Clube a conferir'):'Selecionar depois';const escolhido=[...f.querySelector('[name=clubeId]').options].find(o=>o.value===(h?.clubeId||''));if(escolhido)escolhido.selected=true;
      }
      head.appendChild(acao(habilitada(d)?'Ajustar meta':'Configurar',configurarForm,'ghost'));
      if(!habilitada(d)){sec.append(formHost,el('<p class="da-note">Defina uma meta pessoal e registre as visitas realizadas, com comprovantes quando disponíveis.</p>'));return}
      const r=resumo(d,ano),club=E.documentos.find(x=>x.id===h.clubeId&&x.tipoRegistro==='clube');
      const toolbar=el('<div class="dh-toolbar"><label>Ano <select aria-label="Ano das visitas"></select></label></div>');const years=[...new Set([Number(hoje().slice(0,4))-1,Number(hoje().slice(0,4)),Number(hoje().slice(0,4))+1,ano,...h.visitas.map(v=>resolverGoogle(v).visita).filter(v=>dataValida(v.data)).map(v=>Number(v.data.slice(0,4)))])].sort((a,b)=>b-a),select=toolbar.querySelector('select');years.forEach(y=>{const o=el('<option></option>');o.value=String(y);o.textContent=String(y);o.selected=y===ano;select.appendChild(o)});const escolhido=[...select.options].find(o=>o.value===String(ano));if(escolhido)escolhido.selected=true;select.onchange=()=>{ano=Number(select.value);pintar()};
      toolbar.appendChild(acao('+ Planejar visita',()=>formVisita(null),'ghost'));sec.appendChild(toolbar);
      sec.appendChild(el('<div class="dh-metricas"><div><b>'+r.realizadas+' / '+r.meta+'</b><span>presenças registradas em '+ano+'</span></div><div><b>'+r.planejadas+'</b><span>visitas planejadas no ano</span></div></div>'));
      if(club)sec.appendChild(el('<p class="dh-clube">📍 '+esc(club.nome)+'</p>'));
      const rows=el('<div class="dh-visitas"></div>');sec.appendChild(rows);
      if(!r.visitas.length)rows.appendChild(el('<p class="da-note">Nenhuma visita registrada neste ano. Isso não significa que você não compareceu.</p>'));
      r.visitas.forEach(v=>{
        const original=h.visitas.find(x=>x.id===v.id),g=resolverGoogle(original),google=chaveGoogle(original),situacao=v.status==='planejada'&&g.situacao==='cancelado'?'Agendamento cancelado no Google':v.status==='planejada'&&g.situacao==='retirado'?'Agendamento retirado da Central':v.status==='planejada'&&g.situacao==='aguardando'?'Aguardando sincronização do Google':v.status==='planejada'&&v.data<hoje()?'Presença a confirmar':estados[v.status];
        const row=el('<article class="dh-visita dh-'+v.status+'"><div><b>'+esc(fmtDataAno(v.data))+(v.hora?' · '+esc(v.hora):'')+'</b><span>'+esc(situacao)+'</span>'+(v.local?'<small>'+esc(v.local)+'</small>':'')+(google?'<small>'+(g.situacao==='ativo'?'Agendamento no Google · avisos no evento':'Última data registrada · conferir no Google')+'</small>':'')+'</div><div class="dh-acoes"></div></article>');
        const actions=row.querySelector('.dh-acoes');actions.appendChild(acao(google?'Registrar / editar':'Editar',()=>formVisita(original),'ghost'));
        if(g.link){const a=el('<a target="_blank" rel="noopener noreferrer">Abrir Google ↗</a>');a.href=g.link;actions.appendChild(a)}
        if(v.comprovanteUrl&&urlSegura(v.comprovanteUrl)){const a=el('<a target="_blank" rel="noopener noreferrer">Comprovante ↗</a>');a.href=urlSegura(v.comprovanteUrl);actions.appendChild(a)}rows.appendChild(row);
      });
      sec.append(formHost,el('<p class="da-note dh-disclaimer">A contagem considera apenas presenças registradas por você. Não substitui a declaração do clube nem a conferência das exigências aplicáveis.</p>'));
      function formVisita(v){
        formHost.replaceChildren();const base=v?structuredClone(v):null,novoId=uid(),seed=v||{data:'',hora:'09:00',status:'planejada',local:club?.nome||''};
        formHost.appendChild(el('<h5>'+(v?'Editar visita':'Planejar uma visita')+'</h5>'));
        const vinculado=!!chaveGoogle(v),g=vinculado?resolverGoogle(v):null;
        if(vinculado)formHost.appendChild(el('<p class="da-note">'+esc(fmtDataAno(g.visita.data))+(g.visita.hora?' · '+esc(g.visita.hora):'')+' · Data, horário e local são alterados no Google. Aqui você registra presença, observações e comprovante. Cancelar aqui não cancela o evento no Google.</p>'));
        const campos=[...(!vinculado?[{k:'data',t:'Data',tipo:'date',req:true},{k:'hora',t:'Horário',tipo:'time'}]:[]),{k:'status',t:'Situação',opcoes:Object.keys(estados),req:true},...(!vinculado?[{k:'local',t:'Local'}]:[]),{k:'comprovanteUrl',t:'Link do comprovante (opcional)',tipo:'url',full:true},{k:'obs',t:'Observações',tipo:'textarea',full:true}];
        const f=devFormulario(formHost,campos,seed,'Salvar visita',val=>{const salvo=salvarVisita(id,base,{id:novoId,...val});const atual=salvo.habitualidade.visitas.find(x=>x.id===(base?.id||novoId));ano=Number(resolverGoogle(atual).visita.data.slice(0,4));pintar()});for(const o of f.querySelector('[name=status]').options)o.textContent=estados[o.value];const estado=[...f.querySelector('[name=status]').options].find(o=>o.value===seed.status);if(estado)estado.selected=true;formHost.appendChild(acao('Fechar edição',()=>formHost.replaceChildren(),'ghost'));formHost.scrollIntoView?.({block:'nearest'});
      }
    }
    pintar();return sec;
  }
  function eventos(documentos,referencia=hoje(),agenda=E.agenda,historico=E.agendaGoogleHistorico){
    if(!dataValida(referencia))return [];const vistos=new Set(),ev=[];
    for(const d of documentos||[]){if(!habilitada(d))continue;for(const original of Array.isArray(d.habitualidade.visitas)?d.habitualidade.visitas:[]){
      if(!original?.id||original.status!=='planejada')continue;
      const g=resolverGoogle(original,agenda,historico),v=g.visita,vinculado=!!chaveGoogle(original);
      // A cópia importada é a única ocorrência. Sem ela não reviver a data
      // antiga, nem mesmo após cancelamento ou remoção local confirmados.
      if(vinculado&&g.situacao!=='ativo'||!dataValida(v.data))continue;
      const id='habitualidade:'+d.id+':'+v.id;if(vistos.has(id))continue;vistos.add(id);
      ev.push({id,data:v.data,hora:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.hora||'')?v.hora:'',titulo:'Visita ao clube · '+(d.nome||'Acompanhamento'),sub:(v.data<referencia?'Presença a confirmar':'Planejada')+(v.local?' · '+v.local:''),local:v.local||'',fonte:'documentos',ic:'🏅',ir:'documentos',col:'documentos',ref:d,documentoId:d.id,visitaId:v.id,tipo:'habitualidade',status:'planejada',...(vinculado?{somenteAvisos:true,googleId:chaveGoogle(v)}:{})});
    }}
    return ev;
  }
  return {habilitada,validarEstrutura,configurar,salvarVisita,resumo,renderResumo,render,eventos,chaveGoogle,resolverGoogle};
})();
