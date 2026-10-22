  const FUSO='America/Sao_Paulo', LIMITE=4, CACHE_MS=60000;
  const nomes={agenda:'Google Agenda',gmail:'E-mails recentes',drive:'Atalhos do Drive'};
  const dicas={agenda:'Agenda principal · próximos 30 dias',gmail:'Caixa de entrada · mais recentes',drive:'Pastas do Meu Drive · A a Z'};
  const icones={agenda:'📅',gmail:'✉️',drive:'📁'};
  const criarEl=(tag,classe,texto)=>{const e=document.createElement(tag);if(classe)e.className=classe;if(texto!=null)e.textContent=texto;return e};
  const dataBR=(d,op={})=>new Intl.DateTimeFormat('pt-BR',{timeZone:FUSO,...op}).format(d);
  const diaISO=d=>new Intl.DateTimeFormat('en-CA',{timeZone:FUSO,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  function dataValida(t){const d=new Date(t);return Number.isFinite(d.getTime())?d:null}
  function linkGoogle(valor,host){try{const u=new URL(valor);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname===host?u.href:''}catch{return ''}}
  function quandoEvento(e,agora){
    if(e.start?.date){const d=dataValida(e.start.date+'T12:00:00-03:00');return d?(e.start.date===diaISO(agora)?'Hoje':dataBR(d,{day:'2-digit',month:'2-digit'}))+' · Dia inteiro':'Data não informada'}
    const d=dataValida(e.start?.dateTime);if(!d)return 'Data não informada';
    return (diaISO(d)===diaISO(agora)?'Hoje':dataBR(d,{day:'2-digit',month:'2-digit'}))+' · '+dataBR(d,{hour:'2-digit',minute:'2-digit'});
  }
  function eventosAtivos(items,agora){
    const inicio=e=>Date.parse(e.start.dateTime||(e.start.date+'T00:00:00-03:00'));
    const vistos=new Set();return items.filter(e=>{
      if(!e.id||vistos.has(e.id)||e.status==='cancelled'||e.attendees?.some(a=>a.self&&a.responseStatus==='declined'))return false;
      const inicio=e.start?.dateTime?dataValida(e.start.dateTime):dataValida((e.start?.date||'')+'T12:00:00-03:00');
      if(!inicio)return false;
      const terminou=e.end?.date?e.end.date<=diaISO(agora):e.end?.dateTime?(!dataValida(e.end.dateTime)||dataValida(e.end.dateTime)<=agora):inicio<agora;
      if(terminou)return false;vistos.add(e.id);return true;
    }).sort((a,b)=>inicio(a)-inicio(b));
  }

export async function coletarResumo(servico,ler){
    async function consultar(servico){
      if(servico==='agenda'){
        const agora=new Date(),fim=new Date(agora.getTime()+30*86400000);let token='',paginas=0,items=[];
        const calendario=ler('agenda','calendars/primary?fields=id').catch(()=>({}));
        do{const q=new URLSearchParams({singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'20',timeMin:agora.toISOString(),timeMax:fim.toISOString(),timeZone:FUSO,fields:'nextPageToken,items(id,status,summary,start,end,htmlLink,attendees(self,responseStatus))'});
          if(token)q.set('pageToken',token);const r=await ler('agenda','calendars/primary/events?'+q);items.push(...(r.items||[]));token=r.nextPageToken||'';
        }while(token&&++paginas<3&&eventosAtivos(items,agora).length<LIMITE);
        const ativos=eventosAtivos(items,agora);return{items:ativos.slice(0,LIMITE),conta:(await calendario).id||'',parcial:!!token&&ativos.length<LIMITE};
      }
      if(servico==='gmail'){
        const lista=await ler('gmail','messages?'+new URLSearchParams({maxResults:String(LIMITE),q:'in:inbox',fields:'messages(id),nextPageToken'}));
        const [perfil,respostas]=await Promise.all([
          ler('gmail','profile?fields=emailAddress').catch(()=>({})),
          Promise.allSettled((lista.messages||[]).map(m=>{
            const q=new URLSearchParams({format:'metadata',fields:'id,threadId,internalDate,labelIds,payload(headers)'});
            for(const nome of ['Subject','From','Date'])q.append('metadataHeaders',nome);
            return ler('gmail','messages/'+encodeURIComponent(m.id)+'?'+q);
          }))
        ]);
        const items=respostas.filter(r=>r.status==='fulfilled').map(r=>r.value).sort((a,b)=>(+b.internalDate||0)-(+a.internalDate||0));
        if(respostas.length&&!items.length)throw Error('Não foi possível carregar os e-mails. Tente atualizar.');
        return{items,conta:perfil.emailAddress||'',parcial:items.length<respostas.length};
      }
      const items=[];let token='',paginas=0;
      do{const q=new URLSearchParams({q:"'root' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'",orderBy:'name',pageSize:String(LIMITE),fields:'nextPageToken,files(id,name)'});
        if(token)q.set('pageToken',token);const r=await ler('drive','files?'+q);items.push(...(r.files||[]));token=r.nextPageToken||'';
      }while(token&&++paginas<3&&items.length<LIMITE);
      return{items:items.filter(f=>f.id).slice(0,LIMITE),parcial:!!token&&items.length<LIMITE};
    }

return consultar(servico);
}
