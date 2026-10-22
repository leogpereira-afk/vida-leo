// Espelho das funções puras do cliente; teste de paridade impede divergência.
const dataLocal=d=>d.toISOString().slice(0,10);
function reconciliarAgendaGoogle(agenda,historico,lotes,agora,novoId){
  const canon=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canon):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]))):v;
  const igual=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
  const ativos=structuredClone(agenda),arquivo=structuredClone(historico||[]);
  const cont={novos:0,atualizados:0,arquivados:0};
  const guardar=(registro,motivo)=>arquivo.push({registro:structuredClone(registro),motivo,em:agora});
  for(const lote of lotes){
    const cal=lote.id,aliases=new Set(lote.aliases||[cal]);aliases.add(cal);
    const chave=a=>a.googleId&&[...aliases].some(c=>a.googleId.startsWith(c+':'))?a.googleId.slice(a.googleId.indexOf(':')+1):null;
    const vistos=new Set();
    for(const e of lote.eventos){
      if(!e.id||vistos.has(e.id))continue;vistos.add(e.id);
      const encontrados=ativos.filter(a=>chave(a)===e.id);
      const recusado=e.attendees?.some(a=>a.self&&a.responseStatus==='declined');
      if(e.status==='cancelled'||recusado){
        for(const a of encontrados){guardar(a,e.status==='cancelled'?'Cancelado no Google':'Recusado no Google');ativos.splice(ativos.indexOf(a),1);cont.arquivados++}continue;
      }
      const reg=normalizarEventoGoogle(e,cal);if(!reg)continue;
      const {obs,tipo,...campos}=reg;
      campos.googleDescricao=e.description||'';
      campos.googleRecorrencia=e.recurringEventId||'';
      campos.googleOrganizador=e.organizer||null;
      campos.googleConferencia=e.conferenceData||null;
      campos.googleLembretes=e.reminders||null;
      campos.googleAnexos=e.attachments||[];
      const atual=encontrados[0];
      if(!atual){
        // Calendários secundários só atualizam o que já foi escolhido. A principal
        // acompanha eventos novos na janela exibida; não revive exclusões locais.
        const oculto=arquivo.some(x=>x.motivo==='Removido nesta Central'&&chave(x.registro)===e.id);
        if(lote.adicionar&&!oculto){ativos.push({id:novoId(),...reg,...campos});cont.novos++}continue;
      }
      if(Object.entries(campos).some(([k,v])=>!igual(atual[k],v))){
        // Campos novos apenas enriquecem o cadastro. Arquive quando algum valor
        // já existente for substituído; não duplique tudo só por adicionar metadados.
        if(Object.entries(campos).some(([k,v])=>Object.hasOwn(atual,k)&&!igual(atual[k],v)))guardar(atual,'Atualizado pelo Google');
        Object.assign(atual,campos);cont.atualizados++;
      }
      for(const repetido of encontrados.slice(1)){
        guardar(repetido,'Cópia do mesmo ID Google');
        // Mantém as notas de cada cópia, além do registro completo no histórico.
        if(repetido.obs&&repetido.obs!==atual.obs)atual.obs=[atual.obs,repetido.obs].filter(Boolean).join('\n\n');
        ativos.splice(ativos.indexOf(repetido),1);cont.arquivados++;
      }
    }
  }
  return {agenda:ativos,historico:arquivo,cont,mudou:Object.values(cont).some(Boolean)};
}
async function consultarSincronizacaoAgenda(agenda,ler,agora=new Date()){
  const principal=await ler('agenda','calendars/primary?fields=id');
  if(!principal.id)throw Error('Não foi possível identificar a agenda principal.');
  const calendarios=[...new Set([principal.id,...agenda.filter(a=>a.googleId&&a.googleCalendar&&a.googleCalendar!=='gmail').map(a=>a.googleCalendar==='primary'?principal.id:a.googleCalendar)])];
  const inicio=new Date(agora);inicio.setDate(inicio.getDate()-7);const fim=new Date(agora);fim.setFullYear(fim.getFullYear()+1);
  const lotes=[],pendencias=[];
  for(const id of calendarios){
    const aliases=id===principal.id?[id,'primary']:[id];const eventos=[];let pagina='',n=0;
    do{const q=new URLSearchParams({singleEvents:'true',showDeleted:'true',maxResults:'250',timeMin:inicio.toISOString(),timeMax:fim.toISOString(),timeZone:'America/Sao_Paulo'});if(pagina)q.set('pageToken',pagina);
      const r=await ler('agenda','calendars/'+encodeURIComponent(id)+'/events?'+q);
      if(!Array.isArray(r.items))throw Error('Resposta incompleta do Google. Nenhum compromisso foi alterado.');
      eventos.push(...r.items);pagina=r.nextPageToken||'';
      if(++n>=20&&pagina)throw Error('Consulta incompleta. Nenhum compromisso foi alterado.');
    }while(pagina);
    // Ausência em uma janela não é cancelamento. Confira individualmente os IDs
    // importados que ficaram fora dela (inclusive datas antigas e eventos movidos).
    const vistos=new Set(eventos.map(e=>e.id));
    const faltantes=[...new Set(agenda.filter(a=>a.googleId&&aliases.some(c=>a.googleId.startsWith(c+':'))).map(a=>a.googleId.slice(a.googleId.indexOf(':')+1)))].filter(e=>!vistos.has(e));
    for(let i=0;i<faltantes.length;i+=5){
      const bloco=await Promise.all(faltantes.slice(i,i+5).map(async eid=>{
        try{const e=await ler('agenda','calendars/'+encodeURIComponent(id)+'/events/'+encodeURIComponent(eid));if(e.id!==eid)throw Error('ID divergente');return e}
        catch(_){pendencias.push({calendario:id,id:eid});return null}
      }));eventos.push(...bloco.filter(Boolean));
    }
    lotes.push({id,aliases,adicionar:id===principal.id,eventos});
  }
  return {lotes,pendencias};
}

function normalizarEventoGoogle(e,calId,fuso='America/Sao_Paulo'){
  if(!e.id||e.status==='cancelled'||!e.start)return null;
  let data,hora='',ate;
  if(e.start.date){data=e.start.date;const fim=new Date((e.end?.date||e.start.date)+'T12:00');if(e.end?.date)fim.setDate(fim.getDate()-1);ate=dataLocal(fim)}
  else{const inicio=new Date(e.start.dateTime);if(!Number.isFinite(inicio.getTime()))return null;
    const partes=new Intl.DateTimeFormat('en-CA',{timeZone:fuso,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(inicio);const p=Object.fromEntries(partes.map(x=>[x.type,x.value]));data=p.year+'-'+p.month+'-'+p.day;hora=p.hour+':'+p.minute;}
  return {googleId:calId+':'+e.id,googleCalendar:calId,googleAtualizado:e.updated||'',gid:e.iCalUID||'',data,hora,ate:ate||data,titulo:e.summary||'(sem título)',local:e.location||'',tipo:'Pessoal',obs:'Importado do Google Agenda',googleLink:e.htmlLink||'',googleInicio:e.start.dateTime||e.start.date,googleFim:e.end?.dateTime||e.end?.date||'',googleDescricao:e.description||''};
}

export {reconciliarAgendaGoogle,consultarSincronizacaoAgenda,normalizarEventoGoogle};
